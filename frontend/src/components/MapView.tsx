import { useFleet } from '../contexts/FleetContext';
import { Bot, Battery, MapPin } from 'lucide-react';

const statusDotColors: Record<string, string> = {
  standby: '#22c55e',
  charging: '#eab308',
  executing: '#3b82f6',
  assigned: '#a855f7',
  error: '#ef4444',
  offline: '#6b7280',
};

export default function MapView() {
  const { data, loading } = useFleet();

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400" />
      </div>
    );
  }

  // Group robots by floor
  const byFloor: Record<number, typeof data.robots> = {};
  data.robots.forEach((robot) => {
    const floor = robot.current_floor;
    if (!byFloor[floor]) byFloor[floor] = [];
    byFloor[floor].push(robot);
  });

  const floors = Object.keys(byFloor)
    .map(Number)
    .sort();

  return (
    <div className="p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Fleet Map</h2>
        <p className="text-gray-400 text-sm mt-1">
          Robot positions by floor - connect a facility map for full visualization
        </p>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-6 text-xs">
        {Object.entries(statusDotColors).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-gray-400 capitalize">{status}</span>
          </div>
        ))}
      </div>

      {floors.map((floor) => (
        <div key={floor} className="mb-8">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-blue-400" />
            Floor {floor} - {byFloor[floor][0]?.current_map || 'Unknown'}
          </h3>

          {/* Simple grid-based map visualization */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 relative min-h-[400px]">
            {/* Grid background */}
            <div className="absolute inset-6 opacity-10"
              style={{
                backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
                backgroundSize: '40px 40px',
              }}
            />

            {/* Robot markers */}
            <div className="relative h-[360px]">
              {byFloor[floor].map((robot) => {
                // Normalize positions to fit within the container
                const maxPos = 20;
                const x = Math.min(Math.max(((robot.pose_x + maxPos) / (maxPos * 2)) * 100, 5), 90);
                const y = Math.min(Math.max(((robot.pose_y + maxPos) / (maxPos * 2)) * 100, 5), 90);

                return (
                  <div
                    key={robot.id}
                    className="absolute group"
                    style={{
                      left: `${x}%`,
                      top: `${y}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                  >
                    {/* Robot dot */}
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center border-2 cursor-pointer hover:scale-110 transition-transform"
                      style={{
                        borderColor: statusDotColors[robot.status] || '#6b7280',
                        backgroundColor: `${statusDotColors[robot.status] || '#6b7280'}20`,
                      }}
                    >
                      <Bot className="w-5 h-5" style={{ color: statusDotColors[robot.status] }} />
                    </div>

                    {/* Pulse for executing */}
                    {robot.status === 'executing' && (
                      <div
                        className="absolute inset-0 rounded-full animate-ping opacity-30"
                        style={{ backgroundColor: statusDotColors.executing }}
                      />
                    )}

                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                      <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 shadow-xl whitespace-nowrap">
                        <p className="text-sm font-medium">{robot.name}</p>
                        <p className="text-xs text-gray-400">
                          {robot.vendor.toUpperCase()} {robot.model}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Battery className="w-3 h-3" />
                          <span className="text-xs">{Math.round(robot.battery_soc * 100)}%</span>
                          <span className="text-xs capitalize text-gray-400">{robot.status}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          ({robot.pose_x.toFixed(1)}, {robot.pose_y.toFixed(1)})
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
