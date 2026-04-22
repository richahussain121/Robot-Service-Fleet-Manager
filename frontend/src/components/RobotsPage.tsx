import { useState } from 'react';
import { useFleet } from '../contexts/FleetContext';
import { sendRobotCommand } from '../services/api';
import {
  Bot, Battery, Wifi, WifiOff,
  Square, Home, Play, Pause, ChevronDown, ChevronUp,
  MapPin, Cpu, Loader2
} from 'lucide-react';
import type { Robot } from '../models/types';

const statusStyles: Record<string, { border: string; bg: string; dot: string; text: string }> = {
  standby: { border: 'border-l-green-500', bg: 'bg-green-500/5', dot: 'bg-green-400', text: 'text-green-400' },
  charging: { border: 'border-l-yellow-500', bg: 'bg-yellow-500/5', dot: 'bg-yellow-400', text: 'text-yellow-400' },
  executing: { border: 'border-l-blue-500', bg: 'bg-blue-500/5', dot: 'bg-blue-400', text: 'text-blue-400' },
  assigned: { border: 'border-l-purple-500', bg: 'bg-purple-500/5', dot: 'bg-purple-400', text: 'text-purple-400' },
  error: { border: 'border-l-red-500', bg: 'bg-red-500/5', dot: 'bg-red-400', text: 'text-red-400' },
  offline: { border: 'border-l-gray-600', bg: 'bg-gray-800/30', dot: 'bg-gray-500', text: 'text-gray-500' },
  maintenance: { border: 'border-l-orange-500', bg: 'bg-orange-500/5', dot: 'bg-orange-400', text: 'text-orange-400' },
  returning: { border: 'border-l-cyan-500', bg: 'bg-cyan-500/5', dot: 'bg-cyan-400', text: 'text-cyan-400' },
};

function RobotCard({ robot }: { robot: Robot }) {
  const [expanded, setExpanded] = useState(false);
  const [commanding, setCommanding] = useState<string | null>(null);

  const style = statusStyles[robot.status] || statusStyles.offline;

  const handleCommand = async (command: string) => {
    setCommanding(command);
    try {
      await sendRobotCommand(robot.id, { command });
    } catch (e) {
      console.error(e);
    }
    setCommanding(null);
  };

  const commands = [
    { cmd: 'stop', label: 'Stop', icon: Square, color: 'bg-red-500/15 text-red-400 active:bg-red-500/25' },
    { cmd: 'charge', label: 'Charge', icon: Home, color: 'bg-yellow-500/15 text-yellow-400 active:bg-yellow-500/25' },
    { cmd: 'pause', label: 'Pause', icon: Pause, color: 'bg-blue-500/15 text-blue-400 active:bg-blue-500/25' },
    { cmd: 'resume', label: 'Resume', icon: Play, color: 'bg-green-500/15 text-green-400 active:bg-green-500/25' },
  ];

  return (
    <div className={`rounded-2xl border border-gray-800 border-l-[3px] ${style.border} ${style.bg} overflow-hidden transition-all`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 text-left active:bg-gray-800/30 transition-colors"
      >
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gray-800/80 flex items-center justify-center">
            <Bot className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400" />
          </div>
          <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-gray-950 ${style.dot}`} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{robot.name}</p>
          <p className="text-[10px] text-gray-500 mt-0.5">
            {robot.vendor.toUpperCase()} {robot.model} &middot; {robot.robot_type}
          </p>
        </div>

        {/* Battery + chevron */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right">
            <div className="flex items-center gap-1.5">
              <Battery className={`w-4 h-4 ${
                robot.battery_soc > 0.5 ? 'text-green-400' :
                robot.battery_soc > 0.2 ? 'text-yellow-400' : 'text-red-400'
              }`} />
              <span className="text-xs font-medium">{Math.round(robot.battery_soc * 100)}%</span>
            </div>
            <span className={`text-[9px] capitalize ${style.text}`}>{robot.status}</span>
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-600" /> : <ChevronDown className="w-4 h-4 text-gray-600" />}
        </div>
      </button>

      {/* Expanded Details */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 space-y-3 animate-fade-in">
          {/* Info grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: 'Location', value: `${robot.current_map} / F${robot.current_floor}`, icon: MapPin },
              { label: 'Position', value: `(${robot.pose_x.toFixed(1)}, ${robot.pose_y.toFixed(1)})`, icon: Cpu },
              { label: 'Job', value: robot.current_job_id || 'None', icon: Bot },
              { label: 'Capacity', value: robot.load_capacity_kg > 0 ? `${robot.load_capacity_kg}kg` : 'N/A', icon: Battery },
            ].map((item) => (
              <div key={item.label} className="bg-gray-900/60 rounded-xl px-3 py-2">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <item.icon className="w-3 h-3 text-gray-600" />
                  <span className="text-[9px] text-gray-500 uppercase">{item.label}</span>
                </div>
                <p className="text-xs font-medium truncate">{item.value}</p>
              </div>
            ))}
          </div>

          {/* Capabilities */}
          <div>
            <p className="text-[9px] text-gray-500 uppercase mb-1.5">Capabilities</p>
            <div className="flex flex-wrap gap-1">
              {robot.capabilities.map((cap) => (
                <span key={cap} className="text-[10px] px-2 py-0.5 rounded-lg bg-gray-800/80 text-gray-300">{cap}</span>
              ))}
            </div>
          </div>

          {/* Command buttons */}
          <div className="grid grid-cols-4 gap-2">
            {commands.map(({ cmd, label, icon: Icon, color }) => (
              <button
                key={cmd}
                onClick={(e) => { e.stopPropagation(); handleCommand(cmd); }}
                disabled={commanding !== null}
                className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl text-[10px] font-medium transition-all active:scale-95 ${color} disabled:opacity-40`}
              >
                {commanding === cmd ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function RobotsPage() {
  const { data, loading } = useFleet();
  const [filter, setFilter] = useState('all');

  if (loading || !data) return null;

  const filtered = filter === 'all'
    ? data.robots
    : data.robots.filter((r) => r.vendor === filter || r.status === filter || r.robot_type === filter);

  const vendors = [...new Set(data.robots.map((r) => r.vendor))];

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-5 sm:py-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">Robots</h2>
          <p className="text-gray-500 text-[11px] sm:text-sm mt-0.5">{data.robots.length} registered</p>
        </div>
      </div>

      {/* Filter chips — horizontal scroll on mobile */}
      <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide pb-1">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 text-[11px] font-medium rounded-xl whitespace-nowrap transition-all active:scale-95 ${
            filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'
          }`}
        >
          All ({data.robots.length})
        </button>
        {vendors.map((v) => (
          <button
            key={v}
            onClick={() => setFilter(v)}
            className={`px-3 py-1.5 text-[11px] font-medium rounded-xl whitespace-nowrap capitalize transition-all active:scale-95 ${
              filter === v ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'
            }`}
          >
            {v} ({data.robots.filter((r) => r.vendor === v).length})
          </button>
        ))}
        {['standby', 'executing', 'error', 'offline'].map((s) => {
          const count = data.robots.filter((r) => r.status === s).length;
          if (count === 0) return null;
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 text-[11px] font-medium rounded-xl whitespace-nowrap capitalize transition-all active:scale-95 ${
                filter === s ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'
              }`}
            >
              {s} ({count})
            </button>
          );
        })}
      </div>

      {/* Robot cards */}
      <div className="space-y-2.5">
        {filtered.map((robot) => (
          <RobotCard key={robot.id} robot={robot} />
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12">
            <Bot className="w-10 h-10 text-gray-700 mx-auto mb-2" />
            <p className="text-gray-600 text-sm">No robots match filter</p>
          </div>
        )}
      </div>
    </div>
  );
}
