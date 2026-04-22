"""
Fleet Manager — merges ROOSTER's mex_sentinel (fleet state repository) with
free_fleet's update loop (periodic robot polling) and transact's real-time monitoring.
"""

import asyncio
import logging
from datetime import datetime, timezone, timedelta

import yaml
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from adapters.base_adapter import BaseRobotAdapter
from adapters.pudu_adapter import PuduAdapter
from adapters.keenon_adapter import KeenonAdapter
from adapters.mqtt_adapter import MqttRobotAdapter
from config import settings
from database import async_session
from models.robot import Robot, RobotStatus, RobotVendor
from models.task import Task, TaskStatus
from models.job import Job, JobStatus

logger = logging.getLogger(__name__)


class FleetManager:
    """Central fleet state manager — single source of truth for all robots."""

    def __init__(self):
        self._adapters: dict[str, BaseRobotAdapter] = {}
        self._robot_adapter_map: dict[str, str] = {}  # robot_id -> vendor
        self._running = False
        self._update_task: asyncio.Task | None = None
        self._subscribers: list[asyncio.Queue] = []  # WebSocket broadcast queues

    async def initialize(self):
        """Load vendor configs and initialize adapters."""
        vendor_configs = {
            "pudu": ("config/pudu/config.yaml", PuduAdapter),
            "keenon": ("config/keenon/config.yaml", KeenonAdapter),
        }

        for vendor, (config_path, adapter_cls) in vendor_configs.items():
            try:
                with open(config_path, "r") as f:
                    config = yaml.safe_load(f)
                adapter = adapter_cls()
                await adapter.connect(config)
                self._adapters[vendor] = adapter

                # Map robot IDs to their vendor adapter
                for robot_id in config.get("robots", {}):
                    self._robot_adapter_map[robot_id] = vendor

                logger.info("Initialized %s adapter with %d robots",
                            vendor, len(config.get("robots", {})))
            except FileNotFoundError:
                logger.info("No config for %s, skipping", vendor)
            except Exception as e:
                logger.error("Failed to initialize %s adapter: %s", vendor, e)

        # Initialize MQTT adapter for generic robots
        mqtt_adapter = MqttRobotAdapter()
        await mqtt_adapter.connect({
            "broker": settings.mqtt_broker,
            "port": settings.mqtt_port,
        })
        self._adapters["mqtt"] = mqtt_adapter

        # Sync configured robots to database
        await self._sync_robots_to_db()

    async def _sync_robots_to_db(self):
        """Ensure all configured robots exist in the database."""
        for vendor_name, adapter in self._adapters.items():
            if vendor_name == "mqtt":
                continue
            try:
                config_path = f"config/{vendor_name}/config.yaml"
                with open(config_path, "r") as f:
                    config = yaml.safe_load(f)

                async with async_session() as session:
                    for robot_id, robot_cfg in config.get("robots", {}).items():
                        existing = await session.get(Robot, robot_id)
                        if not existing:
                            robot = Robot(
                                id=robot_id,
                                name=robot_id.replace("_", " ").title(),
                                vendor=RobotVendor(vendor_name),
                                model=robot_cfg.get("model", ""),
                                robot_type=robot_cfg.get("type", "multipurpose"),
                                capabilities=robot_cfg.get("capabilities", []),
                                charging_station=robot_cfg.get("charging_station", ""),
                                load_capacity_kg=robot_cfg.get("load_capacity_kg", 0),
                                current_map=robot_cfg.get("initial_map", "floor_1"),
                                status=RobotStatus.OFFLINE,
                            )
                            session.add(robot)
                            logger.info("Registered robot: %s (%s %s)",
                                        robot_id, vendor_name, robot_cfg.get("model"))
                    await session.commit()
            except FileNotFoundError:
                pass

    async def start_update_loop(self):
        """Start periodic robot state polling (from free_fleet's update_loop pattern)."""
        self._running = True
        self._update_task = asyncio.create_task(self._update_loop())
        logger.info("Fleet update loop started at %.1f Hz", settings.robot_state_update_hz)

    async def stop_update_loop(self):
        self._running = False
        if self._update_task:
            self._update_task.cancel()
            try:
                await self._update_task
            except asyncio.CancelledError:
                pass

    async def _update_loop(self):
        """Poll all robots and update DB — inspired by free_fleet's update_robot()."""
        interval = 1.0 / settings.robot_state_update_hz
        while self._running:
            try:
                async with async_session() as session:
                    robots = (await session.execute(select(Robot))).scalars().all()

                    for robot in robots:
                        vendor = self._robot_adapter_map.get(robot.id, "mqtt")
                        adapter = self._adapters.get(vendor)
                        if not adapter:
                            continue

                        telemetry = await adapter.get_telemetry(robot.id)

                        # Update robot state
                        robot.battery_soc = telemetry.battery_soc
                        robot.pose_x = telemetry.pose_x
                        robot.pose_y = telemetry.pose_y
                        robot.pose_yaw = telemetry.pose_yaw
                        if telemetry.current_map:
                            robot.current_map = telemetry.current_map
                        robot.current_floor = telemetry.current_floor

                        # Status determination (from transact heartbeat logic)
                        now = datetime.now(timezone.utc)
                        if telemetry.is_online:
                            robot.last_heartbeat = now
                            if telemetry.error_code != 0:
                                robot.status = RobotStatus.ERROR
                            elif telemetry.is_charging:
                                robot.status = RobotStatus.CHARGING
                            elif telemetry.is_moving:
                                robot.status = RobotStatus.EXECUTING
                            elif robot.current_job_id:
                                robot.status = RobotStatus.ASSIGNED
                            else:
                                robot.status = RobotStatus.STANDBY
                        else:
                            # Heartbeat timeout check (transact pattern)
                            if robot.last_heartbeat:
                                elapsed = (now - robot.last_heartbeat).total_seconds()
                                if elapsed > 69:
                                    robot.status = RobotStatus.OFFLINE

                    await session.commit()

                # Broadcast update to WebSocket subscribers
                snapshot = await self.get_fleet_snapshot()
                await self._broadcast(snapshot)

            except Exception as e:
                logger.error("Fleet update error: %s", e)

            await asyncio.sleep(interval)

    async def get_fleet_snapshot(self) -> dict:
        """Get current fleet state — merges ROOSTER MexListInfo with transact dashboard."""
        async with async_session() as session:
            robots = (await session.execute(select(Robot))).scalars().all()

            status_counts = {}
            for r in robots:
                status_counts[r.status.value] = status_counts.get(r.status.value, 0) + 1

            # Count jobs
            active_jobs = (await session.execute(
                select(func.count(Job.id)).where(Job.status == JobStatus.ACTIVE)
            )).scalar() or 0
            pending_jobs = (await session.execute(
                select(func.count(Job.id)).where(Job.status == JobStatus.PENDING)
            )).scalar() or 0

            today_start = datetime.now(timezone.utc).replace(
                hour=0, minute=0, second=0, microsecond=0
            )
            completed_today = (await session.execute(
                select(func.count(Job.id)).where(
                    Job.status == JobStatus.COMPLETED,
                    Job.completed_at >= today_start,
                )
            )).scalar() or 0

            return {
                "type": "fleet_update",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "fleet": {
                    "total_robots": len(robots),
                    "online": status_counts.get("standby", 0)
                        + status_counts.get("executing", 0)
                        + status_counts.get("assigned", 0)
                        + status_counts.get("charging", 0),
                    "standby": status_counts.get("standby", 0),
                    "charging": status_counts.get("charging", 0),
                    "executing": status_counts.get("executing", 0),
                    "error": status_counts.get("error", 0),
                    "offline": status_counts.get("offline", 0),
                    "active_jobs": active_jobs,
                    "pending_jobs": pending_jobs,
                    "completed_jobs_today": completed_today,
                },
                "robots": [
                    {
                        "id": r.id,
                        "name": r.name,
                        "vendor": r.vendor.value,
                        "model": r.model,
                        "type": r.robot_type.value,
                        "status": r.status.value,
                        "battery_soc": r.battery_soc,
                        "pose": {"x": r.pose_x, "y": r.pose_y, "yaw": r.pose_yaw},
                        "map": r.current_map,
                        "floor": r.current_floor,
                        "job_id": r.current_job_id,
                    }
                    for r in robots
                ],
            }

    def get_adapter(self, robot_id: str) -> BaseRobotAdapter | None:
        vendor = self._robot_adapter_map.get(robot_id, "mqtt")
        return self._adapters.get(vendor)

    def subscribe(self) -> asyncio.Queue:
        """Subscribe to real-time fleet updates (for WebSocket)."""
        queue: asyncio.Queue = asyncio.Queue(maxsize=50)
        self._subscribers.append(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue):
        self._subscribers.remove(queue)

    async def _broadcast(self, data: dict):
        for queue in self._subscribers:
            try:
                queue.put_nowait(data)
            except asyncio.QueueFull:
                pass  # Drop old updates for slow consumers

    async def shutdown(self):
        await self.stop_update_loop()
        for adapter in self._adapters.values():
            await adapter.disconnect()
