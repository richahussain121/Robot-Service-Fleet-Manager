"""
Task Allocator — merges ROOSTER's closest-MEx distance-based allocation with
robot-fleet's LP (linear programming) and LLM-based allocation strategies.
"""

import json
import logging
import math

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from models.robot import Robot, RobotStatus
from models.task import Task, TaskStatus
from models.job import Job, JobStatus, AllocationStrategy

logger = logging.getLogger(__name__)


class TaskAllocator:
    """Assigns tasks to robots using configurable strategies."""

    async def allocate(self, job: Job, session: AsyncSession) -> dict[int, str]:
        """Allocate job tasks to robots. Returns {task_id: robot_id}."""
        strategy = AllocationStrategy(job.allocation_strategy)

        allocators = {
            AllocationStrategy.CLOSEST: self._allocate_closest,
            AllocationStrategy.ROUND_ROBIN: self._allocate_round_robin,
            AllocationStrategy.CAPABILITY: self._allocate_capability,
            AllocationStrategy.LP: self._allocate_lp,
            AllocationStrategy.LLM: self._allocate_llm,
        }

        allocator_fn = allocators.get(strategy, self._allocate_capability)
        allocation = await allocator_fn(job, session)

        # Apply allocation to tasks
        assigned_robots = set()
        for task_id, robot_id in allocation.items():
            task = await session.get(Task, task_id)
            if task:
                task.robot_id = robot_id
                assigned_robots.add(robot_id)

        job.assigned_robot_ids = list(assigned_robots)
        job.status = JobStatus.ALLOCATED
        await session.commit()

        logger.info("Allocated job %d: %d tasks -> %d robots (%s strategy)",
                     job.id, len(allocation), len(assigned_robots), strategy.value)
        return allocation

    async def _get_available_robots(self, session: AsyncSession) -> list[Robot]:
        """Get robots in STANDBY status (ROOSTER pattern)."""
        result = await session.execute(
            select(Robot).where(Robot.status == RobotStatus.STANDBY)
        )
        return list(result.scalars().all())

    async def _get_all_robots(self, session: AsyncSession) -> list[Robot]:
        result = await session.execute(
            select(Robot).where(Robot.status != RobotStatus.OFFLINE)
        )
        return list(result.scalars().all())

    # ── ROOSTER: Closest robot by Euclidean distance ──

    async def _allocate_closest(
        self, job: Job, session: AsyncSession
    ) -> dict[int, str]:
        """ROOSTER's choose_closest_mex — assign to nearest available robot."""
        available = await self._get_available_robots(session)
        if not available:
            logger.warning("No available robots for closest allocation")
            return {}

        tasks = (await session.execute(
            select(Task).where(Task.job_id == job.id).order_by(Task.id)
        )).scalars().all()

        allocation = {}
        for task in tasks:
            # Find closest robot to task target
            best_robot = None
            best_dist = float("inf")

            for robot in available:
                dist = math.sqrt(
                    (robot.pose_x - task.target_x) ** 2
                    + (robot.pose_y - task.target_y) ** 2
                )
                if dist < best_dist:
                    best_dist = dist
                    best_robot = robot

            if best_robot:
                allocation[task.id] = best_robot.id
                # For sequential jobs, all tasks go to same robot
                if job.planning_strategy.value in ("manual", "sequential"):
                    for t in tasks:
                        allocation[t.id] = best_robot.id
                    break

        return allocation

    # ── Round Robin ──

    async def _allocate_round_robin(
        self, job: Job, session: AsyncSession
    ) -> dict[int, str]:
        available = await self._get_available_robots(session)
        if not available:
            return {}

        tasks = (await session.execute(
            select(Task).where(Task.job_id == job.id).order_by(Task.id)
        )).scalars().all()

        allocation = {}
        for i, task in enumerate(tasks):
            robot = available[i % len(available)]
            allocation[task.id] = robot.id
        return allocation

    # ── Capability matching ──

    async def _allocate_capability(
        self, job: Job, session: AsyncSession
    ) -> dict[int, str]:
        """Match tasks to robots based on required capabilities."""
        robots = await self._get_all_robots(session)
        tasks = (await session.execute(
            select(Task).where(Task.job_id == job.id).order_by(Task.id)
        )).scalars().all()

        # Map task types to required capabilities
        type_to_capability = {
            "navigate": ["navigate"],
            "deliver": ["navigate", "deliver"],
            "clean": ["navigate", "sweep", "mop", "vacuum"],
            "transport": ["navigate", "deliver"],
            "charge": [],
            "await_load": [],
            "await_unload": [],
            "custom": [],
        }

        allocation = {}
        for task in tasks:
            required = set(type_to_capability.get(task.task_type.value, []))

            # Also check robot_type hint from LLM planner
            candidates = []
            for robot in robots:
                robot_caps = set(robot.capabilities or [])
                if required.issubset(robot_caps):
                    # Prefer matching robot type
                    type_match = (
                        task.robot_type
                        and robot.robot_type.value == task.robot_type
                    )
                    is_available = robot.status == RobotStatus.STANDBY
                    score = (2 if type_match else 0) + (1 if is_available else 0)
                    candidates.append((score, robot))

            candidates.sort(key=lambda x: -x[0])
            if candidates:
                allocation[task.id] = candidates[0][1].id
            elif robots:
                # Fallback: assign any available robot
                allocation[task.id] = robots[0].id

        return allocation

    # ── robot-fleet: Linear Programming allocation ──

    async def _allocate_lp(
        self, job: Job, session: AsyncSession
    ) -> dict[int, str]:
        """LP-based allocation using PuLP — minimizes task imbalance across robots."""
        try:
            from pulp import LpMinimize, LpProblem, LpVariable, lpSum, PULP_CBC_CMD

            robots = await self._get_available_robots(session)
            tasks = (await session.execute(
                select(Task).where(Task.job_id == job.id).order_by(Task.id)
            )).scalars().all()

            if not robots or not tasks:
                return {}

            prob = LpProblem("task_allocation", LpMinimize)

            # Binary variables: x[t][r] = 1 if task t assigned to robot r
            x = {}
            for task in tasks:
                for robot in robots:
                    x[task.id, robot.id] = LpVariable(
                        f"x_{task.id}_{robot.id}", cat="Binary"
                    )

            # Each task assigned to exactly one robot
            for task in tasks:
                prob += lpSum(x[task.id, r.id] for r in robots) == 1

            # Minimize max load (proxy: minimize total distance)
            for task in tasks:
                for robot in robots:
                    dist = math.sqrt(
                        (robot.pose_x - task.target_x) ** 2
                        + (robot.pose_y - task.target_y) ** 2
                    )
                    prob += dist * x[task.id, robot.id]

            prob.solve(PULP_CBC_CMD(msg=0))

            allocation = {}
            for task in tasks:
                for robot in robots:
                    if x[task.id, robot.id].varValue and x[task.id, robot.id].varValue > 0.5:
                        allocation[task.id] = robot.id
            return allocation

        except ImportError:
            logger.warning("PuLP not installed — falling back to capability allocation")
            return await self._allocate_capability(job, session)

    # ── robot-fleet: LLM-based allocation ──

    async def _allocate_llm(
        self, job: Job, session: AsyncSession
    ) -> dict[int, str]:
        """Use GPT to allocate tasks to robots with contextual reasoning."""
        if not settings.openai_api_key:
            return await self._allocate_capability(job, session)

        try:
            import openai

            client = openai.AsyncOpenAI(api_key=settings.openai_api_key)

            robots = await self._get_all_robots(session)
            tasks = (await session.execute(
                select(Task).where(Task.job_id == job.id).order_by(Task.id)
            )).scalars().all()

            prompt = f"""Allocate these tasks to available robots.

Tasks:
{chr(10).join(f"- task_id={t.id}: {t.description} (type={t.task_type.value})" for t in tasks)}

Robots:
{chr(10).join(f"- robot_id={r.id}: {r.vendor.value} {r.model}, type={r.robot_type.value}, status={r.status.value}, capabilities={r.capabilities}" for r in robots)}

Return JSON: {{"allocations": [{{"task_id": <int>, "robot_id": "<str>"}}]}}
Match capabilities. Prefer STANDBY robots. Balance load."""

            response = await client.chat.completions.create(
                model=settings.openai_model,
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
                temperature=0.2,
            )

            data = json.loads(response.choices[0].message.content)
            return {
                a["task_id"]: a["robot_id"]
                for a in data.get("allocations", [])
            }

        except Exception as e:
            logger.error("LLM allocation failed: %s", e)
            return await self._allocate_capability(job, session)
