import { useState } from 'react';
import { useFleet } from '../contexts/FleetContext';
import { createOrder, startJob, cancelJob } from '../services/api';
import {
  Plus, Play, XCircle, ClipboardList, Truck, Sparkles,
  Navigation, Package, Loader2, X, ChevronDown
} from 'lucide-react';

const orderTypes = [
  { value: 'TRANSPORT', label: 'Transport', icon: Truck, color: 'border-blue-500/30 bg-blue-500/10 text-blue-400', desc: 'Pickup & deliver' },
  { value: 'MOVE', label: 'Move', icon: Navigation, color: 'border-green-500/30 bg-green-500/10 text-green-400', desc: 'Go to location' },
  { value: 'DELIVER', label: 'Deliver', icon: Package, color: 'border-purple-500/30 bg-purple-500/10 text-purple-400', desc: 'Pick up & drop off' },
  { value: 'CLEAN', label: 'Clean', icon: Sparkles, color: 'border-amber-500/30 bg-amber-500/10 text-amber-400', desc: 'Clean a zone' },
];

const jobColors: Record<string, string> = {
  pending: 'bg-gray-500/15 text-gray-400',
  planned: 'bg-cyan-500/15 text-cyan-400',
  allocated: 'bg-purple-500/15 text-purple-400',
  active: 'bg-blue-500/15 text-blue-400',
  completed: 'bg-green-500/15 text-green-400',
  failed: 'bg-red-500/15 text-red-400',
  cancelled: 'bg-gray-500/15 text-gray-600',
};

export default function JobsPage() {
  const { data, refresh } = useFleet();
  const [showCreate, setShowCreate] = useState(false);
  const [keyword, setKeyword] = useState('TRANSPORT');
  const [arg1, setArg1] = useState('');
  const [arg2, setArg2] = useState('');
  const [priority, setPriority] = useState(2);
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const handleCreate = async () => {
    setSubmitting(true);
    try {
      await createOrder({ keyword, priority, args: [arg1, arg2].filter(Boolean) });
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
    setActionLoading(jobId);
    try { await startJob(jobId); refresh(); } catch {}
    setActionLoading(null);
  };

  const handleCancel = async (jobId: number) => {
    setActionLoading(jobId);
    try { await cancelJob(jobId); refresh(); } catch {}
    setActionLoading(null);
  };

  const jobs = data?.active_jobs || [];

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-5 sm:py-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">Jobs</h2>
          <p className="text-gray-500 text-[11px] sm:text-sm mt-0.5">Create and manage fleet jobs</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 rounded-xl text-xs sm:text-sm font-medium hover:bg-blue-700 active:scale-95 transition-all"
        >
          {showCreate ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          <span className="hidden xs:inline">{showCreate ? 'Close' : 'New Order'}</span>
        </button>
      </div>

      {/* Create Order Sheet */}
      {showCreate && (
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4 sm:p-6 mb-5 animate-slide-up">
          <h3 className="text-base font-semibold mb-4">Create Quick Order</h3>

          {/* Order type selector */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            {orderTypes.map((ot) => (
              <button
                key={ot.value}
                onClick={() => setKeyword(ot.value)}
                className={`p-3 rounded-xl border text-left transition-all active:scale-95 ${
                  keyword === ot.value ? ot.color : 'border-gray-700 bg-gray-800/30'
                }`}
              >
                <ot.icon className="w-5 h-5 mb-1.5" />
                <p className="text-xs font-semibold">{ot.label}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">{ot.desc}</p>
              </button>
            ))}
          </div>

          {/* Input fields */}
          <div className="space-y-3 mb-4">
            <div>
              <label className="block text-[10px] text-gray-500 uppercase mb-1">
                {keyword === 'CLEAN' ? 'Zone ID' : 'From / Location'}
              </label>
              <input
                type="text"
                value={arg1}
                onChange={(e) => setArg1(e.target.value)}
                placeholder="e.g. lobby, room_101, zone_a"
                className="w-full px-3.5 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all"
              />
            </div>

            {['TRANSPORT', 'DELIVER'].includes(keyword) && (
              <div>
                <label className="block text-[10px] text-gray-500 uppercase mb-1">To / Destination</label>
                <input
                  type="text"
                  value={arg2}
                  onChange={(e) => setArg2(e.target.value)}
                  placeholder="e.g. kitchen, room_202"
                  className="w-full px-3.5 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all"
                />
              </div>
            )}

            <div>
              <label className="block text-[10px] text-gray-500 uppercase mb-1">Priority</label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { v: 1, l: 'Low', c: 'border-gray-600 text-gray-400' },
                  { v: 2, l: 'Medium', c: 'border-blue-500/30 text-blue-400' },
                  { v: 3, l: 'High', c: 'border-amber-500/30 text-amber-400' },
                  { v: 4, l: 'Critical', c: 'border-red-500/30 text-red-400' },
                ].map(({ v, l, c }) => (
                  <button
                    key={v}
                    onClick={() => setPriority(v)}
                    className={`py-2 rounded-xl text-[11px] font-medium border transition-all active:scale-95 ${
                      priority === v ? c + ' bg-gray-800' : 'border-gray-700 text-gray-500'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Submit */}
          <button
            onClick={handleCreate}
            disabled={submitting || !arg1}
            className="w-full py-3 bg-blue-600 rounded-xl text-sm font-semibold hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-40 disabled:active:scale-100"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Creating...
              </span>
            ) : (
              `Create ${keyword} Order`
            )}
          </button>
        </div>
      )}

      {/* Jobs List */}
      <div className="space-y-2.5">
        {jobs.length === 0 ? (
          <div className="bg-gray-900 rounded-2xl border border-gray-800 py-16 text-center">
            <ClipboardList className="w-12 h-12 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-600 text-sm">No jobs yet</p>
            <p className="text-gray-700 text-xs mt-1">Create an order to get started</p>
          </div>
        ) : (
          jobs.map((job) => (
            <div key={job.id} className="bg-gray-900 rounded-2xl border border-gray-800 p-4 sm:p-5">
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-base font-bold text-gray-300">#{job.id}</span>
                    <span className="text-sm font-medium truncate">{job.name}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {job.order_keyword && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-lg bg-gray-800 text-gray-400">{job.order_keyword}</span>
                    )}
                    <span className="text-[9px] text-gray-600">{job.planning_strategy} / {job.allocation_strategy}</span>
                  </div>
                </div>
                <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full flex-shrink-0 ml-2 ${jobColors[job.status]}`}>
                  {job.status}
                </span>
              </div>

              {/* Details */}
              <div className="flex items-center gap-3 text-[10px] text-gray-500 mb-3 flex-wrap">
                <span>Priority: {['', 'Low', 'Med', 'High', 'Crit'][job.priority]}</span>
                <span>Robots: {job.assigned_robot_ids?.length || 0}</span>
                <span>Tasks: {job.completed_tasks}/{job.total_tasks}</span>
              </div>

              {/* Progress */}
              <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden mb-3">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    job.status === 'completed' ? 'bg-green-500' :
                    job.status === 'failed' ? 'bg-red-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${job.total_tasks > 0 ? (job.completed_tasks / job.total_tasks) * 100 : 0}%` }}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                {['planned', 'allocated'].includes(job.status) && (
                  <button
                    onClick={() => handleStart(job.id)}
                    disabled={actionLoading === job.id}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-xl bg-green-500/15 text-green-400 active:bg-green-500/25 transition-all active:scale-95 disabled:opacity-40"
                  >
                    {actionLoading === job.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                    Start
                  </button>
                )}
                {['active', 'allocated', 'planned'].includes(job.status) && (
                  <button
                    onClick={() => handleCancel(job.id)}
                    disabled={actionLoading === job.id}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-xl bg-red-500/15 text-red-400 active:bg-red-500/25 transition-all active:scale-95 disabled:opacity-40"
                  >
                    {actionLoading === job.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
