import { useState } from 'react';
import { useFleet } from '../contexts/FleetContext';
import { createOrder, startJob, cancelJob } from '../services/api';
import {
  Plus, Play, XCircle, ClipboardList, Truck, Sparkles,
  Navigation, Package, Trash2
} from 'lucide-react';

const orderKeywords = [
  { value: 'TRANSPORT', label: 'Transport', icon: Truck, desc: 'Pickup and deliver between locations' },
  { value: 'MOVE', label: 'Move', icon: Navigation, desc: 'Navigate to a location' },
  { value: 'DELIVER', label: 'Deliver', icon: Package, desc: 'Pick up and deliver items' },
  { value: 'CLEAN', label: 'Clean', icon: Sparkles, desc: 'Clean a designated zone' },
];

const jobStatusColors: Record<string, string> = {
  pending: 'bg-gray-500/20 text-gray-400',
  planned: 'bg-cyan-500/20 text-cyan-400',
  allocated: 'bg-purple-500/20 text-purple-400',
  active: 'bg-blue-500/20 text-blue-400',
  completed: 'bg-green-500/20 text-green-400',
  failed: 'bg-red-500/20 text-red-400',
  cancelled: 'bg-gray-500/20 text-gray-500',
};

export default function JobsPage() {
  const { data, refresh } = useFleet();
  const [showCreate, setShowCreate] = useState(false);
  const [keyword, setKeyword] = useState('TRANSPORT');
  const [arg1, setArg1] = useState('');
  const [arg2, setArg2] = useState('');
  const [priority, setPriority] = useState(2);
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    setSubmitting(true);
    try {
      const args = [arg1, arg2].filter(Boolean);
      await createOrder({ keyword, priority, args });
      setShowCreate(false);
      setArg1('');
      setArg2('');
      refresh();
    } catch (e) {
      console.error(e);
    }
    setSubmitting(false);
  };

  const handleStart = async (jobId: number) => {
    try {
      await startJob(jobId);
      refresh();
    } catch (e) {
      console.error(e);
    }
  };

  const handleCancel = async (jobId: number) => {
    try {
      await cancelJob(jobId);
      refresh();
    } catch (e) {
      console.error(e);
    }
  };

  const jobs = data?.active_jobs || [];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Jobs</h2>
          <p className="text-gray-400 text-sm mt-1">Create and manage fleet jobs</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" /> New Order
        </button>
      </div>

      {/* Create Order Form */}
      {showCreate && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Create Quick Order</h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {orderKeywords.map((ok) => (
              <button
                key={ok.value}
                onClick={() => setKeyword(ok.value)}
                className={`p-3 rounded-lg border text-left ${
                  keyword === ok.value
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <ok.icon className="w-5 h-5 mb-1" />
                <p className="text-sm font-medium">{ok.label}</p>
                <p className="text-xs text-gray-500">{ok.desc}</p>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                {keyword === 'CLEAN' ? 'Zone ID' : 'From / Location'}
              </label>
              <input
                type="text"
                value={arg1}
                onChange={(e) => setArg1(e.target.value)}
                placeholder="e.g. lobby, room_101, zone_a"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            {['TRANSPORT', 'DELIVER'].includes(keyword) && (
              <div>
                <label className="block text-xs text-gray-400 mb-1">To / Destination</label>
                <input
                  type="text"
                  value={arg2}
                  onChange={(e) => setArg2(e.target.value)}
                  placeholder="e.g. kitchen, room_202"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            )}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
              >
                <option value={1}>Low</option>
                <option value={2}>Medium</option>
                <option value={3}>High</option>
                <option value={4}>Critical</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={submitting || !arg1}
              className="px-4 py-2 bg-blue-600 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Order'}
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 bg-gray-800 rounded-lg text-sm hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Jobs List */}
      <div className="space-y-3">
        {jobs.length === 0 ? (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-12 text-center">
            <ClipboardList className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500">No jobs yet. Create an order to get started.</p>
          </div>
        ) : (
          jobs.map((job) => (
            <div key={job.id} className="bg-gray-900 rounded-xl border border-gray-800 p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-semibold">#{job.id}</span>
                  <span className="font-medium">{job.name}</span>
                  {job.order_keyword && (
                    <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-300">
                      {job.order_keyword}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${jobStatusColors[job.status]}`}>
                    {job.status}
                  </span>
                  {['planned', 'allocated'].includes(job.status) && (
                    <button
                      onClick={() => handleStart(job.id)}
                      className="flex items-center gap-1 px-3 py-1 text-xs bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30"
                    >
                      <Play className="w-3 h-3" /> Start
                    </button>
                  )}
                  {['active', 'allocated', 'planned'].includes(job.status) && (
                    <button
                      onClick={() => handleCancel(job.id)}
                      className="flex items-center gap-1 px-3 py-1 text-xs bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30"
                    >
                      <XCircle className="w-3 h-3" /> Cancel
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-6 text-xs text-gray-400 mb-2">
                <span>Strategy: {job.planning_strategy}</span>
                <span>Allocation: {job.allocation_strategy}</span>
                <span>Priority: {['', 'Low', 'Medium', 'High', 'Critical'][job.priority]}</span>
                <span>Robots: {job.assigned_robot_ids?.join(', ') || 'None'}</span>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      job.status === 'completed' ? 'bg-green-500' :
                      job.status === 'failed' ? 'bg-red-500' : 'bg-blue-500'
                    }`}
                    style={{
                      width: `${job.total_tasks > 0 ? (job.completed_tasks / job.total_tasks) * 100 : 0}%`,
                    }}
                  />
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {job.completed_tasks}/{job.total_tasks} tasks
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
