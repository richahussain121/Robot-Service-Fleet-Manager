# Robot Service Management Fleet

Unified command center for managing heterogeneous service robot fleets — **Pudu** and **Keenon** robots from a single dashboard.

## Supported Robots

| Vendor | Models | Type |
|--------|--------|------|
| **Pudu** | T300, MT1, CC1 | Delivery, Cleaning |
| **Keenon** | W3, S100, S400, C30, C40 | Delivery, Logistics, Cleaning |
| **Generic** | Any MQTT-connected robot | Via MQTT adapter |

## Architecture

Built by merging four open-source fleet management systems:

| Source Project | What We Took |
|---|---|
| [open-rmf/free_fleet](https://github.com/open-rmf/free_fleet) | Plugin-based robot adapter architecture, state polling loop, coordinate transforms |
| [transitiverobotics/transact](https://github.com/transitiverobotics/transact) | React dashboard, JWT auth, real-time WebSocket fleet monitoring, heartbeat logic |
| [therohangupta/robot-fleet](https://github.com/therohangupta/robot-fleet) | LLM-based DAG task planning, LP/LLM task allocation, PostgreSQL persistence |
| [ROOSTER-fleet-management](https://github.com/ROOSTER-fleet-management/rooster_fleet_manager) | Priority-based scheduling, job state machines, closest-robot selection, order pipeline |

```
                     ┌──────────────────────────────────────┐
                     │        React Dashboard (Vite)        │
                     │  Fleet Map │ Robot Cards │ Job Board  │
                     └──────────────┬───────────────────────┘
                                    │ WebSocket + REST
                     ┌──────────────▼───────────────────────┐
                     │        FastAPI Backend                │
                     │                                      │
                     │  ┌─────────┐  ┌──────────────────┐   │
                     │  │  Fleet  │  │  Task Planner     │   │
                     │  │ Manager │  │  (LLM DAG /       │   │
                     │  │         │  │   Sequential)     │   │
                     │  └────┬────┘  └──────┬───────────┘   │
                     │       │              │               │
                     │  ┌────▼────┐  ┌──────▼───────────┐   │
                     │  │  Task   │  │  Task Allocator   │   │
                     │  │Executor │  │  (Closest/LP/LLM/ │   │
                     │  │  (DAG)  │  │   Capability)     │   │
                     │  └────┬────┘  └──────────────────┘   │
                     │       │                              │
                     │  ┌────▼──────────────────────────┐   │
                     │  │     Robot Adapter Layer        │   │
                     │  │  ┌──────┐ ┌──────┐ ┌──────┐   │   │
                     │  │  │ Pudu │ │Keenon│ │ MQTT │   │   │
                     │  │  └──┬───┘ └──┬───┘ └──┬───┘   │   │
                     │  └─────┼────────┼────────┼───────┘   │
                     └────────┼────────┼────────┼───────────┘
                              │        │        │
                     ┌────────▼──┐ ┌───▼────┐ ┌─▼──────────┐
                     │Pudu Cloud │ │ Keenon │ │MQTT Broker  │
                     │   API     │ │ Cloud  │ │(Mosquitto)  │
                     └───────────┘ └────────┘ └─────────────┘
                              │        │        │
                     ┌────────▼────────▼────────▼───────────┐
                     │           Service Robots              │
                     │  T300  MT1  CC1  W3  S100  S400  C40  │
                     └───────────────────────────────────────┘
```

## Quick Start

### Option 1: Docker Compose (Full Stack)

```bash
# Clone and start everything
cd Robot-Service-Management-Fleet
docker compose up -d

# Dashboard: http://localhost:5173
# API docs:  http://localhost:8000/docs
# MQTT:      localhost:1883
```

### Option 2: Local Development

**Backend:**
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your settings

uvicorn main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

**MQTT Broker (optional):**
```bash
docker run -d -p 1883:1883 -p 9001:9001 eclipse-mosquitto:2
```

## API Endpoints

### Fleet Dashboard
- `GET /api/fleet/dashboard` — Full dashboard snapshot
- `GET /api/fleet/stats` — Quick stats

### Robots
- `GET /api/robots/` — List all robots (filter by vendor, status, type)
- `GET /api/robots/{id}` — Robot details
- `POST /api/robots/` — Register a robot
- `PATCH /api/robots/{id}` — Update robot
- `POST /api/robots/{id}/command` — Send command (stop, charge, navigate, etc.)

### Jobs
- `GET /api/jobs/` — List jobs
- `POST /api/jobs/` — Create job manually
- `POST /api/jobs/order` — Quick order (ROOSTER-style: TRANSPORT, MOVE, CLEAN, DELIVER)
- `POST /api/jobs/plan` — LLM-planned DAG from natural language goals
- `POST /api/jobs/{id}/start` — Execute a planned job
- `POST /api/jobs/{id}/cancel` — Cancel job

### Tasks
- `GET /api/tasks/` — List tasks (filter by job_id, robot_id, status)
- `POST /api/tasks/` — Create task

### Auth
- `POST /api/auth/login` — Login (returns JWT)
- `GET /api/auth/me` — Current user

### WebSocket
- `ws://localhost:8000/ws` — Real-time fleet updates

## Configuration

### Pudu Robots
Edit `config/pudu/config.yaml` with your Pudu Open Platform credentials from [open.pudutech.com](https://open.pudutech.com).

### Keenon Robots
Edit `config/keenon/config.yaml` with your Keenon Cloud API credentials.

### Generic MQTT Robots
Any robot publishing to MQTT topics:
- `fleet/{robot_id}/telemetry` — JSON with battery_soc, x, y, yaw, map, floor
- `fleet/{robot_id}/status` — JSON with task_id, status
- `fleet/{robot_id}/heartbeat` — Any message

## Task Planning Strategies

| Strategy | Source | Description |
|---|---|---|
| **Sequential** | ROOSTER | Linear task chain from order keywords |
| **DAG** | robot-fleet | LLM generates parallel task graph per goal |
| **BigDAG** | robot-fleet | Cross-goal dependencies, maximum parallelism |

## Allocation Strategies

| Strategy | Source | Description |
|---|---|---|
| **Closest** | ROOSTER | Nearest available robot by Euclidean distance |
| **Capability** | Custom | Match task requirements to robot capabilities |
| **LP** | robot-fleet | Linear programming for optimal load balancing |
| **LLM** | robot-fleet | GPT-based contextual allocation |
| **Round Robin** | Custom | Simple rotation across available robots |

## Project Structure

```
Robot-Service-Management-Fleet/
├── docker-compose.yml
├── config/
│   ├── mosquitto.conf
│   ├── pudu/config.yaml          # Pudu robot fleet config
│   └── keenon/config.yaml        # Keenon robot fleet config
├── backend/
│   ├── main.py                   # FastAPI entry point
│   ├── config.py                 # Settings
│   ├── database.py               # SQLAlchemy async engine
│   ├── models/                   # ORM + Pydantic schemas
│   │   ├── robot.py              # Robot model with vendor support
│   │   ├── task.py               # Task with DAG dependencies
│   │   ├── job.py                # Job with planning strategies
│   │   ├── fleet.py              # Fleet state snapshots
│   │   └── schemas.py            # API request/response schemas
│   ├── adapters/                 # Robot communication adapters
│   │   ├── base_adapter.py       # Abstract adapter interface
│   │   ├── pudu_adapter.py       # Pudu Open Platform API
│   │   ├── keenon_adapter.py     # Keenon Cloud API
│   │   └── mqtt_adapter.py       # Generic MQTT adapter
│   ├── services/                 # Core business logic
│   │   ├── fleet_manager.py      # Fleet state + update loop
│   │   ├── task_planner.py       # Sequential + LLM DAG planning
│   │   ├── task_allocator.py     # 5 allocation strategies
│   │   ├── task_executor.py      # DAG-aware async execution
│   │   └── mqtt_bridge.py        # MQTT pub/sub bridge
│   ├── api/                      # REST endpoints
│   │   ├── robots.py
│   │   ├── tasks.py
│   │   ├── jobs.py
│   │   ├── fleet.py
│   │   └── auth.py
│   └── websocket/
│       └── handler.py            # Real-time WebSocket broadcast
└── frontend/
    ├── src/
    │   ├── App.tsx               # Router + layout
    │   ├── contexts/
    │   │   └── FleetContext.tsx   # Real-time fleet state
    │   ├── components/
    │   │   ├── Dashboard.tsx      # Stats + fleet table + jobs
    │   │   ├── RobotsPage.tsx     # Robot cards with commands
    │   │   ├── JobsPage.tsx       # Job creation + management
    │   │   ├── MapView.tsx        # Floor-based robot positions
    │   │   └── Sidebar.tsx        # Navigation
    │   ├── models/types.ts        # TypeScript interfaces
    │   └── services/api.ts        # API client + WebSocket
    └── package.json

```

## License

Apache License 2.0 — inheriting from the open-source projects this system is built upon.
