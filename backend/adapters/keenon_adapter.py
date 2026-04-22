"""
Keenon Robotics adapter — connects via Keenon Cloud Platform API.
Supports: W3, S100, S400, C30, C40
"""

import logging
from datetime import datetime, timezone

import httpx

from adapters.base_adapter import (
    BaseRobotAdapter,
    NavigationGoal,
    RobotTelemetry,
    TaskCommand,
    TaskCommandRequest,
    TaskCommandResponse,
)

logger = logging.getLogger(__name__)


class KeenonAdapter(BaseRobotAdapter):
    vendor_name = "keenon"

    def __init__(self):
        self._client: httpx.AsyncClient | None = None
        self._base_url: str = ""
        self._api_key: str = ""
        self._api_secret: str = ""
        self._token: str = ""
        self._robot_map: dict[str, dict] = {}

    async def connect(self, config: dict) -> bool:
        self._base_url = config.get("api_base_url", "https://api.keenon.com/v1")
        self._api_key = config.get("api_key", "")
        self._api_secret = config.get("api_secret", "")
        self._client = httpx.AsyncClient(timeout=30.0)

        for robot_id, robot_cfg in config.get("robots", {}).items():
            self._robot_map[robot_id] = robot_cfg

        if self._api_key and self._api_secret:
            return await self._authenticate()

        logger.info("Keenon adapter connected in offline/simulation mode")
        return True

    async def _authenticate(self) -> bool:
        try:
            resp = await self._client.post(
                f"{self._base_url}/auth/token",
                json={"api_key": self._api_key, "api_secret": self._api_secret},
            )
            if resp.status_code == 200:
                self._token = resp.json().get("access_token", "")
                logger.info("Keenon Cloud authentication successful")
                return True
            logger.error("Keenon auth failed: %s", resp.text)
        except httpx.HTTPError as e:
            logger.error("Keenon auth error: %s", e)
        return False

    @property
    def _headers(self) -> dict:
        return {"Authorization": f"Bearer {self._token}"} if self._token else {}

    async def disconnect(self) -> None:
        if self._client:
            await self._client.aclose()

    async def get_telemetry(self, robot_id: str) -> RobotTelemetry:
        telemetry = RobotTelemetry(robot_id=robot_id)

        if self._token and self._client:
            try:
                resp = await self._client.get(
                    f"{self._base_url}/devices/{robot_id}/status",
                    headers=self._headers,
                )
                if resp.status_code == 200:
                    data = resp.json()
                    telemetry.battery_soc = data.get("battery_level", 0) / 100.0
                    telemetry.is_online = data.get("is_online", False)
                    telemetry.is_charging = data.get("is_charging", False)
                    telemetry.is_moving = data.get("is_navigating", False)
                    telemetry.pose_x = data.get("position", {}).get("x", 0.0)
                    telemetry.pose_y = data.get("position", {}).get("y", 0.0)
                    telemetry.pose_yaw = data.get("position", {}).get("yaw", 0.0)
                    telemetry.current_map = data.get("map_id", "")
                    telemetry.current_floor = data.get("floor", 1)
                    telemetry.speed_mps = data.get("speed", 0.0)
                    telemetry.error_code = data.get("error_code", 0)
                    telemetry.error_message = data.get("error_msg", "")
                    telemetry.extras = {
                        "model": data.get("model", ""),
                        "compartment_status": data.get("compartments", []),
                        "load_kg": data.get("current_load_kg", 0),
                    }
                    return telemetry
            except httpx.HTTPError as e:
                logger.warning("Keenon telemetry error for %s: %s", robot_id, e)

        # Simulation fallback
        cfg = self._robot_map.get(robot_id, {})
        telemetry.battery_soc = 0.90
        telemetry.is_online = True
        telemetry.current_map = cfg.get("initial_map", "floor_1")
        return telemetry

    async def send_command(self, request: TaskCommandRequest) -> TaskCommandResponse:
        robot_id = request.robot_id

        if self._token and self._client:
            # Keenon API command mapping
            command_map = {
                TaskCommand.NAVIGATE: "move",
                TaskCommand.DELIVER: "delivery",
                TaskCommand.CLEAN: "clean",
                TaskCommand.CHARGE: "return_charge",
                TaskCommand.STOP: "emergency_stop",
                TaskCommand.PAUSE: "pause",
                TaskCommand.RESUME: "resume",
                TaskCommand.DOCK: "return_charge",
            }
            api_command = command_map.get(request.command, "custom")

            payload = {"command": api_command, **request.payload}
            if request.navigation_goal:
                payload["destination"] = {
                    "x": request.navigation_goal.target_x,
                    "y": request.navigation_goal.target_y,
                    "yaw": request.navigation_goal.target_yaw,
                    "map_id": request.navigation_goal.target_map,
                    "floor": request.navigation_goal.target_floor,
                    "name": request.navigation_goal.location_name,
                }

            try:
                resp = await self._client.post(
                    f"{self._base_url}/devices/{robot_id}/commands",
                    json=payload,
                    headers=self._headers,
                )
                if resp.status_code == 200:
                    data = resp.json()
                    return TaskCommandResponse(
                        success=True,
                        message=data.get("message", "OK"),
                        task_id=data.get("task_id", ""),
                    )
                return TaskCommandResponse(
                    success=False, message=f"API error: {resp.status_code}"
                )
            except httpx.HTTPError as e:
                return TaskCommandResponse(success=False, message=str(e))

        logger.info(
            "Keenon SIM: %s -> %s", request.command.value, robot_id
        )
        return TaskCommandResponse(
            success=True, message="Simulated command accepted", task_id=f"sim_{robot_id}"
        )

    async def cancel_task(self, robot_id: str, task_id: str) -> bool:
        if self._token and self._client:
            try:
                resp = await self._client.post(
                    f"{self._base_url}/devices/{robot_id}/cancel",
                    json={"task_id": task_id},
                    headers=self._headers,
                )
                return resp.status_code == 200
            except httpx.HTTPError:
                pass
        return True

    async def get_task_status(self, robot_id: str, task_id: str) -> str:
        if self._token and self._client:
            try:
                resp = await self._client.get(
                    f"{self._base_url}/devices/{robot_id}/tasks/{task_id}",
                    headers=self._headers,
                )
                if resp.status_code == 200:
                    return resp.json().get("status", "unknown")
            except httpx.HTTPError:
                pass
        return "completed"

    async def list_robots(self) -> list[str]:
        if self._token and self._client:
            try:
                resp = await self._client.get(
                    f"{self._base_url}/devices", headers=self._headers
                )
                if resp.status_code == 200:
                    return [d["id"] for d in resp.json().get("devices", [])]
            except httpx.HTTPError:
                pass
        return list(self._robot_map.keys())
