import { useFleet } from '../contexts/FleetContext';
import {
  Bot, BatteryCharging, AlertTriangle, Wifi, WifiOff,
  Activity, CheckCircle2, Clock, Zap, TrendingUp, Loader2
} from 'lucide-react';

function StatCard({
  label, value, icon: Icon, color, delay,
}: {
  label: string; value: number | string; icon: any; color: string; delay: number;
}) {
  return (
    <div
      className="bg-gray-900 rounded-2xl p-4 sm:p-5 border border-gray-800 opacity-0 animate-slide-up active:scale-95 transition-transform"
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] sm:text-xs text-gray-500 uppercase tracking-wider">{label}</p>
          <p className="text-2xl sm:text-3xl font-bold mt-0.5">{value}</p>
        </div>
        <div className={`p-2.5 sm:p-3 rounded-2xl ${color}`}>
          <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
        </div>
      </div>
    </div>
  );
}

const statusBadge: Record<string, { bg: string; dot: string }> = {
  standby: { bg: 'bg-green-500/15 text-green-400', dot: 'bg-green-400' },
  charging: { bg: 'bg-yellow-500/15 text-yellow-400', dot: 'bg-yellow-400' },
  executing: { bg: 'bg-blue-500/15 text-blue-400', dot: 'bg-blue-400' },
  assigned: { bg: 'bg-purple-500/15 text-purple-400', dot: 'bg-purple-400' },
  error: { bg: 'bg-red-500/15 text-red-400', dot: 'bg-red-400' },
  offline: { bg: 'bg-gray-500/15 text-gray-500', dot: 'bg-gray-500' },
  maintenance: { bg: 'bg-orange-500/15 text-orange-400', dot: 'bg-orange-400' },
  returning: { bg: 'bg-cyan-500/15 text-cyan-400', dot: 'bg-cyan-400' },
};

export default function Dashboard() {
  const { data, loading, error } = useFleet();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-blue-400 mx-auto animate-spin" />
          <p className="text-gray-500 text-sm mt-3">Connecting to fleet...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh] px-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <p className="text-red-400 font-medium">{error}</p>
          <p className="text-gray-500 text-xs mt-2">Make sure the backend is running on port 8000</p>
        </div>
      </div>
    );
  }

  if (!data) return null;
  const { fleet, robots, active_jobs, recent_tasks } = data;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-5 sm:py-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-5 sm:mb-8 hidden md:block">
        <h2 className="text-xl sm:text-2xl font-bold">Command Center</h2>
        <p className="text-gray-500 text-xs sm:text-sm mt-1">Real-time fleet monitoring and control</p>
      </div>

      {/* Stats Grid — 2 cols mobile, 4 cols desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5 sm:mb-8">
        <StatCard label="Total" value={fleet.total_robots} icon={Bot} color="bg-blue-500/15 text-blue-400" delay={0.05} />
        <StatCard label="Online" value={fleet.online} icon={Wifi} color="bg-green-500/15 text-green-400" delay={0.1} />
        <StatCard label="Active" value={fleet.executing} icon={Activity} color="bg-purple-500/15 text-purple-400" delay={0.15} />
        <StatCard label="Errors" value={fleet.error} icon={AlertTriangle} color="bg-red-500/15 text-red-400" delay={0.2} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5 sm:mb-8">
        <StatCard label="Standby" value={fleet.standby} icon={Clock} color="bg-emerald-500/15 text-emerald-400" delay={0.25} />
        <StatCard label="Charging" value={fleet.charging} icon={BatteryCharging} color="bg-yellow-500/15 text-yellow-400" delay={0.3} />
        <StatCard label="Jobs" value={fleet.active_jobs} icon={Zap} color="bg-indigo-500/15 text-indigo-400" delay={0.35} />
        <StatCard label="Offline" value={fleet.offline} icon={WifiOff} color="bg-gray-500/15 text-gray-400" delay={0.4} />
      </div>

      {/* Robot List — horizontal scroll on mobile, table on desktop */}
      <div className="bg-gray-900 rounded-2xl border border-gray-800 mb-5 sm:mb-8 overflow-hidden opacity-0 animate-slide-up" style={{ animationDelay: '0.3s' }}>
        <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-800 flex items-center justify-between">
          <h3 className="text-sm sm:text-base font-semibold">Fleet Status</h3>
          <span className="text-[10px] text-gray-500">{robots.length} robots</span>
        </div>

        {/* Mobile: card list */}
        <div className="sm:hidden divide-y divide-gray-800">
          {robots.map((robot) => {
            const badge = statusBadge[robot.status] || statusBadge.offline;
            return (
              <div key={robot.id} className="px-4 py-3 flex items-center gap-3 active:bg-gray-800/50 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-5 h-5 text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{robot.name}</p>
                    <span className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full ${badge.bg}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                      {robot.status}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500">{robot.vendor.toUpperCase()} {robot.model} - {robot.robot_type}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="flex items-center gap-1">
                    <div className="w-10 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          robot.battery_soc > 0.5 ? 'bg-green-500' :
                          robot.battery_soc > 0.2 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${robot.battery_soc * 100}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-500 w-7 text-right">{Math.round(robot.battery_soc * 100)}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop: table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-[10px] text-gray-500 uppercase border-b border-gray-800">
                <th className="px-5 py-3">Robot</th>
                <th className="px-5 py-3">Vendor</th>
                <th className="px-5 py-3">Model</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Battery</th>
                <th className="px-5 py-3">Location</th>
                <th className="px-5 py-3">Job</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {robots.map((robot) => {
                const badge = statusBadge[robot.status] || statusBadge.offline;
                return (
                  <tr key={robot.id} className="hover:bg-gray-800/40 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Bot className="w-4 h-4 text-gray-500" />
                        <div>
                          <p className="text-sm font-medium">{robot.name}</p>
                          <p className="text-[10px] text-gray-600">{robot.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-lg bg-gray-800 text-gray-300">
                        {robot.vendor.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm">{robot.model}</td>
                    <td className="px-5 py-3 text-sm capitalize">{robot.robot_type}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-1 rounded-full ${badge.bg}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                        {robot.status}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-14 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              robot.battery_soc > 0.5 ? 'bg-green-500' :
                              robot.battery_soc > 0.2 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${robot.battery_soc * 100}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-gray-400">{Math.round(robot.battery_soc * 100)}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-400">{robot.current_map} / F{robot.current_floor}</td>
                    <td className="px-5 py-3 text-xs">
                      {robot.current_job_id ? (
                        <span className="text-blue-400">#{robot.current_job_id}</span>
                      ) : (
                        <span className="text-gray-700">--</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Jobs + Tasks — stacked on mobile, side-by-side on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Active Jobs */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden opacity-0 animate-slide-up" style={{ animationDelay: '0.4s' }}>
          <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-800">
            <h3 className="text-sm sm:text-base font-semibold">Active Jobs</h3>
          </div>
          <div className="p-3 sm:p-4 space-y-2.5">
            {active_jobs.length === 0 ? (
              <p className="text-gray-600 text-xs text-center py-6">No active jobs</p>
            ) : (
              active_jobs.map((job) => (
                <div key={job.id} className="bg-gray-800/50 rounded-xl p-3 sm:p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-xs sm:text-sm truncate mr-2">{job.name}</span>
                    <span className={`text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 ${
                      job.status === 'active' ? 'bg-blue-500/15 text-blue-400' :
                      job.status === 'completed' ? 'bg-green-500/15 text-green-400' :
                      'bg-gray-700 text-gray-400'
                    }`}>
                      {job.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-gray-500 mb-2">
                    <span>{job.completed_tasks}/{job.total_tasks} tasks</span>
                    <span>P{job.priority}</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${job.total_tasks > 0 ? (job.completed_tasks / job.total_tasks) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Tasks */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden opacity-0 animate-slide-up" style={{ animationDelay: '0.45s' }}>
          <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-800">
            <h3 className="text-sm sm:text-base font-semibold">Recent Tasks</h3>
          </div>
          <div className="p-3 sm:p-4 space-y-1">
            {recent_tasks.length === 0 ? (
              <p className="text-gray-600 text-xs text-center py-6">No tasks yet</p>
            ) : (
              recent_tasks.slice(0, 8).map((task) => (
                <div key={task.id} className="flex items-center gap-3 py-2.5 border-b border-gray-800/50 last:border-0">
                  {task.status === 'completed' ? (
                    <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                  ) : task.status === 'in_progress' ? (
                    <Activity className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  ) : task.status === 'failed' ? (
                    <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  ) : (
                    <Clock className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm truncate">{task.description}</p>
                    <p className="text-[10px] text-gray-600">{task.robot_id || 'Unassigned'}</p>
                  </div>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded flex-shrink-0 ${
                    statusBadge[task.status]?.bg || 'bg-gray-700 text-gray-400'
                  }`}>
                    {task.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
