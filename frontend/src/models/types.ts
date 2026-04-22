export interface Robot {
  id: string;
  name: string;
  vendor: 'pudu' | 'keenon' | 'generic';
  model: string;
  robot_type: 'delivery' | 'cleaning' | 'logistics' | 'disinfection' | 'multipurpose';
  status: 'standby' | 'charging' | 'assigned' | 'executing' | 'returning' | 'error' | 'offline' | 'maintenance';
  capabilities: string[];
  battery_soc: number;
  pose_x: number;
  pose_y: number;
  pose_yaw: number;
  current_map: string;
  current_floor: number;
  current_job_id: string | null;
  charging_station: string;
  load_capacity_kg: number;
  last_heartbeat: string;
  ip_address: string;
  created_at: string;
}

export interface Task {
  id: number;
  description: string;
  task_type: string;
  status: 'pending' | 'queued' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  priority: number;
  job_id: number | null;
  robot_id: string | null;
  robot_type: string | null;
  dependency_task_ids: number[];
  target_location_name: string;
  result_message: string;
  estimated_duration_sec: number;
  actual_duration_sec: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface Job {
  id: number;
  name: string;
  description: string;
  status: 'pending' | 'planned' | 'allocated' | 'active' | 'completed' | 'failed' | 'cancelled';
  planning_strategy: string;
  allocation_strategy: string;
  task_ids: number[];
  total_tasks: number;
  completed_tasks: number;
  current_task_index: number;
  assigned_robot_ids: string[];
  priority: number;
  order_keyword: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface FleetSnapshot {
  total_robots: number;
  online: number;
  standby: number;
  charging: number;
  executing: number;
  error: number;
  offline: number;
  active_jobs: number;
  pending_jobs: number;
  completed_jobs_today: number;
}

export interface DashboardData {
  fleet: FleetSnapshot;
  robots: Robot[];
  active_jobs: Job[];
  recent_tasks: Task[];
}

export interface FleetUpdate {
  type: 'fleet_update';
  timestamp: string;
  fleet: FleetSnapshot;
  robots: {
    id: string;
    name: string;
    vendor: string;
    model: string;
    type: string;
    status: string;
    battery_soc: number;
    pose: { x: number; y: number; yaw: number };
    map: string;
    floor: number;
    job_id: string | null;
  }[];
}
