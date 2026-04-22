"""Robot management API endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.robot import Robot, RobotStatus
from models.schemas import RobotCreate, RobotOut, RobotUpdate

router = APIRouter(prefix="/api/robots", tags=["robots"])


@router.get("/", response_model=list[RobotOut])
async def list_robots(
    vendor: str | None = None,
    status: str | None = None,
    robot_type: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(Robot)
    if vendor:
        query = query.where(Robot.vendor == vendor)
    if status:
        query = query.where(Robot.status == status)
    if robot_type:
        query = query.where(Robot.robot_type == robot_type)

    result = await db.execute(query.order_by(Robot.name))
    return result.scalars().all()


@router.get("/{robot_id}", response_model=RobotOut)
async def get_robot(robot_id: str, db: AsyncSession = Depends(get_db)):
    robot = await db.get(Robot, robot_id)
    if not robot:
        raise HTTPException(status_code=404, detail="Robot not found")
    return robot


@router.post("/", response_model=RobotOut, status_code=201)
async def create_robot(data: RobotCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.get(Robot, data.id)
    if existing:
        raise HTTPException(status_code=409, detail="Robot already exists")

    robot = Robot(**data.model_dump())
    db.add(robot)
    await db.commit()
    await db.refresh(robot)
    return robot


@router.patch("/{robot_id}", response_model=RobotOut)
async def update_robot(
    robot_id: str, data: RobotUpdate, db: AsyncSession = Depends(get_db)
):
    robot = await db.get(Robot, robot_id)
    if not robot:
        raise HTTPException(status_code=404, detail="Robot not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(robot, field, value)

    await db.commit()
    await db.refresh(robot)
    return robot


@router.delete("/{robot_id}")
async def delete_robot(robot_id: str, db: AsyncSession = Depends(get_db)):
    robot = await db.get(Robot, robot_id)
    if not robot:
        raise HTTPException(status_code=404, detail="Robot not found")
    await db.delete(robot)
    await db.commit()
    return {"detail": "Robot deleted"}


@router.post("/{robot_id}/command")
async def send_command(
    robot_id: str,
    command: dict,
    db: AsyncSession = Depends(get_db),
):
    """Send a direct command to a robot (stop, charge, etc.)."""
    from main import fleet_manager

    robot = await db.get(Robot, robot_id)
    if not robot:
        raise HTTPException(status_code=404, detail="Robot not found")

    adapter = fleet_manager.get_adapter(robot_id)
    if not adapter:
        raise HTTPException(status_code=503, detail="No adapter for robot")

    from adapters.base_adapter import TaskCommand, TaskCommandRequest

    cmd = TaskCommand(command.get("command", "stop"))
    request = TaskCommandRequest(command=cmd, robot_id=robot_id, payload=command)
    response = await adapter.send_command(request)

    return {"success": response.success, "message": response.message}
