"""Job management API endpoints — merges ROOSTER order system with robot-fleet plan system."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.job import Job, JobStatus
from models.schemas import JobCreate, JobOut, OrderRequest, PlanRequest
from services.task_planner import TaskPlanner
from services.task_allocator import TaskAllocator

router = APIRouter(prefix="/api/jobs", tags=["jobs"])

planner = TaskPlanner()
allocator = TaskAllocator()


@router.get("/", response_model=list[JobOut])
async def list_jobs(
    status: str | None = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    query = select(Job)
    if status:
        query = query.where(Job.status == status)
    result = await db.execute(query.order_by(Job.id.desc()).limit(limit))
    return result.scalars().all()


@router.get("/{job_id}", response_model=JobOut)
async def get_job(job_id: int, db: AsyncSession = Depends(get_db)):
    job = await db.get(Job, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.post("/", response_model=JobOut, status_code=201)
async def create_job(data: JobCreate, db: AsyncSession = Depends(get_db)):
    job = Job(**data.model_dump())
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return job


@router.post("/order", response_model=JobOut, status_code=201)
async def create_order(order: OrderRequest, db: AsyncSession = Depends(get_db)):
    """ROOSTER-style quick order: auto-creates job + tasks from keyword."""
    job = Job(
        name=f"{order.keyword} Order",
        description=f"{order.keyword} order with args: {order.args}",
        order_keyword=order.keyword,
        order_args=order.args,
        priority=order.priority,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    # Auto-plan tasks from order keyword
    await planner.plan_from_order(job, db)

    # Auto-allocate if robot specified
    if order.robot_id:
        from models.task import Task
        tasks = (await db.execute(
            select(Task).where(Task.job_id == job.id)
        )).scalars().all()
        for task in tasks:
            task.robot_id = order.robot_id
        job.assigned_robot_ids = [order.robot_id]
        job.status = JobStatus.ALLOCATED
        await db.commit()
    else:
        await allocator.allocate(job, db)

    await db.refresh(job)
    return job


@router.post("/plan", response_model=JobOut, status_code=201)
async def create_plan(plan_req: PlanRequest, db: AsyncSession = Depends(get_db)):
    """robot-fleet-style: LLM-planned DAG from natural language goals."""
    job = await db.get(Job, plan_req.job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    job.planning_strategy = plan_req.planning_strategy
    job.allocation_strategy = plan_req.allocation_strategy
    job.world_statements = plan_req.world_statements

    # Generate task plan
    await planner.plan_with_llm(job, plan_req.goals, db)

    # Allocate tasks to robots
    await allocator.allocate(job, db)

    await db.refresh(job)
    return job


@router.post("/{job_id}/start")
async def start_job(job_id: int, db: AsyncSession = Depends(get_db)):
    """Begin executing a planned/allocated job."""
    from main import task_executor

    job = await db.get(Job, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status not in (JobStatus.PLANNED, JobStatus.ALLOCATED):
        raise HTTPException(
            status_code=400,
            detail=f"Job status must be planned or allocated, got {job.status.value}",
        )

    await task_executor.start_job(job_id)
    return {"detail": f"Job {job_id} execution started"}


@router.post("/{job_id}/cancel")
async def cancel_job(job_id: int, db: AsyncSession = Depends(get_db)):
    from main import task_executor

    job = await db.get(Job, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    await task_executor.cancel_job(job_id)
    return {"detail": f"Job {job_id} cancelled"}


@router.delete("/{job_id}")
async def delete_job(job_id: int, db: AsyncSession = Depends(get_db)):
    job = await db.get(Job, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    await db.delete(job)
    await db.commit()
    return {"detail": "Job deleted"}
