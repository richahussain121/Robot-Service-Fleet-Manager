"""Job ORM model — merges ROOSTER job lifecycle with robot-fleet plan concept."""

import enum
from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, Enum, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class JobStatus(str, enum.Enum):
    PENDING = "pending"          # Awaiting allocation
    PLANNED = "planned"          # DAG generated, awaiting execution
    ALLOCATED = "allocated"      # Robots assigned
    ACTIVE = "active"            # Tasks being executed
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class PlanningStrategy(str, enum.Enum):
    MANUAL = "manual"            # User-defined task sequence
    SEQUENTIAL = "sequential"    # ROOSTER-style linear task chain
    DAG = "dag"                  # robot-fleet per-goal DAG
    BIG_DAG = "big_dag"          # robot-fleet cross-goal DAG


class AllocationStrategy(str, enum.Enum):
    CLOSEST = "closest"          # ROOSTER: nearest available robot
    ROUND_ROBIN = "round_robin"  # Simple rotation
    LP = "lp"                    # robot-fleet: linear programming
    LLM = "llm"                  # robot-fleet: GPT-based allocation
    CAPABILITY = "capability"    # Match by robot capabilities


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(256))
    description: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[JobStatus] = mapped_column(
        Enum(JobStatus), default=JobStatus.PENDING
    )

    # Planning (from robot-fleet)
    planning_strategy: Mapped[PlanningStrategy] = mapped_column(
        Enum(PlanningStrategy), default=PlanningStrategy.SEQUENTIAL
    )
    allocation_strategy: Mapped[AllocationStrategy] = mapped_column(
        Enum(AllocationStrategy), default=AllocationStrategy.CLOSEST
    )

    # Task tracking
    task_ids: Mapped[dict] = mapped_column(JSON, default=list)
    total_tasks: Mapped[int] = mapped_column(Integer, default=0)
    completed_tasks: Mapped[int] = mapped_column(Integer, default=0)
    current_task_index: Mapped[int] = mapped_column(Integer, default=0)

    # Robot assignment
    assigned_robot_ids: Mapped[dict] = mapped_column(JSON, default=list)

    # ROOSTER-style order info
    order_keyword: Mapped[str] = mapped_column(String(32), default="")
    order_args: Mapped[dict] = mapped_column(JSON, default=list)

    # World state context (from robot-fleet)
    world_statements: Mapped[dict] = mapped_column(JSON, default=list)

    # Priority (from ROOSTER)
    priority: Mapped[int] = mapped_column(Integer, default=2)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
