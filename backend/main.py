"""
Robot Service Management Fleet — Command Center Backend
Merges: free_fleet + transact + robot-fleet + ROOSTER

FastAPI application with:
- REST API for robot, task, and job management
- WebSocket for real-time fleet monitoring
- MQTT bridge for robot communication
- Plugin-based robot adapters (Pudu, Keenon, generic MQTT)
- LLM-based task planning and allocation
"""

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from database import init_db
from services.fleet_manager import FleetManager
from services.task_executor import TaskExecutor
from services.mqtt_bridge import MqttBridge
from websocket.handler import ws_manager

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ── Global service instances ──
fleet_manager = FleetManager()
task_executor = TaskExecutor(fleet_manager)
mqtt_bridge = MqttBridge()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle."""
    logger.info("=" * 60)
    logger.info("  Robot Service Management Fleet — Command Center")
    logger.info("  Initializing...")
    logger.info("=" * 60)

    # Initialize database
    await init_db()
    logger.info("Database initialized")

    # Connect MQTT bridge
    await mqtt_bridge.connect()

    # Initialize fleet manager and start update loop
    await fleet_manager.initialize()
    await fleet_manager.start_update_loop()

    # Start WebSocket broadcast loop
    ws_task = asyncio.create_task(_ws_broadcast_loop())

    logger.info("Command Center ready")
    logger.info("  API:       http://localhost:8000/docs")
    logger.info("  WebSocket: ws://localhost:8000/ws")
    logger.info("=" * 60)

    yield

    # Shutdown
    ws_task.cancel()
    await fleet_manager.shutdown()
    await mqtt_bridge.disconnect()
    logger.info("Command Center shutdown complete")


async def _ws_broadcast_loop():
    """Forward fleet updates to WebSocket clients."""
    queue = fleet_manager.subscribe()
    try:
        while True:
            data = await queue.get()
            await ws_manager.broadcast(data)
    except asyncio.CancelledError:
        fleet_manager.unsubscribe(queue)


# ── FastAPI App ──

app = FastAPI(
    title="Robot Service Management Fleet",
    description=(
        "Unified command center for managing heterogeneous service robot fleets. "
        "Supports Pudu (T300, MT1, CC1) and Keenon (W3, S100, S400, C30, C40) robots."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register API routers ──

from api.robots import router as robots_router
from api.tasks import router as tasks_router
from api.jobs import router as jobs_router
from api.fleet import router as fleet_router
from api.auth import router as auth_router

app.include_router(robots_router)
app.include_router(tasks_router)
app.include_router(jobs_router)
app.include_router(fleet_router)
app.include_router(auth_router)


# ── WebSocket endpoint ──

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            # Keep connection alive; receive client messages if needed
            data = await websocket.receive_text()
            # Client can send commands via WebSocket too
            logger.debug("WS message: %s", data)
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)


# ── Health check ──

@app.get("/health")
async def health():
    return {"status": "ok", "service": "Robot Service Management Fleet"}
