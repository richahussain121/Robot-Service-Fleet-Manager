import { Routes, Route, Navigate } from 'react-router-dom';
import { FleetProvider } from './contexts/FleetContext';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import RobotsPage from './components/RobotsPage';
import JobsPage from './components/JobsPage';
import MapView from './components/MapView';

export default function App() {
  return (
    <FleetProvider>
      <div className="flex h-screen bg-gray-950">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/robots" element={<RobotsPage />} />
            <Route path="/jobs" element={<JobsPage />} />
            <Route path="/map" element={<MapView />} />
          </Routes>
        </main>
      </div>
    </FleetProvider>
  );
}
