"""Task ORM model — merges ROOSTER task state machine with robot-fleet DAG dependencies."""

import enum
from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, Enum, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class TaskStatus(str, enum.Enum):
    PENDING = "pending"
    QUEUED = "queued"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class TaskPriority(int, enum.Enum):
    LOW = 1
    MEDIUM = 2
    HIGH = 3
    CRITICAL = 4


class TaskType(str, enum.Enum):
    # From ROOSTER
    NAVIGATE = "navigate"              # Move to location
    DELIVER = "deliver"                # Pick up and deliver
    CLEAN = "clean"                    # Clean area
    TRANSPORT = "transport"            # Full transport cycle
    AWAIT_LOAD = "await_load"          # Wait for loading
    AWAIT_UNLOAD = "await_unload"      # Wait for unloading
    CHARGE = "charge"                  # Return to charger
    # From robot-fleet
    CUSTOM = "custom"                  # LLM-planned custom action


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    description: Mapped[str] = mapped_column(Text)
    task_type: Mapped[TaskType] = mapped_column(Enum(TaskType), default=TaskType.CUSTOM)
    status: Mapped[TaskStatus] = mapped_column(
        Enum(TaskStatus), default=TaskStatus.PENDING
    )
    priority: Mapped[TaskPriority] = mapped_column(
        Enum(TaskPriority), default=TaskPriority.MEDIUM
    )

    # Assignment
    job_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    robot_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    robot_type: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # DAG dependencies (from robot-fleet)
    dependency_task_ids: Mapped[dict] = mapped_column(JSON, default=list)

    # Navigation target
    target_map: Mapped[str] = mapped_column(String(64), default="")
    target_x: Mapped[float] = mapped_column(Float, default=0.0)
    target_y: Mapped[float] = mapped_column(Float, default=0.0)
    target_yaw: Mapped[float] = mapped_column(Float, default=0.0)
    target_location_name: Mapped[str] = mapped_column(String(128), default="")

    # Cleaning-specific
    cleaning_zone_id: Mapped[str] = mapped_column(String(64), default="")

    # Execution result
    result_message: Mapped[str] = mapped_column(Text, default="")
    requires_replan: Mapped[bool] = mapped_column(default=False)

    # Timing
    estimated_duration_sec: Mapped[float] = mapped_column(Float, default=0.0)
    actual_duration_sec: Mapped[float] = mapped_column(Float, default=0.0)

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
