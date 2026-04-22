import { useState } from 'react';
import { useFleet } from '../contexts/FleetContext';
import { Bot, Battery, MapPin, Layers, Loader2 } from 'lucide-react';

const statusDot: Record<string, { bg: string; ring: string; label: string }> = {
  standby: { bg: 'bg-green-400', ring: 'ring-green-400/30', label: 'Standby' },
  charging: { bg: 'bg-yellow-400', ring: 'ring-yellow-400/30', label: 'Charging' },
  executing: { bg: 'bg-blue-400', ring: 'ring-blue-400/30', label: 'Executing' },
  assigned: { bg: 'bg-purple-400', ring: 'ring-purple-400/30', label: 'Assigned' },
  error: { bg: 'bg-red-400', ring: 'ring-red-400/30', label: 'Error' },
  offline: { bg: 'bg-gray-500', ring: 'ring-gray-500/30', label: 'Offline' },
  maintenance: { bg: 'bg-orange-400', ring: 'ring-orange-400/30', label: 'Maintenance' },
  returning: { bg: 'bg-cyan-400', ring: 'ring-cyan-400/30', label: 'Returning' },
};

export default function MapView() {
  const { data, loading } = useFleet();
  const [selectedRobot, setSelectedRobot] = useState<string | null>(null);
  const [activeFloor, setActiveFloor] = useState<number>(1);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
      </div>
    );
  }

  // Group by floor
  const byFloor: Record<number, typeof data.robots> = {};
  data.robots.forEach((robot) => {
    const floor = robot.current_floor;
    if (!byFloor[floor]) byFloor[floor] = [];
    byFloor[floor].push(robot);
  });
  const floors = Object.keys(byFloor).map(Number).sort();
  if (!byFloor[activeFloor] && floors.length > 0) setActiveFloor(floors[0]);

  const floorRobots = byFloor[activeFloor] || [];
  const selected = selectedRobot ? data.robots.find((r) => r.id === selectedRobot) : null;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-5 sm:py-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">Fleet Map</h2>
          <p className="text-gray-500 text-[11px] sm:text-sm mt-0.5">{data.robots.length} robots across {floors.length} floor(s)</p>
        </div>
      </div>

      {/* Floor selector */}
      <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide pb-1">
        {floors.map((floor) => (
          <button
            key={floor}
            onClick={() => setActiveFloor(floor)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all active:scale-95 ${
              activeFloor === floor ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Floor {floor}
            <span className="text-[10px] opacity-70">({byFloor[floor]?.length || 0})</span>
          </button>
        ))}
      </div>

      {/* Legend */}
      <div className="flex gap-3 mb-4 overflow-x-auto scrollbar-hide pb-1">
        {Object.entries(statusDot).map(([status, { bg, label }]) => (
          <div key={status} className="flex items-center gap-1.5 whitespace-nowrap">
            <div className={`w-2.5 h-2.5 rounded-full ${bg}`} />
            <span className="text-[10px] text-gray-500">{label}</span>
          </div>
        ))}
      </div>

      {/* Map canvas */}
      <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
        <div className="relative" style={{ paddingBottom: '60%', minHeight: '300px' }}>
          {/* Grid */}
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
              backgroundSize: '30px 30px',
            }}
          />

          {/* Floor label */}
          <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-10">
            <div className="bg-gray-800/80 backdrop-blur rounded-lg px-2.5 py-1.5 border border-gray-700">
              <span className="text-[10px] text-gray-400">
                <MapPin className="w-3 h-3 inline mr-1" />
                Floor {activeFloor} - {floorRobots[0]?.current_map || 'Unknown'}
              </span>
            </div>
          </div>

          {/* Robot markers */}
          {floorRobots.map((robot) => {
            const maxPos = 20;
            const x = Math.min(Math.max(((robot.pose_x + maxPos) / (maxPos * 2)) * 100, 8), 92);
            const y = Math.min(Math.max(((robot.pose_y + maxPos) / (maxPos * 2)) * 100, 8), 92);
            const dot = statusDot[robot.status] || statusDot.offline;
            const isSelected = selectedRobot === robot.id;

            return (
              <button
                key={robot.id}
                className={`absolute z-20 group transition-transform active:scale-110 ${isSelected ? 'scale-110 z-30' : ''}`}
                style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}
                onClick={() => setSelectedRobot(isSelected ? null : robot.id)}
              >
                {/* Pulse for executing */}
                {robot.status === 'executing' && (
                  <div className="absolute inset-0 -m-2">
                    <div className={`w-full h-full rounded-full animate-ping opacity-20 ${dot.bg}`} />
                  </div>
                )}

                {/* Robot dot */}
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center ring-4 ${dot.ring} ${
                  isSelected ? 'ring-white/30' : ''
                } bg-gray-900 border-2 border-gray-700 transition-all`}>
                  <Bot className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: dot.bg.replace('bg-', '').includes('green') ? '#4ade80' : dot.bg.replace('bg-', '').includes('blue') ? '#60a5fa' : dot.bg.replace('bg-', '').includes('yellow') ? '#facc15' : dot.bg.replace('bg-', '').includes('red') ? '#f87171' : dot.bg.replace('bg-', '').includes('purple') ? '#c084fc' : '#9ca3af' }} />
                </div>

                {/* Name label */}
                <div className={`absolute top-full left-1/2 -translate-x-1/2 mt-1 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                  <div className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 whitespace-nowrap shadow-xl">
                    <p className="text-[10px] font-medium">{robot.name}</p>
                  </div>
                </div>
              </button>
            );
          })}

          {floorRobots.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-gray-600 text-sm">No robots on this floor</p>
            </div>
          )}
        </div>
      </div>

      {/* Selected robot detail panel */}
      {selected && (
        <div className="mt-4 bg-gray-900 rounded-2xl border border-gray-800 p-4 animate-slide-up">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center">
              <Bot className="w-5 h-5 text-gray-400" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">{selected.name}</p>
              <p className="text-[10px] text-gray-500">{selected.vendor.toUpperCase()} {selected.model}</p>
            </div>
            <button
              onClick={() => setSelectedRobot(null)}
              className="text-gray-600 text-xs px-2 py-1 rounded-lg hover:bg-gray-800"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: 'Status', value: selected.status },
              { label: 'Battery', value: `${Math.round(selected.battery_soc * 100)}%` },
              { label: 'Position', value: `(${selected.pose_x.toFixed(1)}, ${selected.pose_y.toFixed(1)})` },
              { label: 'Type', value: selected.robot_type },
            ].map((item) => (
              <div key={item.label} className="bg-gray-800/50 rounded-xl px-3 py-2">
                <p className="text-[9px] text-gray-500 uppercase">{item.label}</p>
                <p className="text-xs font-medium capitalize mt-0.5">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-3">
            <p className="text-[9px] text-gray-500 uppercase mb-1">Capabilities</p>
            <div className="flex flex-wrap gap-1">
              {selected.capabilities.map((c) => (
                <span key={c} className="text-[10px] px-2 py-0.5 rounded-lg bg-gray-800 text-gray-300">{c}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Robot mini-list below map */}
      <div className="mt-4 bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800">
          <h3 className="text-sm font-semibold">Floor {activeFloor} Robots</h3>
        </div>
        <div className="divide-y divide-gray-800/50">
          {floorRobots.map((robot) => {
            const dot = statusDot[robot.status] || statusDot.offline;
            return (
              <button
                key={robot.id}
                onClick={() => setSelectedRobot(selectedRobot === robot.id ? null : robot.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left active:bg-gray-800/50 transition-colors ${
                  selectedRobot === robot.id ? 'bg-gray-800/30' : ''
                }`}
              >
                <div className={`w-2.5 h-2.5 rounded-full ${dot.bg}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{robot.name}</p>
                  <p className="text-[10px] text-gray-600">{robot.vendor.toUpperCase()} {robot.model}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px]">{Math.round(robot.battery_soc * 100)}%</p>
                  <p className="text-[9px] text-gray-600 capitalize">{robot.status}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
