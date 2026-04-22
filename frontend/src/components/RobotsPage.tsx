import { useState } from 'react';
import { useFleet } from '../contexts/FleetContext';
import { sendRobotCommand } from '../services/api';
import {
  Bot, Battery, MapPin, Wifi, WifiOff, AlertTriangle,
  Square, Home, Play, Pause, ChevronDown, ChevronUp
} from 'lucide-react';
import type { Robot } from '../models/types';

const statusColors: Record<string, string> = {
  standby: 'border-green-500 bg-green-500/10',
  charging: 'border-yellow-500 bg-yellow-500/10',
  executing: 'border-blue-500 bg-blue-500/10',
  assigned: 'border-purple-500 bg-purple-500/10',
  error: 'border-red-500 bg-red-500/10',
  offline: 'border-gray-600 bg-gray-800',
  maintenance: 'border-orange-500 bg-orange-500/10',
};

function RobotCard({ robot }: { robot: Robot }) {
  const [expanded, setExpanded] = useState(false);
  const [commanding, setCommanding] = useState(false);

  const handleCommand = async (command: string) => {
    setCommanding(true);
    try {
      await sendRobotCommand(robot.id, { command });
    } catch (e) {
      console.error(e);
    }
    setCommanding(false);
  };

  return (
    <div className={`rounded-xl border-l-4 bg-gray-900 border border-gray-800 ${statusColors[robot.status]}`}>
      <div
        className="p-5 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-2 rounded-lg bg-gray-800">
              <Bot className="w-8 h-8 text-gray-300" />
            </div>
            <div>
              <h3 className="font-semibold">{robot.name}</h3>
              <p className="text-xs text-gray-500">
                {robot.vendor.toUpperCase()} {robot.model} - {robot.robot_type}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {robot.status === 'offline' ? (
              <WifiOff className="w-4 h-4 text-gray-500" />
            ) : (
              <Wifi className="w-4 h-4 text-green-400" />
            )}
            <div className="flex items-center gap-2">
              <Battery className={`w-4 h-4 ${
                robot.battery_soc > 0.5 ? 'text-green-400' :
                robot.battery_soc > 0.2 ? 'text-yellow-400' : 'text-red-400'
              }`} />
              <span className="text-sm">{Math.round(robot.battery_soc * 100)}%</span>
            </div>
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="px-5 pb-5 border-t border-gray-800 pt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <p className="text-xs text-gray-500">Status</p>
              <p className="text-sm font-medium capitalize">{robot.status}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Location</p>
              <p className="text-sm">{robot.current_map} / F{robot.current_floor}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Position</p>
              <p className="text-sm">({robot.pose_x.toFixed(1)}, {robot.pose_y.toFixed(1)})</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Current Job</p>
              <p className="text-sm">{robot.current_job_id || 'None'}</p>
            </div>
          </div>

          <div className="mb-4">
            <p className="text-xs text-gray-500 mb-1">Capabilities</p>
            <div className="flex flex-wrap gap-1">
              {robot.capabilities.map((cap) => (
                <span key={cap} className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-300">
                  {cap}
                </span>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => handleCommand('stop')}
              disabled={commanding}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-50"
            >
              <Square className="w-3 h-3" /> Stop
            </button>
            <button
              onClick={() => handleCommand('charge')}
              disabled={commanding}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 disabled:opacity-50"
            >
              <Home className="w-3 h-3" /> Charge
            </button>
            <button
              onClick={() => handleCommand('pause')}
              disabled={commanding}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 disabled:opacity-50"
            >
              <Pause className="w-3 h-3" /> Pause
            </button>
            <button
              onClick={() => handleCommand('resume')}
              disabled={commanding}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 disabled:opacity-50"
            >
              <Play className="w-3 h-3" /> Resume
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RobotsPage() {
  const { data, loading } = useFleet();
  const [filter, setFilter] = useState<string>('all');

  if (loading || !data) return null;

  const filtered = filter === 'all'
    ? data.robots
    : data.robots.filter((r) => r.vendor === filter || r.status === filter || r.robot_type === filter);

  const vendors = [...new Set(data.robots.map((r) => r.vendor))];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Robots</h2>
          <p className="text-gray-400 text-sm mt-1">{data.robots.length} registered robots</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 text-xs rounded-lg ${filter === 'all' ? 'bg-blue-600' : 'bg-gray-800'}`}
          >
            All
          </button>
          {vendors.map((v) => (
            <button
              key={v}
              onClick={() => setFilter(v)}
              className={`px-3 py-1.5 text-xs rounded-lg capitalize ${filter === v ? 'bg-blue-600' : 'bg-gray-800'}`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {filtered.map((robot) => (
          <RobotCard key={robot.id} robot={robot} />
        ))}
      </div>
    </div>
  );
}
