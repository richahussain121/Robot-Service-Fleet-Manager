"""
Task Executor — merges robot-fleet's async DAG executor with ROOSTER's
sequential job execution and callback-based task completion.
"""

import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from adapters.base_adapter import (
    NavigationGoal,
    TaskCommand,
    TaskCommandRequest,
)
from database import async_session
from models.robot import Robot, RobotStatus
from models.task import Task, TaskStatus, TaskType
from models.job import Job, JobStatus

logger = logging.getLogger(__name__)


class TaskExecutor:
    """Executes job tasks — supports both sequential and DAG execution."""

    def __init__(self, fleet_manager):
        self._fleet_manager = fleet_manager
        self._active_jobs: dict[int, asyncio.Task] = {}

    async def start_job(self, job_id: int):
        """Begin executing a job's tasks."""
        if job_id in self._active_jobs:
            logger.warning("Job %d already executing", job_id)
            return

        task = asyncio.create_task(self._execute_job(job_id))
        self._active_jobs[job_id] = task

    async def cancel_job(self, job_id: int):
        """Cancel an executing job."""
        if job_id in self._active_jobs:
            self._active_jobs[job_id].cancel()
            del self._active_jobs[job_id]

        async with async_session() as session:
            job = await session.get(Job, job_id)
            if job:
                job.status = JobStatus.CANCELLED
                # Cancel all pending tasks
                tasks = (await session.execute(
                    select(Task).where(
                        Task.job_id == job_id,
                        Task.status.in_([TaskStatus.PENDING, TaskStatus.QUEUED, TaskStatus.IN_PROGRESS]),
                    )
                )).scalars().all()
                for task in tasks:
                    task.status = TaskStatus.CANCELLED
                    if task.robot_id:
                        adapter = self._fleet_manager.get_adapter(task.robot_id)
                        if adapter:
                            await adapter.cancel_task(task.robot_id, "")
                await session.commit()

    async def _execute_job(self, job_id: int):
        """
        Execute all tasks in a job respecting DAG dependencies.
        Merges robot-fleet's parallel DAG execution with ROOSTER's sequential flow.
        """
        try:
            async with async_session() as session:
                job = await session.get(Job, job_id)
                if not job:
                    return

                job.status = JobStatus.ACTIVE
                job.started_at = datetime.now(timezone.utc)
                await session.commit()

                tasks = (await session.execute(
                    select(Task).where(Task.job_id == job_id).order_by(Task.id)
                )).scalars().all()

                if not tasks:
                    job.status = JobStatus.COMPLETED
                    job.completed_at = datetime.now(timezone.utc)
                    await session.commit()
                    return

                # Build dependency graph
                task_map = {t.id: t for t in tasks}
                completed_ids: set[int] = set()

                while len(completed_ids) < len(tasks):
                    # Find ready tasks (all deps completed)
                    ready = [
                        t for t in tasks
                        if t.id not in completed_ids
                        and t.status not in (TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED)
                        and all(
                            dep_id in completed_ids
                            for dep_id in (t.dependency_task_ids or [])
                        )
                    ]

                    if not ready:
                        # Check for deadlock or all done
                        remaining = [
                            t for t in tasks if t.id not in completed_ids
                        ]
                        if all(t.status in (TaskStatus.FAILED, TaskStatus.CANCELLED) for t in remaining):
                            break
                        await asyncio.sleep(1)
                        # Refresh task states
                        for t in remaining:
                            await session.refresh(t)
                        continue

                    # Execute ready tasks in parallel (robot-fleet DAG pattern)
                    exec_tasks = [
                        self._execute_task(t, session) for t in ready
                    ]
                    results = await asyncio.gather(*exec_tasks, return_exceptions=True)

                    for task, result in zip(ready, results):
                        await session.refresh(task)
                        if isinstance(result, Exception):
                            task.status = TaskStatus.FAILED
                            task.result_message = str(result)
                            logger.error("Task %d failed: %s", task.id, result)
                        completed_ids.add(task.id)
                        job.completed_tasks = len(completed_ids)

                    await session.commit()

                # Determine final job status
                await session.refresh(job)
                failed_count = sum(
                    1 for t in tasks if t.status == TaskStatus.FAILED
                )
                if failed_count > 0:
                    job.status = JobStatus.FAILED
                else:
                    job.status = JobStatus.COMPLETED
                job.completed_at = datetime.now(timezone.utc)

                # Release robots (ROOSTER: unassign_job_from_mex)
                for robot_id in (job.assigned_robot_ids or []):
                    robot = await session.get(Robot, robot_id)
                    if robot:
                        robot.current_job_id = None
                        robot.status = RobotStatus.STANDBY

                await session.commit()
                logger.info("Job %d completed with status: %s", job_id, job.status.value)

        except asyncio.CancelledError:
            logger.info("Job %d cancelled", job_id)
        except Exception as e:
            logger.error("Job %d execution error: %s", job_id, e)
            async with async_session() as session:
                job = await session.get(Job, job_id)
                if job:
                    job.status = JobStatus.FAILED
                    await session.commit()
        finally:
            self._active_jobs.pop(job_id, None)

    async def _execute_task(self, task: Task, session: AsyncSession):
        """Execute a single task by dispatching to the assigned robot's adapter."""
        task.status = TaskStatus.IN_PROGRESS
        task.started_at = datetime.now(timezone.utc)
        await session.commit()

        robot_id = task.robot_id
        if not robot_id:
            task.status = TaskStatus.FAILED
            task.result_message = "No robot assigned"
            return

        adapter = self._fleet_manager.get_adapter(robot_id)
        if not adapter:
            task.status = TaskStatus.FAILED
            task.result_message = f"No adapter found for robot {robot_id}"
            return

        # Mark robot as executing (ROOSTER: change_mex_status)
        robot = await session.get(Robot, robot_id)
        if robot:
            robot.status = RobotStatus.EXECUTING
            robot.current_job_id = str(task.job_id)
            await session.commit()

        # Build command based on task type
        command_map = {
            TaskType.NAVIGATE: TaskCommand.NAVIGATE,
            TaskType.DELIVER: TaskCommand.DELIVER,
            TaskType.CLEAN: TaskCommand.CLEAN,
            TaskType.TRANSPORT: TaskCommand.DELIVER,
            TaskType.CHARGE: TaskCommand.CHARGE,
            TaskType.CUSTOM: TaskCommand.NAVIGATE,
        }

        command = command_map.get(task.task_type, TaskCommand.NAVIGATE)
        nav_goal = NavigationGoal(
            target_x=task.target_x,
            target_y=task.target_y,
            target_yaw=task.target_yaw,
            target_map=task.target_map,
            location_name=task.target_location_name,
        )

        request = TaskCommandRequest(
            command=command,
            robot_id=robot_id,
            navigation_goal=nav_goal,
            payload={"task_id": task.id, "description": task.description},
        )

        # Dispatch command
        response = await adapter.send_command(request)

        if not response.success:
            task.status = TaskStatus.FAILED
            task.result_message = response.message
            await session.commit()
            return

        # Poll for completion (free_fleet pattern: _is_navigation_done)
        vendor_task_id = response.task_id
        poll_interval = 2.0
        timeout = max(task.estimated_duration_sec * 2, 300)  # At least 5 min
        elapsed = 0.0

        while elapsed < timeout:
            await asyncio.sleep(poll_interval)
            elapsed += poll_interval

            status = await adapter.get_task_status(robot_id, vendor_task_id)

            if status == "completed":
                task.status = TaskStatus.COMPLETED
                task.completed_at = datetime.now(timezone.utc)
                task.actual_duration_sec = elapsed
                task.result_message = "Task completed successfully"
                await session.commit()
                return
            elif status == "failed":
                task.status = TaskStatus.FAILED
                task.result_message = "Robot reported task failure"
                task.requires_replan = True
                await session.commit()
                return
            elif status == "cancelled":
                task.status = TaskStatus.CANCELLED
                await session.commit()
                return

        # Timeout
        task.status = TaskStatus.FAILED
        task.result_message = f"Task timed out after {timeout}s"
        await session.commit()
