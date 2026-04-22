"""Pydantic schemas for API request/response — merges all four projects' data contracts."""

from datetime import datetime
from pydantic import BaseModel, Field

from models.robot import RobotStatus, RobotType, RobotVendor
from models.task import TaskPriority, TaskStatus, TaskType
from models.job import AllocationStrategy, JobStatus, PlanningStrategy


# ── Robot Schemas ──


class RobotCreate(BaseModel):
    id: str
    name: str
    vendor: RobotVendor
    model: str
    robot_type: RobotType
    capabilities: list[str] = []
    charging_station: str = ""
    load_capacity_kg: float = 0.0
    ip_address: str = ""
    api_endpoint: str = ""
    current_map: str = "floor_1"


class RobotUpdate(BaseModel):
    name: str | None = None
    status: RobotStatus | None = None
    battery_soc: float | None = None
    pose_x: float | None = None
    pose_y: float | None = None
    pose_yaw: float | None = None
    current_map: str | None = None
    current_floor: int | None = None
    ip_address: str | None = None


class RobotOut(BaseModel):
    id: str
    name: str
    vendor: RobotVendor
    model: str
    robot_type: RobotType
    status: RobotStatus
    capabilities: list[str]
    battery_soc: float
    pose_x: float
    pose_y: float
    pose_yaw: float
    current_map: str
    current_floor: int
    current_job_id: str | None
    charging_station: str
    load_capacity_kg: float
    last_heartbeat: datetime
    ip_address: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Task Schemas ──


class TaskCreate(BaseModel):
    description: str
    task_type: TaskType = TaskType.CUSTOM
    priority: TaskPriority = TaskPriority.MEDIUM
    job_id: int | None = None
    robot_id: str | None = None
    robot_type: str | None = None
    dependency_task_ids: list[int] = []
    target_map: str = ""
    target_x: float = 0.0
    target_y: float = 0.0
    target_yaw: float = 0.0
    target_location_name: str = ""
    cleaning_zone_id: str = ""
    estimated_duration_sec: float = 0.0


class TaskOut(BaseModel):
    id: int
    description: str
    task_type: TaskType
    status: TaskStatus
    priority: TaskPriority
    job_id: int | None
    robot_id: str | None
    robot_type: str | None
    dependency_task_ids: list[int]
    target_location_name: str
    result_message: str
    estimated_duration_sec: float
    actual_duration_sec: float
    created_at: datetime
    started_at: datetime | None
    completed_at: datetime | None

    model_config = {"from_attributes": True}


# ── Job Schemas ──


class JobCreate(BaseModel):
    name: str
    description: str = ""
    planning_strategy: PlanningStrategy = PlanningStrategy.SEQUENTIAL
    allocation_strategy: AllocationStrategy = AllocationStrategy.CLOSEST
    priority: int = Field(default=2, ge=1, le=4)
    order_keyword: str = ""
    order_args: list[str] = []
    world_statements: list[str] = []


class JobOut(BaseModel):
    id: int
    name: str
    description: str
    status: JobStatus
    planning_strategy: PlanningStrategy
    allocation_strategy: AllocationStrategy
    task_ids: list[int]
    total_tasks: int
    completed_tasks: int
    current_task_index: int
    assigned_robot_ids: list[str]
    priority: int
    order_keyword: str
    created_at: datetime
    started_at: datetime | None
    completed_at: datetime | None

    model_config = {"from_attributes": True}


# ── Fleet Schemas ──


class FleetSnapshot(BaseModel):
    total_robots: int
    online: int
    standby: int
    charging: int
    executing: int
    error: int
    offline: int
    active_jobs: int
    pending_jobs: int
    completed_jobs_today: int


class DashboardStats(BaseModel):
    fleet: FleetSnapshot
    robots: list[RobotOut]
    active_jobs: list[JobOut]
    recent_tasks: list[TaskOut]


# ── Planning Schemas (from robot-fleet LLM planner) ──


class DAGNode(BaseModel):
    id: str
    description: str
    depends_on: list[str] = []
    robot_type: str | None = None


class DAGPlan(BaseModel):
    nodes: list[DAGNode]


class PlanRequest(BaseModel):
    """Request LLM-based task planning for a job."""
    job_id: int
    goals: list[str]
    world_statements: list[str] = []
    planning_strategy: PlanningStrategy = PlanningStrategy.DAG
    allocation_strategy: AllocationStrategy = AllocationStrategy.CAPABILITY


# ── Order Schemas (ROOSTER-style quick orders) ──


class OrderRequest(BaseModel):
    """Quick order creation — maps to ROOSTER order keywords."""
    keyword: str = Field(description="TRANSPORT, MOVE, CLEAN, DELIVER, LOAD, UNLOAD")
    priority: int = Field(default=2, ge=1, le=4)
    args: list[str] = Field(
        default=[],
        description="Location IDs or zone IDs depending on keyword",
    )
    robot_id: str | None = Field(
        default=None, description="Specific robot, or auto-assign if None"
    )
