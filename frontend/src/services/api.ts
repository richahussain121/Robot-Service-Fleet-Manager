const API_BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Request failed');
  }
  return res.json();
}

// Fleet
export const fetchDashboard = () => request<any>('/fleet/dashboard');
export const fetchStats = () => request<any>('/fleet/stats');

// Robots
export const fetchRobots = () => request<any[]>('/robots/');
export const fetchRobot = (id: string) => request<any>(`/robots/${id}`);
export const sendRobotCommand = (id: string, command: any) =>
  request<any>(`/robots/${id}/command`, { method: 'POST', body: JSON.stringify(command) });

// Jobs
export const fetchJobs = (status?: string) =>
  request<any[]>(`/jobs/${status ? `?status=${status}` : ''}`);
export const createOrder = (order: any) =>
  request<any>('/jobs/order', { method: 'POST', body: JSON.stringify(order) });
export const startJob = (id: number) =>
  request<any>(`/jobs/${id}/start`, { method: 'POST' });
export const cancelJob = (id: number) =>
  request<any>(`/jobs/${id}/cancel`, { method: 'POST' });

// Tasks
export const fetchTasks = (params?: { job_id?: number; robot_id?: string }) => {
  const qs = new URLSearchParams();
  if (params?.job_id) qs.set('job_id', String(params.job_id));
  if (params?.robot_id) qs.set('robot_id', params.robot_id);
  return request<any[]>(`/tasks/?${qs}`);
};

// WebSocket
export function connectWebSocket(onMessage: (data: any) => void): WebSocket {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
  ws.onmessage = (event) => {
    try {
      onMessage(JSON.parse(event.data));
    } catch {}
  };
  ws.onclose = () => {
    setTimeout(() => connectWebSocket(onMessage), 3000);
  };
  return ws;
}
