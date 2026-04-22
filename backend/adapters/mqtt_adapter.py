"""
Generic MQTT robot adapter — for any robot communicating via MQTT topics.
Inspired by free_fleet's Zenoh/MQTT communication layer.
Topic convention:
  fleet/{robot_id}/telemetry   (robot publishes)
  fleet/{robot_id}/command     (server publishes)
  fleet/{robot_id}/status      (robot publishes task status)
"""

import json
import logging
import asyncio
from datetime import datetime, timezone

import paho.mqtt.client as mqtt

from adapters.base_adapter import (
    BaseRobotAdapter,
    RobotTelemetry,
    TaskCommand,
    TaskCommandRequest,
    TaskCommandResponse,
)

logger = logging.getLogger(__name__)


class MqttRobotAdapter(BaseRobotAdapter):
    vendor_name = "mqtt_generic"

    def __init__(self):
        self._client: mqtt.Client | None = None
        self._broker: str = "localhost"
        self._port: int = 1883
        self._telemetry_cache: dict[str, RobotTelemetry] = {}
        self._task_status_cache: dict[str, str] = {}  # "robot_id:task_id" -> status
        self._discovered_robots: set[str] = set()
        self._connected = False

    async def connect(self, config: dict) -> bool:
        self._broker = config.get("broker", "localhost")
        self._port = config.get("port", 1883)

        self._client = mqtt.Client(
            client_id="fleet_manager",
            callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
        )
        self._client.on_connect = self._on_connect
        self._client.on_message = self._on_message

        try:
            self._client.connect(self._broker, self._port, keepalive=60)
            self._client.loop_start()
            self._connected = True
            logger.info("MQTT adapter connected to %s:%d", self._broker, self._port)
            return True
        except Exception as e:
            logger.error("MQTT connect failed: %s", e)
            return False

    def _on_connect(self, client, userdata, flags, rc, properties=None):
        # Subscribe to all robot telemetry and status topics
        client.subscribe("fleet/+/telemetry")
        client.subscribe("fleet/+/status")
        client.subscribe("fleet/+/heartbeat")
        logger.info("MQTT subscriptions active")

    def _on_message(self, client, userdata, msg):
        try:
            parts = msg.topic.split("/")
            if len(parts) < 3:
                return
            robot_id = parts[1]
            msg_type = parts[2]
            payload = json.loads(msg.payload.decode())

            self._discovered_robots.add(robot_id)

            if msg_type == "telemetry":
                self._telemetry_cache[robot_id] = RobotTelemetry(
                    robot_id=robot_id,
                    battery_soc=payload.get("battery_soc", 0.0),
                    pose_x=payload.get("x", 0.0),
                    pose_y=payload.get("y", 0.0),
                    pose_yaw=payload.get("yaw", 0.0),
                    current_map=payload.get("map", ""),
                    current_floor=payload.get("floor", 1),
                    is_online=True,
                    is_charging=payload.get("charging", False),
                    is_moving=payload.get("moving", False),
                    error_code=payload.get("error_code", 0),
                    speed_mps=payload.get("speed", 0.0),
                )
            elif msg_type == "status":
                task_id = payload.get("task_id", "")
                status = payload.get("status", "unknown")
                if task_id:
                    self._task_status_cache[f"{robot_id}:{task_id}"] = status
            elif msg_type == "heartbeat":
                if robot_id in self._telemetry_cache:
                    self._telemetry_cache[robot_id].is_online = True
        except Exception as e:
            logger.warning("MQTT message parse error: %s", e)

    async def disconnect(self) -> None:
        if self._client:
            self._client.loop_stop()
            self._client.disconnect()
            self._connected = False

    async def get_telemetry(self, robot_id: str) -> RobotTelemetry:
        return self._telemetry_cache.get(
            robot_id, RobotTelemetry(robot_id=robot_id)
        )

    async def send_command(self, request: TaskCommandRequest) -> TaskCommandResponse:
        if not self._client or not self._connected:
            return TaskCommandResponse(success=False, message="MQTT not connected")

        payload = {
            "command": request.command.value,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            **request.payload,
        }
        if request.navigation_goal:
            payload["goal"] = {
                "x": request.navigation_goal.target_x,
                "y": request.navigation_goal.target_y,
                "yaw": request.navigation_goal.target_yaw,
                "map": request.navigation_goal.target_map,
                "floor": request.navigation_goal.target_floor,
                "location": request.navigation_goal.location_name,
            }

        topic = f"fleet/{request.robot_id}/command"
        result = self._client.publish(topic, json.dumps(payload), qos=1)

        if result.rc == mqtt.MQTT_ERR_SUCCESS:
            return TaskCommandResponse(
                success=True,
                message="Command published",
                task_id=f"mqtt_{request.robot_id}_{request.command.value}",
            )
        return TaskCommandResponse(
            success=False, message=f"MQTT publish failed: rc={result.rc}"
        )

    async def cancel_task(self, robot_id: str, task_id: str) -> bool:
        resp = await self.send_command(
            TaskCommandRequest(
                command=TaskCommand.STOP,
                robot_id=robot_id,
                payload={"task_id": task_id},
            )
        )
        return resp.success

    async def get_task_status(self, robot_id: str, task_id: str) -> str:
        return self._task_status_cache.get(f"{robot_id}:{task_id}", "unknown")

    async def list_robots(self) -> list[str]:
        return list(self._discovered_robots)
