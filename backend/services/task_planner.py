"""
Task Planner — merges robot-fleet's LLM-based DAG planning with
ROOSTER's order-to-job-to-task conversion pipeline.
"""

import json
import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import async_session
from models.robot import Robot
from models.task import Task, TaskType, TaskStatus, TaskPriority
from models.job import Job, JobStatus, PlanningStrategy

logger = logging.getLogger(__name__)


# ── ROOSTER-style order-to-task builders ──

ORDER_TASK_BUILDERS = {
    "TRANSPORT": lambda args: [
        {"type": TaskType.NAVIGATE, "desc": f"Navigate to pickup: {args[0]}",
         "location": args[0]},
        {"type": TaskType.AWAIT_LOAD, "desc": f"Await loading at {args[0]}",
         "location": args[0]},
        {"type": TaskType.NAVIGATE, "desc": f"Navigate to dropoff: {args[1]}",
         "location": args[1]},
        {"type": TaskType.AWAIT_UNLOAD, "desc": f"Await unloading at {args[1]}",
         "location": args[1]},
    ],
    "MOVE": lambda args: [
        {"type": TaskType.NAVIGATE, "desc": f"Navigate to {args[0]}",
         "location": args[0]},
    ],
    "DELIVER": lambda args: [
        {"type": TaskType.NAVIGATE, "desc": f"Navigate to pickup: {args[0]}",
         "location": args[0]},
        {"type": TaskType.AWAIT_LOAD, "desc": f"Load items at {args[0]}",
         "location": args[0]},
        {"type": TaskType.NAVIGATE, "desc": f"Deliver to: {args[1]}",
         "location": args[1]},
        {"type": TaskType.AWAIT_UNLOAD, "desc": f"Unload at {args[1]}",
         "location": args[1]},
    ],
    "CLEAN": lambda args: [
        {"type": TaskType.NAVIGATE, "desc": f"Navigate to cleaning zone: {args[0]}",
         "location": args[0]},
        {"type": TaskType.CLEAN, "desc": f"Clean zone {args[0]}",
         "location": args[0]},
    ],
    "CHARGE": lambda _args: [
        {"type": TaskType.CHARGE, "desc": "Return to charging station"},
    ],
    "LOAD": lambda _args: [
        {"type": TaskType.AWAIT_LOAD, "desc": "Await loading at current position"},
    ],
    "UNLOAD": lambda _args: [
        {"type": TaskType.AWAIT_UNLOAD, "desc": "Await unloading at current position"},
    ],
}


class TaskPlanner:
    """
    Generates task plans for jobs using either:
    1. ROOSTER-style keyword-based sequential planning
    2. robot-fleet's LLM-based DAG planning
    """

    async def plan_from_order(
        self, job: Job, session: AsyncSession
    ) -> list[Task]:
        """ROOSTER-style: convert order keyword + args into sequential tasks."""
        keyword = job.order_keyword.upper()
        args = job.order_args or []
        builder = ORDER_TASK_BUILDERS.get(keyword)

        if not builder:
            logger.error("Unknown order keyword: %s", keyword)
            return []

        task_specs = builder(args)
        tasks = []
        prev_task_id = None

        for i, spec in enumerate(task_specs):
            task = Task(
                description=spec["desc"],
                task_type=spec["type"],
                status=TaskStatus.PENDING,
                priority=TaskPriority(job.priority),
                job_id=job.id,
                target_location_name=spec.get("location", ""),
                cleaning_zone_id=spec.get("location", "") if spec["type"] == TaskType.CLEAN else "",
                dependency_task_ids=[prev_task_id] if prev_task_id else [],
            )
            session.add(task)
            await session.flush()  # Get task.id
            tasks.append(task)
            prev_task_id = task.id

        # Update job with task IDs
        job.task_ids = [t.id for t in tasks]
        job.total_tasks = len(tasks)
        job.status = JobStatus.PLANNED
        await session.commit()

        logger.info("Planned %d tasks for job %d (%s)", len(tasks), job.id, keyword)
        return tasks

    async def plan_with_llm(
        self, job: Job, goals: list[str], session: AsyncSession
    ) -> list[Task]:
        """robot-fleet-style: use LLM to generate a task DAG."""
        if not settings.openai_api_key:
            logger.warning("No OpenAI API key — falling back to sequential planning")
            return await self._fallback_plan(job, goals, session)

        try:
            import openai

            client = openai.AsyncOpenAI(api_key=settings.openai_api_key)

            # Gather robot capabilities for context
            robots = (await session.execute(select(Robot))).scalars().all()
            robot_context = "\n".join(
                f"- {r.id} ({r.vendor.value} {r.model}): type={r.robot_type.value}, "
                f"capabilities={r.capabilities}, status={r.status.value}"
                for r in robots
            )

            world_ctx = "\n".join(
                f"- {s}" for s in (job.world_statements or [])
            )

            prompt = f"""You are a fleet task planner for service robots (Pudu and Keenon brands).
Given the goals below, generate a dependency-aware task DAG.

Available robots:
{robot_context}

World state:
{world_ctx if world_ctx else "No additional context."}

Goals:
{chr(10).join(f'{i+1}. {g}' for i, g in enumerate(goals))}

Return a JSON array of task nodes:
[{{"id": "t1", "description": "...", "depends_on": [], "robot_type": "delivery|cleaning|logistics", "task_type": "navigate|deliver|clean|transport|custom"}}]

Rules:
- Each node has a unique string id (t1, t2, ...)
- depends_on lists IDs of tasks that must complete first
- Maximize parallelism where possible
- Match robot_type to the task requirements
- task_type must be one of: navigate, deliver, clean, transport, await_load, await_unload, charge, custom
"""

            response = await client.chat.completions.create(
                model=settings.openai_model,
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
                temperature=0.2,
            )

            content = response.choices[0].message.content
            plan_data = json.loads(content)

            # Handle both {nodes: [...]} and [...] formats
            nodes = plan_data if isinstance(plan_data, list) else plan_data.get("nodes", plan_data.get("tasks", []))

            # Convert DAG nodes to Task records
            node_id_to_task_id: dict[str, int] = {}
            tasks = []

            for node in nodes:
                task = Task(
                    description=node["description"],
                    task_type=node.get("task_type", "custom"),
                    status=TaskStatus.PENDING,
                    priority=TaskPriority(job.priority),
                    job_id=job.id,
                    robot_type=node.get("robot_type"),
                    dependency_task_ids=[],  # Will be filled after all tasks created
                )
                session.add(task)
                await session.flush()
                node_id_to_task_id[node["id"]] = task.id
                tasks.append((node, task))

            # Resolve dependencies
            for node, task in tasks:
                dep_ids = [
                    node_id_to_task_id[dep_id]
                    for dep_id in node.get("depends_on", [])
                    if dep_id in node_id_to_task_id
                ]
                task.dependency_task_ids = dep_ids

            job.task_ids = [t.id for _, t in tasks]
            job.total_tasks = len(tasks)
            job.status = JobStatus.PLANNED
            job.planning_strategy = PlanningStrategy.DAG
            await session.commit()

            logger.info("LLM planned %d tasks (DAG) for job %d", len(tasks), job.id)
            return [t for _, t in tasks]

        except Exception as e:
            logger.error("LLM planning failed: %s — falling back", e)
            return await self._fallback_plan(job, goals, session)

    async def _fallback_plan(
        self, job: Job, goals: list[str], session: AsyncSession
    ) -> list[Task]:
        """Simple sequential plan when LLM is unavailable."""
        tasks = []
        prev_id = None
        for i, goal in enumerate(goals):
            task = Task(
                description=goal,
                task_type=TaskType.CUSTOM,
                status=TaskStatus.PENDING,
                priority=TaskPriority(job.priority),
                job_id=job.id,
                dependency_task_ids=[prev_id] if prev_id else [],
            )
            session.add(task)
            await session.flush()
            tasks.append(task)
            prev_id = task.id

        job.task_ids = [t.id for t in tasks]
        job.total_tasks = len(tasks)
        job.status = JobStatus.PLANNED
        await session.commit()
        return tasks
