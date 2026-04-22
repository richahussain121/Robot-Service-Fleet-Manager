import { useFleet } from '../contexts/FleetContext';
import {
  Bot, BatteryCharging, AlertTriangle, Wifi, WifiOff,
  Activity, CheckCircle2, Clock, Zap
} from 'lucide-react';

function StatCard({
  label, value, icon: Icon, color,
}: {
  label: string; value: number | string; icon: any; color: string;
}) {
  return (
    <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-400">{label}</p>
          <p className="text-3xl font-bold mt-1">{value}</p>
        </div>
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}

const statusColors: Record<string, string> = {
  standby: 'bg-green-500/20 text-green-400',
  charging: 'bg-yellow-500/20 text-yellow-400',
  executing: 'bg-blue-500/20 text-blue-400',
  assigned: 'bg-purple-500/20 text-purple-400',
  error: 'bg-red-500/20 text-red-400',
  offline: 'bg-gray-500/20 text-gray-400',
  maintenance: 'bg-orange-500/20 text-orange-400',
  returning: 'bg-cyan-500/20 text-cyan-400',
};

const vendorLogos: Record<string, string> = {
  pudu: 'Pudu',
  keenon: 'Keenon',
  generic: 'MQTT',
};

export default function Dashboard() {
  const { data, loading, error } = useFleet();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-400">{error}</p>
          <p className="text-gray-500 text-sm mt-2">
            Make sure the backend is running on port 8000
          </p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { fleet, robots, active_jobs, recent_tasks } = data;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold">Command Center</h2>
        <p className="text-gray-400 text-sm mt-1">
          Real-time fleet monitoring and control
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Robots" value={fleet.total_robots} icon={Bot} color="bg-blue-500/20 text-blue-400" />
        <StatCard label="Online" value={fleet.online} icon={Wifi} color="bg-green-500/20 text-green-400" />
        <StatCard label="Executing" value={fleet.executing} icon={Activity} color="bg-purple-500/20 text-purple-400" />
        <StatCard label="Errors" value={fleet.error} icon={AlertTriangle} color="bg-red-500/20 text-red-400" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Standby" value={fleet.standby} icon={Clock} color="bg-emerald-500/20 text-emerald-400" />
        <StatCard label="Charging" value={fleet.charging} icon={BatteryCharging} color="bg-yellow-500/20 text-yellow-400" />
        <StatCard label="Active Jobs" value={fleet.active_jobs} icon={Zap} color="bg-indigo-500/20 text-indigo-400" />
        <StatCard label="Offline" value={fleet.offline} icon={WifiOff} color="bg-gray-500/20 text-gray-400" />
      </div>

      {/* Robot Fleet Table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 mb-8">
        <div className="p-5 border-b border-gray-800">
          <h3 className="text-lg font-semibold">Fleet Status</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase border-b border-gray-800">
                <th className="px-5 py-3">Robot</th>
                <th className="px-5 py-3">Vendor</th>
                <th className="px-5 py-3">Model</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Battery</th>
                <th className="px-5 py-3">Map / Floor</th>
                <th className="px-5 py-3">Job</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {robots.map((robot) => (
                <tr key={robot.id} className="hover:bg-gray-800/50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Bot className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="font-medium text-sm">{robot.name}</p>
                        <p className="text-xs text-gray-500">{robot.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-xs font-medium px-2 py-1 rounded bg-gray-800">
                      {vendorLogos[robot.vendor] || robot.vendor}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm">{robot.model}</td>
                  <td className="px-5 py-3 text-sm capitalize">{robot.robot_type}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColors[robot.status] || 'bg-gray-700'}`}>
                      {robot.status}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            robot.battery_soc > 0.5 ? 'bg-green-500' :
                            robot.battery_soc > 0.2 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${robot.battery_soc * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-400">
                        {Math.round(robot.battery_soc * 100)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-400">
                    {robot.current_map} / F{robot.current_floor}
                  </td>
                  <td className="px-5 py-3 text-sm">
                    {robot.current_job_id ? (
                      <span className="text-blue-400">#{robot.current_job_id}</span>
                    ) : (
                      <span className="text-gray-600">--</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Active Jobs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-900 rounded-xl border border-gray-800">
          <div className="p-5 border-b border-gray-800">
            <h3 className="text-lg font-semibold">Active Jobs</h3>
          </div>
          <div className="p-5 space-y-3">
            {active_jobs.length === 0 ? (
              <p className="text-gray-500 text-sm">No active jobs</p>
            ) : (
              active_jobs.map((job) => (
                <div key={job.id} className="bg-gray-800 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{job.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      job.status === 'active' ? 'bg-blue-500/20 text-blue-400' :
                      job.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                      'bg-gray-700 text-gray-400'
                    }`}>
                      {job.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span>Tasks: {job.completed_tasks}/{job.total_tasks}</span>
                    <span>Priority: {job.priority}</span>
                    <span>Robots: {job.assigned_robot_ids?.length || 0}</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-700 rounded-full mt-2 overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{
                        width: `${job.total_tasks > 0 ? (job.completed_tasks / job.total_tasks) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Tasks */}
        <div className="bg-gray-900 rounded-xl border border-gray-800">
          <div className="p-5 border-b border-gray-800">
            <h3 className="text-lg font-semibold">Recent Tasks</h3>
          </div>
          <div className="p-5 space-y-2">
            {recent_tasks.length === 0 ? (
              <p className="text-gray-500 text-sm">No tasks yet</p>
            ) : (
              recent_tasks.slice(0, 8).map((task) => (
                <div key={task.id} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                  <div className="flex items-center gap-3">
                    {task.status === 'completed' ? (
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                    ) : task.status === 'in_progress' ? (
                      <Activity className="w-4 h-4 text-blue-400" />
                    ) : task.status === 'failed' ? (
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                    ) : (
                      <Clock className="w-4 h-4 text-gray-400" />
                    )}
                    <div>
                      <p className="text-sm">{task.description}</p>
                      <p className="text-xs text-gray-500">
                        {task.robot_id || 'Unassigned'} - {task.task_type}
                      </p>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded ${statusColors[task.status] || 'bg-gray-700'}`}>
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
