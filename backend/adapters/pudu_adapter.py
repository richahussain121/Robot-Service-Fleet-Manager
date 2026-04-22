"""
Pudu Robotics adapter — connects via Pudu Open Platform API.
Supports: T300, MT1, CC1, BellaBot, KettyBot, HolaBot, PuduBot 2
API docs: https://open.pudutech.com/en
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


class PuduAdapter(BaseRobotAdapter):
    vendor_name = "pudu"

    def __init__(self):
        self._client: httpx.AsyncClient | None = None
        self._base_url: str = ""
        self._device_id: str = ""
        self._device_secret: str = ""
        self._token: str = ""
        self._token_expiry: datetime | None = None
        self._robot_map: dict[str, dict] = {}  # robot_id -> config

    async def connect(self, config: dict) -> bool:
        self._base_url = config.get("api_base_url", "https://open.pudutech.com/api/v1")
        self._device_id = config.get("device_id", "")
        self._device_secret = config.get("device_secret", "")
        self._client = httpx.AsyncClient(timeout=30.0)

        # Register configured robots
        for robot_id, robot_cfg in config.get("robots", {}).items():
            self._robot_map[robot_id] = robot_cfg

        # Authenticate with Pudu Cloud
        if self._device_id and self._device_secret:
            return await self._authenticate()

        logger.info("Pudu adapter connected in offline/simulation mode")
        return True

    async def _authenticate(self) -> bool:
        """Obtain access token from Pudu Open Platform."""
        try:
            resp = await self._client.post(
                f"{self._base_url}/auth/token",
                json={
                    "device_id": self._device_id,
                    "device_secret": self._device_secret,
                },
            )
            if resp.status_code == 200:
                data = resp.json()
                self._token = data.get("access_token", "")
                self._token_expiry = datetime.now(timezone.utc)
                logger.info("Pudu Cloud authentication successful")
                return True
            logger.error("Pudu auth failed: %s", resp.text)
        except httpx.HTTPError as e:
            logger.error("Pudu auth error: %s", e)
        return False

    @property
    def _headers(self) -> dict:
        return {"Authorization": f"Bearer {self._token}"} if self._token else {}

    async def disconnect(self) -> None:
        if self._client:
            await self._client.aclose()

    async def get_telemetry(self, robot_id: str) -> RobotTelemetry:
        """Poll robot state from Pudu Cloud or return simulated data."""
        telemetry = RobotTelemetry(robot_id=robot_id)

        if self._token and self._client:
            try:
                resp = await self._client.get(
                    f"{self._base_url}/robots/{robot_id}/status",
                    headers=self._headers,
                )
                if resp.status_code == 200:
                    data = resp.json()
                    telemetry.battery_soc = data.get("battery", 0) / 100.0
                    telemetry.is_online = data.get("online", False)
                    telemetry.is_charging = data.get("charging", False)
                    telemetry.is_moving = data.get("moving", False)
                    telemetry.pose_x = data.get("x", 0.0)
                    telemetry.pose_y = data.get("y", 0.0)
                    telemetry.pose_yaw = data.get("yaw", 0.0)
                    telemetry.current_map = data.get("map_name", "")
                    telemetry.current_floor = data.get("floor", 1)
                    telemetry.error_code = data.get("error_code", 0)
                    telemetry.extras = {
                        "model": data.get("model", ""),
                        "firmware": data.get("firmware_version", ""),
                        "task_id": data.get("current_task_id", ""),
                    }
                    return telemetry
            except httpx.HTTPError as e:
                logger.warning("Pudu telemetry error for %s: %s", robot_id, e)

        # Simulation fallback
        cfg = self._robot_map.get(robot_id, {})
        telemetry.battery_soc = 0.85
        telemetry.is_online = True
        telemetry.current_map = cfg.get("initial_map", "floor_1")
        return telemetry

    async def send_command(self, request: TaskCommandRequest) -> TaskCommandResponse:
        """Dispatch command to Pudu robot via Open Platform API."""
        robot_id = request.robot_id

        if self._token and self._client:
            endpoint_map = {
                TaskCommand.NAVIGATE: f"/robots/{robot_id}/navigate",
                TaskCommand.DELIVER: f"/robots/{robot_id}/deliver",
                TaskCommand.CLEAN: f"/robots/{robot_id}/clean",
                TaskCommand.CHARGE: f"/robots/{robot_id}/charge",
                TaskCommand.STOP: f"/robots/{robot_id}/stop",
                TaskCommand.PAUSE: f"/robots/{robot_id}/pause",
                TaskCommand.RESUME: f"/robots/{robot_id}/resume",
                TaskCommand.DOCK: f"/robots/{robot_id}/dock",
            }
            endpoint = endpoint_map.get(request.command, f"/robots/{robot_id}/command")

            payload = dict(request.payload)
            if request.navigation_goal:
                payload.update({
                    "target_x": request.navigation_goal.target_x,
                    "target_y": request.navigation_goal.target_y,
                    "target_yaw": request.navigation_goal.target_yaw,
                    "target_map": request.navigation_goal.target_map,
                    "target_floor": request.navigation_goal.target_floor,
                    "location_name": request.navigation_goal.location_name,
                })

            try:
                resp = await self._client.post(
                    f"{self._base_url}{endpoint}",
                    json=payload,
                    headers=self._headers,
                )
                if resp.status_code == 200:
                    data = resp.json()
                    return TaskCommandResponse(
                        success=True,
                        message=data.get("message", "Command accepted"),
                        task_id=data.get("task_id", ""),
                    )
                return TaskCommandResponse(
                    success=False, message=f"API error: {resp.status_code}"
                )
            except httpx.HTTPError as e:
                return TaskCommandResponse(success=False, message=str(e))

        # Simulation
        logger.info(
            "Pudu SIM: %s -> %s on %s", request.command.value, robot_id, request.payload
        )
        return TaskCommandResponse(
            success=True, message="Simulated command accepted", task_id=f"sim_{robot_id}"
        )

    async def cancel_task(self, robot_id: str, task_id: str) -> bool:
        if self._token and self._client:
            try:
                resp = await self._client.post(
                    f"{self._base_url}/robots/{robot_id}/cancel",
                    json={"task_id": task_id},
                    headers=self._headers,
                )
                return resp.status_code == 200
            except httpx.HTTPError:
                pass
        return True  # Simulation: always succeeds

    async def get_task_status(self, robot_id: str, task_id: str) -> str:
        if self._token and self._client:
            try:
                resp = await self._client.get(
                    f"{self._base_url}/robots/{robot_id}/tasks/{task_id}",
                    headers=self._headers,
                )
                if resp.status_code == 200:
                    return resp.json().get("status", "unknown")
            except httpx.HTTPError:
                pass
        return "completed"  # Simulation

    async def list_robots(self) -> list[str]:
        if self._token and self._client:
            try:
                resp = await self._client.get(
                    f"{self._base_url}/robots", headers=self._headers
                )
                if resp.status_code == 200:
                    return [r["id"] for r in resp.json().get("robots", [])]
            except httpx.HTTPError:
                pass
        return list(self._robot_map.keys())
