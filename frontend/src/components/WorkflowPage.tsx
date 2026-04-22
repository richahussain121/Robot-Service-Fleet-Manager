import { useState } from 'react';
import {
  Radar, Bot, ClipboardList, BrainCircuit, Users, Zap, CheckCircle2,
  ArrowDown, ChevronDown, ChevronUp, Wifi, BarChart3, Truck,
  Sparkles, Navigation, Package, GitBranch, Cpu, MapPin,
  AlertTriangle, RotateCcw, ArrowRight, Monitor
} from 'lucide-react';

interface WorkflowStep {
  id: number;
  title: string;
  subtitle: string;
  icon: any;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
  details: string[];
  source: string;
  techStack: string[];
  apiEndpoints?: string[];
  dataFlow?: string;
}

const workflowSteps: WorkflowStep[] = [
  {
    id: 1,
    title: 'Robot Discovery',
    subtitle: 'Connect & Register Robots',
    icon: Radar,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/30',
    description: 'Vendor adapters connect to Pudu Cloud API and Keenon Cloud API. Generic robots discovered via MQTT. All robots registered in PostgreSQL.',
    details: [
      'Pudu Adapter authenticates via Open Platform SDK (device_id + secret)',
      'Keenon Adapter connects via Cloud API (api_key + api_secret)',
      'MQTT Adapter subscribes to fleet/+/telemetry for auto-discovery',
      'Each robot stored with: vendor, model, capabilities, charging station',
      'Supports: T300, MT1, CC1, W3, S100, S400, C30, C40',
    ],
    source: 'free_fleet (plugin architecture)',
    techStack: ['BaseRobotAdapter ABC', 'httpx AsyncClient', 'paho-mqtt', 'YAML config'],
    apiEndpoints: ['POST /api/robots/', 'GET /api/robots/'],
    dataFlow: 'Vendor API / MQTT -> Adapter -> Database -> REST API',
  },
  {
    id: 2,
    title: 'Fleet Monitoring',
    subtitle: 'Real-time State Polling',
    icon: Monitor,
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
    description: 'Fleet Manager polls all robots at 2 Hz. Updates battery, position, status. Broadcasts changes to WebSocket clients for live dashboard.',
    details: [
      'Update loop runs at configurable frequency (default 2 Hz)',
      'Polls each adapter: get_telemetry(robot_id) -> RobotTelemetry',
      'Heartbeat timeout detection (69s = offline, from transact)',
      'Status determination: online/charging/executing/error/offline',
      'Fleet snapshot broadcast via WebSocket to all dashboard clients',
    ],
    source: 'free_fleet (update_loop) + transact (heartbeat)',
    techStack: ['asyncio tasks', 'WebSocket broadcast', 'SQLAlchemy async', 'MQTT pub/sub'],
    apiEndpoints: ['GET /api/fleet/dashboard', 'ws://localhost:8000/ws'],
    dataFlow: 'Adapters -> FleetManager -> Database + WebSocket -> Dashboard',
  },
  {
    id: 3,
    title: 'Order Creation',
    subtitle: 'User Dispatches a Job',
    icon: ClipboardList,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    description: 'User creates an order via dashboard or API. Quick orders use keywords (TRANSPORT, MOVE, CLEAN, DELIVER). Complex goals use natural language for LLM planning.',
    details: [
      'Quick Orders: TRANSPORT(loc_a, loc_b), MOVE(loc), CLEAN(zone), DELIVER(from, to)',
      'Priority levels: Low(1), Medium(2), High(3), Critical(4)',
      'LLM Plans: natural language goals e.g. "deliver food to room 302"',
      'World statements provide context for LLM planning',
      'Job created in PENDING status, awaiting planning',
    ],
    source: 'ROOSTER (order pipeline)',
    techStack: ['FastAPI', 'Pydantic validation', 'React form', 'WebSocket notification'],
    apiEndpoints: ['POST /api/jobs/order', 'POST /api/jobs/', 'POST /api/jobs/plan'],
    dataFlow: 'Dashboard UI -> REST API -> Job(PENDING) in Database',
  },
  {
    id: 4,
    title: 'Task Planning',
    subtitle: 'Generate Task DAG',
    icon: BrainCircuit,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
    description: 'Planner converts job into executable tasks. Sequential planning breaks orders into step chains. LLM DAG planning generates parallel task graphs via GPT-4o.',
    details: [
      'Sequential: TRANSPORT -> [Navigate, AwaitLoad, Navigate, AwaitUnload]',
      'DAG: LLM generates dependency-aware parallel task graph',
      'BigDAG: Cross-goal dependencies for maximum parallelism',
      'Each task has: type, description, dependencies, target location',
      'Tasks stored with dependency_task_ids for DAG execution',
    ],
    source: 'ROOSTER (sequential) + robot-fleet (LLM DAG)',
    techStack: ['OpenAI GPT-4o', 'DAG node generation', 'Pydantic schemas', 'JSON structured output'],
    apiEndpoints: ['POST /api/jobs/plan'],
    dataFlow: 'Job -> TaskPlanner -> [Task1, Task2, ...] with dependencies',
  },
  {
    id: 5,
    title: 'Task Allocation',
    subtitle: 'Assign Robots to Tasks',
    icon: Users,
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-500/10',
    borderColor: 'border-indigo-500/30',
    description: '5 allocation strategies assign tasks to the best-fit robots. Considers distance, capabilities, load balance, and contextual factors.',
    details: [
      'Closest: Euclidean distance to task target (from ROOSTER)',
      'Capability: Match task requirements to robot capabilities',
      'Round Robin: Simple rotation across available robots',
      'LP: Linear programming via PuLP for optimal load balance',
      'LLM: GPT-based contextual allocation considering all factors',
    ],
    source: 'ROOSTER (closest) + robot-fleet (LP/LLM)',
    techStack: ['PuLP MILP solver', 'OpenAI GPT-4o', 'Capability matching', 'Distance calculation'],
    apiEndpoints: ['(internal) TaskAllocator.allocate()'],
    dataFlow: 'Tasks + Available Robots -> Allocator -> task.robot_id assigned',
  },
  {
    id: 6,
    title: 'Task Execution',
    subtitle: 'DAG-Aware Async Dispatch',
    icon: Zap,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    description: 'Executor runs tasks respecting DAG dependencies. Ready tasks execute in parallel. Commands dispatched to robots via vendor adapters. Status polled until completion.',
    details: [
      'DAG walker: find tasks with all dependencies completed',
      'Parallel dispatch: asyncio.gather for ready tasks',
      'Command sent via adapter: navigate, deliver, clean, charge',
      'Status polling at 2s intervals until completed/failed',
      'Robot status updated: STANDBY -> ASSIGNED -> EXECUTING',
    ],
    source: 'robot-fleet (DAG executor) + ROOSTER (job callbacks)',
    techStack: ['asyncio.gather', 'Adapter send_command()', 'Status polling', 'State machine'],
    apiEndpoints: ['POST /api/jobs/{id}/start', 'POST /api/robots/{id}/command'],
    dataFlow: 'Ready Tasks -> Adapter Commands -> Robot -> Poll Status -> Update DB',
  },
  {
    id: 7,
    title: 'Completion & Recovery',
    subtitle: 'Result Handling & Replanning',
    icon: CheckCircle2,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
    description: 'Completed tasks trigger next DAG level. Failed tasks can trigger LLM replanning. Robots released back to STANDBY. Job marked COMPLETED or FAILED.',
    details: [
      'Task completion advances DAG: unblock dependent tasks',
      'Job progress: completed_tasks / total_tasks tracked',
      'Failed task with requires_replan=true triggers replanner',
      'Replanner generates recovery plan preserving completed work',
      'Robots unassigned: current_job_id=null, status=STANDBY',
    ],
    source: 'robot-fleet (replanner) + ROOSTER (job lifecycle)',
    techStack: ['LLM replanning', 'State machine transitions', 'WebSocket notifications'],
    apiEndpoints: ['POST /api/jobs/{id}/cancel', 'GET /api/tasks/?job_id=X'],
    dataFlow: 'Task Result -> Update Job -> Release Robot -> Notify Dashboard',
  },
];

function StepCard({ step, isOpen, onToggle }: { step: WorkflowStep; isOpen: boolean; onToggle: () => void }) {
  const Icon = step.icon;

  return (
    <div
      className={`rounded-2xl border transition-all duration-300 overflow-hidden opacity-0 animate-slide-up ${step.borderColor} ${
        isOpen ? `${step.bgColor} shadow-lg` : 'bg-gray-900/60 hover:bg-gray-900'
      }`}
      style={{ animationDelay: `${step.id * 0.08}s` }}
    >
      {/* Header — always visible */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 sm:gap-4 p-4 sm:p-5 text-left active:scale-[0.99] transition-transform"
      >
        {/* Step number + icon */}
        <div className="relative flex-shrink-0">
          <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl ${step.bgColor} border ${step.borderColor} flex items-center justify-center`}>
            <Icon className={`w-6 h-6 sm:w-7 sm:h-7 ${step.color}`} />
          </div>
          <div className={`absolute -top-1.5 -right-1.5 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gray-950 border-2 ${step.borderColor} flex items-center justify-center`}>
            <span className={`text-[9px] sm:text-[10px] font-bold ${step.color}`}>{step.id}</span>
          </div>
        </div>

        {/* Title */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm sm:text-base text-white leading-tight">{step.title}</h3>
          <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5">{step.subtitle}</p>
        </div>

        {/* Source badge + chevron */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="hidden sm:inline text-[9px] px-2 py-0.5 rounded-full bg-gray-800 text-gray-500 border border-gray-700">
            {step.source.split('(')[0].trim()}
          </span>
          {isOpen ? (
            <ChevronUp className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {isOpen && (
        <div className="px-4 sm:px-5 pb-5 space-y-4 animate-fade-in">
          {/* Description */}
          <p className="text-sm text-gray-300 leading-relaxed">{step.description}</p>

          {/* Detail bullets */}
          <div className="space-y-2">
            {step.details.map((d, i) => (
              <div key={i} className="flex items-start gap-2">
                <ArrowRight className={`w-3 h-3 mt-1 flex-shrink-0 ${step.color}`} />
                <span className="text-xs text-gray-400 leading-relaxed">{d}</span>
              </div>
            ))}
          </div>

          {/* Data flow */}
          {step.dataFlow && (
            <div className="bg-gray-950/50 rounded-xl p-3 border border-gray-800">
              <p className="text-[10px] text-gray-500 uppercase font-medium mb-1">Data Flow</p>
              <p className="text-xs text-gray-300 font-mono">{step.dataFlow}</p>
            </div>
          )}

          {/* Tech + API in columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-gray-950/50 rounded-xl p-3 border border-gray-800">
              <p className="text-[10px] text-gray-500 uppercase font-medium mb-2">Tech Stack</p>
              <div className="flex flex-wrap gap-1">
                {step.techStack.map((t) => (
                  <span key={t} className="text-[10px] px-2 py-0.5 rounded-lg bg-gray-800 text-gray-300">{t}</span>
                ))}
              </div>
            </div>
            {step.apiEndpoints && (
              <div className="bg-gray-950/50 rounded-xl p-3 border border-gray-800">
                <p className="text-[10px] text-gray-500 uppercase font-medium mb-2">API Endpoints</p>
                <div className="space-y-1">
                  {step.apiEndpoints.map((ep) => (
                    <p key={ep} className="text-[10px] font-mono text-blue-400">{ep}</p>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Source attribution */}
          <div className="flex items-center gap-2 pt-1">
            <GitBranch className="w-3 h-3 text-gray-600" />
            <span className="text-[10px] text-gray-500">Source: {step.source}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function FlowConnector({ color }: { color: string }) {
  return (
    <div className="flex justify-center py-1">
      <div className="flex flex-col items-center">
        <div className={`w-0.5 h-6 ${color} opacity-30`} />
        <ArrowDown className={`w-4 h-4 ${color} opacity-50`} />
      </div>
    </div>
  );
}

function ArchitectureDiagram() {
  return (
    <div className="bg-gray-900/60 rounded-2xl border border-gray-800 p-4 sm:p-6 overflow-x-auto">
      <h3 className="text-sm font-semibold mb-4 text-gray-300">System Architecture</h3>
      <div className="min-w-[320px] space-y-3 text-[10px] sm:text-xs font-mono">
        {/* Dashboard Layer */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-center">
          <span className="text-blue-400 font-semibold">React Dashboard</span>
          <div className="flex flex-wrap justify-center gap-2 mt-2">
            {['Fleet Map', 'Robot Cards', 'Job Board', 'Workflow'].map((c) => (
              <span key={c} className="px-2 py-0.5 bg-blue-500/10 rounded text-blue-300">{c}</span>
            ))}
          </div>
        </div>

        <div className="text-center text-gray-600">WebSocket + REST API</div>

        {/* Backend Layer */}
        <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3">
          <span className="text-purple-400 font-semibold block text-center mb-2">FastAPI Backend</span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {['Fleet Manager', 'Task Planner', 'Task Allocator', 'Task Executor'].map((s) => (
              <div key={s} className="bg-purple-500/10 rounded-lg p-1.5 text-center text-purple-300">{s}</div>
            ))}
          </div>
        </div>

        <div className="text-center text-gray-600">Adapter Layer</div>

        {/* Adapter Layer */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-2.5 text-center">
            <span className="text-cyan-400 font-semibold">Pudu API</span>
            <p className="text-cyan-300/70 mt-1">T300 MT1 CC1</p>
          </div>
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-2.5 text-center">
            <span className="text-green-400 font-semibold">Keenon API</span>
            <p className="text-green-300/70 mt-1">W3 S100 S400</p>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5 text-center">
            <span className="text-amber-400 font-semibold">MQTT</span>
            <p className="text-amber-300/70 mt-1">Generic Bots</p>
          </div>
        </div>

        <div className="text-center text-gray-600">Cloud APIs + MQTT Broker</div>

        {/* Robots */}
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
          <span className="text-emerald-400 font-semibold">Service Robots</span>
          <div className="flex flex-wrap justify-center gap-1.5 mt-2">
            {['T300', 'MT1', 'CC1', 'W3', 'S100', 'S400', 'C30', 'C40'].map((m) => (
              <span key={m} className="px-2 py-0.5 bg-emerald-500/15 rounded text-emerald-300">{m}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SourceProjectsCard() {
  const sources = [
    { name: 'open-rmf/free_fleet', what: 'Plugin adapters, state polling, coordinate transforms', color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
    { name: 'transitiverobotics/transact', what: 'React dashboard, WebSocket, JWT auth, heartbeat', color: 'text-green-400', bg: 'bg-green-500/10' },
    { name: 'therohangupta/robot-fleet', what: 'LLM DAG planning, LP/LLM allocation, PostgreSQL', color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { name: 'ROOSTER-fleet-management', what: 'Priority scheduling, job state machines, closest-robot', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  ];

  return (
    <div className="bg-gray-900/60 rounded-2xl border border-gray-800 p-4 sm:p-6">
      <h3 className="text-sm font-semibold mb-3 text-gray-300">Merged Open-Source Projects</h3>
      <div className="space-y-2.5">
        {sources.map((s) => (
          <div key={s.name} className={`${s.bg} rounded-xl p-3 border border-gray-800`}>
            <p className={`text-xs font-semibold ${s.color}`}>{s.name}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{s.what}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function WorkflowPage() {
  const [openSteps, setOpenSteps] = useState<Set<number>>(new Set([1]));

  const toggleStep = (id: number) => {
    setOpenSteps((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => setOpenSteps(new Set(workflowSteps.map((s) => s.id)));
  const collapseAll = () => setOpenSteps(new Set());

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Workflow className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold">App Workflow</h2>
            <p className="text-xs sm:text-sm text-gray-400">End-to-end fleet management pipeline</p>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <button
            onClick={expandAll}
            className="px-3 py-1.5 text-[11px] font-medium rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 active:scale-95 transition-all"
          >
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="px-3 py-1.5 text-[11px] font-medium rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 active:scale-95 transition-all"
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* Workflow Steps */}
      <div className="space-y-0">
        {workflowSteps.map((step, i) => (
          <div key={step.id}>
            <StepCard step={step} isOpen={openSteps.has(step.id)} onToggle={() => toggleStep(step.id)} />
            {i < workflowSteps.length - 1 && <FlowConnector color={step.color} />}
          </div>
        ))}
      </div>

      {/* Architecture + Sources */}
      <div className="mt-8 space-y-4">
        <ArchitectureDiagram />
        <SourceProjectsCard />
      </div>

      {/* Supported Robots Summary */}
      <div className="mt-4 bg-gray-900/60 rounded-2xl border border-gray-800 p-4 sm:p-6">
        <h3 className="text-sm font-semibold mb-3 text-gray-300">Supported Robot Models</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] uppercase text-gray-500 font-medium mb-2">Pudu Robotics</p>
            <div className="space-y-1.5">
              {[
                { model: 'T300', type: 'Delivery', cap: 'Multi-floor logistics' },
                { model: 'MT1', type: 'Cleaning', cap: 'AI-powered sweeper, 100K sqm' },
                { model: 'CC1', type: 'Cleaning', cap: '4-in-1 cleaner, 1800 sqm' },
              ].map((r) => (
                <div key={r.model} className="bg-gray-800/50 rounded-lg px-2.5 py-2">
                  <span className="text-xs font-semibold text-cyan-400">{r.model}</span>
                  <span className="text-[10px] text-gray-500 ml-1.5">{r.type}</span>
                  <p className="text-[10px] text-gray-500 mt-0.5">{r.cap}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] uppercase text-gray-500 font-medium mb-2">Keenon Robotics</p>
            <div className="space-y-1.5">
              {[
                { model: 'W3', type: 'Delivery', cap: 'Hotel delivery, 20kg, 12h' },
                { model: 'S100', type: 'Logistics', cap: 'Heavy-duty, 100kg load' },
                { model: 'S400', type: 'Logistics', cap: 'Industrial, 400kg load' },
                { model: 'C30', type: 'Cleaning', cap: 'Sweep + vacuum + mop' },
                { model: 'C40', type: 'Cleaning', cap: '4-in-1, 1100 sqm/hr' },
              ].map((r) => (
                <div key={r.model} className="bg-gray-800/50 rounded-lg px-2.5 py-2">
                  <span className="text-xs font-semibold text-green-400">{r.model}</span>
                  <span className="text-[10px] text-gray-500 ml-1.5">{r.type}</span>
                  <p className="text-[10px] text-gray-500 mt-0.5">{r.cap}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
