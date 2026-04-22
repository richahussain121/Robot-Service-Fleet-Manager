"""Robot ORM model — merges free_fleet robot adapter registry with robot-fleet PostgreSQL persistence."""

import enum
from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, Enum, Float, String
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class RobotVendor(str, enum.Enum):
    PUDU = "pudu"
    KEENON = "keenon"
    GENERIC = "generic"


class RobotType(str, enum.Enum):
    DELIVERY = "delivery"
    CLEANING = "cleaning"
    LOGISTICS = "logistics"
    DISINFECTION = "disinfection"
    MULTIPURPOSE = "multipurpose"


class RobotStatus(str, enum.Enum):
    STANDBY = "standby"          # Idle, available for tasks (ROOSTER)
    CHARGING = "charging"        # At charging station
    ASSIGNED = "assigned"        # Job allocated, not yet executing
    EXECUTING = "executing"      # Actively running a task
    RETURNING = "returning"      # Returning to charger / home
    ERROR = "error"              # Fault state
    OFFLINE = "offline"          # No heartbeat
    MAINTENANCE = "maintenance"  # Manual maintenance mode


class Robot(Base):
    __tablename__ = "robots"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(128))
    vendor: Mapped[RobotVendor] = mapped_column(Enum(RobotVendor))
    model: Mapped[str] = mapped_column(String(64))  # e.g. "T300", "W3", "C40"
    robot_type: Mapped[RobotType] = mapped_column(Enum(RobotType))
    status: Mapped[RobotStatus] = mapped_column(
        Enum(RobotStatus), default=RobotStatus.OFFLINE
    )

    # Capabilities list (from free_fleet plugin system + robot-fleet)
    capabilities: Mapped[dict] = mapped_column(JSON, default=list)

    # Telemetry (from free_fleet robot_adapter state polling)
    battery_soc: Mapped[float] = mapped_column(Float, default=0.0)
    pose_x: Mapped[float] = mapped_column(Float, default=0.0)
    pose_y: Mapped[float] = mapped_column(Float, default=0.0)
    pose_yaw: Mapped[float] = mapped_column(Float, default=0.0)
    current_map: Mapped[str] = mapped_column(String(64), default="floor_1")
    current_floor: Mapped[int] = mapped_column(default=1)

    # Assignment
    current_job_id: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # Configuration
    charging_station: Mapped[str] = mapped_column(String(64), default="")
    load_capacity_kg: Mapped[float] = mapped_column(Float, default=0.0)

    # Connection
    last_heartbeat: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    ip_address: Mapped[str] = mapped_column(String(45), default="")
    api_endpoint: Mapped[str] = mapped_column(String(256), default="")

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
