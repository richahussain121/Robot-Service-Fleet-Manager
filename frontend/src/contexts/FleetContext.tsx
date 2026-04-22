import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { DashboardData, FleetUpdate } from '../models/types';
import { fetchDashboard, connectWebSocket } from '../services/api';

interface FleetContextType {
  data: DashboardData | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

const FleetContext = createContext<FleetContextType>({
  data: null,
  loading: true,
  error: null,
  refresh: () => {},
});

export function FleetProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const dashboard = await fetchDashboard();
      setData(dashboard);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();

    // Real-time updates via WebSocket
    const ws = connectWebSocket((update: FleetUpdate) => {
      if (update.type === 'fleet_update') {
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            fleet: update.fleet,
            robots: prev.robots.map((robot) => {
              const updated = update.robots.find((r) => r.id === robot.id);
              if (!updated) return robot;
              return {
                ...robot,
                status: updated.status as any,
                battery_soc: updated.battery_soc,
                pose_x: updated.pose.x,
                pose_y: updated.pose.y,
                pose_yaw: updated.pose.yaw,
                current_map: updated.map,
                current_floor: updated.floor,
                current_job_id: updated.job_id,
              };
            }),
          };
        });
      }
    });

    // Periodic full refresh every 30s
    const interval = setInterval(refresh, 30000);

    return () => {
      ws.close();
      clearInterval(interval);
    };
  }, [refresh]);

  return (
    <FleetContext.Provider value={{ data, loading, error, refresh }}>
      {children}
    </FleetContext.Provider>
  );
}

export const useFleet = () => useContext(FleetContext);
