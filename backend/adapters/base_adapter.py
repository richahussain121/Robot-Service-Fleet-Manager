"""
Base robot adapter — plugin interface inspired by free_fleet's RobotAdapter ABC.
Each vendor adapter implements this interface to normalize robot communication.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum


@dataclass
class RobotTelemetry:
    """Normalized telemetry from any robot vendor."""
    robot_id: str
    battery_soc: float = 0.0          # 0.0 - 1.0
    pose_x: float = 0.0
    pose_y: float = 0.0
    pose_yaw: float = 0.0
    current_map: str = ""
    current_floor: int = 1
    is_online: bool = False
    is_charging: bool = False
    is_moving: bool = False
    error_code: int = 0
    error_message: str = ""
    speed_mps: float = 0.0
    extras: dict = field(default_factory=dict)  # Vendor-specific data


@dataclass
class NavigationGoal:
    """Navigation command for any robot."""
    target_x: float
    target_y: float
    target_yaw: float = 0.0
    target_map: str = ""
    target_floor: int = 1
    location_name: str = ""


class TaskCommand(str, Enum):
    NAVIGATE = "navigate"
    DELIVER = "deliver"
    CLEAN = "clean"
    CHARGE = "charge"
    STOP = "stop"
    PAUSE = "pause"
    RESUME = "resume"
    DOCK = "dock"


@dataclass
class TaskCommandRequest:
    command: TaskCommand
    robot_id: str
    navigation_goal: NavigationGoal | None = None
    payload: dict = field(default_factory=dict)  # Command-specific params


@dataclass
class TaskCommandResponse:
    success: bool
    message: str = ""
    task_id: str = ""  # Vendor-side task ID for tracking


class BaseRobotAdapter(ABC):
    """
    Abstract base adapter — each vendor (Pudu, Keenon, ROS2, generic MQTT)
    implements this interface. Inspired by free_fleet's RobotAdapter pattern.
    """

    vendor_name: str = "generic"

    @abstractmethod
    async def connect(self, config: dict) -> bool:
        """Initialize connection to robot/cloud API."""
        ...

    @abstractmethod
    async def disconnect(self) -> None:
        """Clean up connections."""
        ...

    @abstractmethod
    async def get_telemetry(self, robot_id: str) -> RobotTelemetry:
        """Poll current robot state (pose, battery, status)."""
        ...

    @abstractmethod
    async def send_command(self, request: TaskCommandRequest) -> TaskCommandResponse:
        """Send a task command to the robot."""
        ...

    @abstractmethod
    async def cancel_task(self, robot_id: str, task_id: str) -> bool:
        """Cancel an in-progress task on the robot."""
        ...

    @abstractmethod
    async def get_task_status(self, robot_id: str, task_id: str) -> str:
        """Check status of a dispatched task: pending/executing/completed/failed."""
        ...

    @abstractmethod
    async def list_robots(self) -> list[str]:
        """Discover robots available through this adapter."""
        ...

    async def send_to_charger(self, robot_id: str) -> TaskCommandResponse:
        """Convenience: send robot to its charging station."""
        return await self.send_command(
            TaskCommandRequest(command=TaskCommand.CHARGE, robot_id=robot_id)
        )

    async def emergency_stop(self, robot_id: str) -> TaskCommandResponse:
        """Convenience: immediate stop."""
        return await self.send_command(
            TaskCommandRequest(command=TaskCommand.STOP, robot_id=robot_id)
        )
