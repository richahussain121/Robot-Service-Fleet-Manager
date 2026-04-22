"""Fleet dashboard API endpoints."""

from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.robot import Robot, RobotStatus
from models.task import Task, TaskStatus
from models.job import Job, JobStatus
from models.schemas import DashboardStats, FleetSnapshot, RobotOut, JobOut, TaskOut

router = APIRouter(prefix="/api/fleet", tags=["fleet"])


@router.get("/dashboard", response_model=DashboardStats)
async def get_dashboard(db: AsyncSession = Depends(get_db)):
    """Full dashboard snapshot — inspired by transact fleet overview."""
    robots = (await db.execute(select(Robot).order_by(Robot.name))).scalars().all()

    status_counts = {}
    for r in robots:
        status_counts[r.status.value] = status_counts.get(r.status.value, 0) + 1

    active_jobs = (await db.execute(
        select(Job).where(Job.status.in_([JobStatus.ACTIVE, JobStatus.ALLOCATED]))
        .order_by(Job.id.desc()).limit(20)
    )).scalars().all()

    recent_tasks = (await db.execute(
        select(Task).order_by(Task.id.desc()).limit(20)
    )).scalars().all()

    online = (
        status_counts.get("standby", 0)
        + status_counts.get("executing", 0)
        + status_counts.get("assigned", 0)
        + status_counts.get("charging", 0)
    )

    return DashboardStats(
        fleet=FleetSnapshot(
            total_robots=len(robots),
            online=online,
            standby=status_counts.get("standby", 0),
            charging=status_counts.get("charging", 0),
            executing=status_counts.get("executing", 0),
            error=status_counts.get("error", 0),
            offline=status_counts.get("offline", 0),
            active_jobs=len(active_jobs),
            pending_jobs=0,
            completed_jobs_today=0,
        ),
        robots=robots,
        active_jobs=active_jobs,
        recent_tasks=recent_tasks,
    )


@router.get("/stats")
async def get_stats(db: AsyncSession = Depends(get_db)):
    """Quick fleet statistics."""
    total = (await db.execute(select(func.count(Robot.id)))).scalar() or 0
    online = (await db.execute(
        select(func.count(Robot.id)).where(Robot.status != RobotStatus.OFFLINE)
    )).scalar() or 0
    active = (await db.execute(
        select(func.count(Job.id)).where(Job.status == JobStatus.ACTIVE)
    )).scalar() or 0

    return {
        "total_robots": total,
        "online_robots": online,
        "active_jobs": active,
    }
