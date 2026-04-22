import { useState } from 'react';
import { Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom';
import { FleetProvider } from './contexts/FleetContext';
import Dashboard from './components/Dashboard';
import RobotsPage from './components/RobotsPage';
import JobsPage from './components/JobsPage';
import MapView from './components/MapView';
import WorkflowPage from './components/WorkflowPage';
import {
  LayoutDashboard, Bot, ClipboardList, Map, Workflow,
  Menu, X, ChevronRight
} from 'lucide-react';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/workflow', label: 'Workflow', icon: Workflow },
  { to: '/robots', label: 'Robots', icon: Bot },
  { to: '/jobs', label: 'Jobs', icon: ClipboardList },
  { to: '/map', label: 'Map', icon: Map },
];

function MobileBottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-gray-900/95 backdrop-blur-lg border-t border-gray-800 pb-safe-b md:hidden">
      <div className="flex items-center justify-around px-2 py-1">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl text-[10px] font-medium transition-all ${
                isActive
                  ? 'text-blue-400 scale-105'
                  : 'text-gray-500 active:scale-95'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className={`p-1.5 rounded-xl transition-colors ${isActive ? 'bg-blue-500/15' : ''}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

function DesktopSidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`hidden md:flex flex-col bg-gray-900 border-r border-gray-800 transition-all duration-300 ${
        collapsed ? 'w-[72px]' : 'w-64'
      }`}
    >
      <div className="p-4 border-b border-gray-800 flex items-center justify-between">
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white leading-tight">Fleet Command</h1>
              <p className="text-[10px] text-gray-500">Robot Service Manager</p>
            </div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400"
        >
          <ChevronRight className={`w-4 h-4 transition-transform ${collapsed ? '' : 'rotate-180'}`} />
        </button>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-blue-600/15 text-blue-400 border border-blue-500/20'
                  : 'text-gray-400 hover:bg-gray-800/60 hover:text-white border border-transparent'
              }`
            }
            title={collapsed ? label : undefined}
          >
            <Icon className="w-[18px] h-[18px] flex-shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {!collapsed && (
        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center gap-2 text-[10px] text-gray-600">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span>System Online</span>
          </div>
        </div>
      )}
    </aside>
  );
}

function MobileHeader() {
  const location = useLocation();
  const current = navItems.find((n) => location.pathname.startsWith(n.to));

  return (
    <header className="sticky top-0 z-40 bg-gray-950/90 backdrop-blur-lg border-b border-gray-800 px-4 py-3 md:hidden">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
          <Bot className="w-4 h-4 text-white" />
        </div>
        <div>
          <h1 className="text-sm font-bold leading-tight">{current?.label || 'Fleet Command'}</h1>
          <p className="text-[10px] text-gray-500">Robot Service Manager</p>
        </div>
      </div>
    </header>
  );
}

export default function App() {
  return (
    <FleetProvider>
      <div className="flex h-[100dvh] bg-gray-950 overflow-hidden">
        <DesktopSidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <MobileHeader />
          <main className="flex-1 overflow-y-auto pb-20 md:pb-0 scrollbar-hide">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/workflow" element={<WorkflowPage />} />
              <Route path="/robots" element={<RobotsPage />} />
              <Route path="/jobs" element={<JobsPage />} />
              <Route path="/map" element={<MapView />} />
            </Routes>
          </main>
        </div>
        <MobileBottomNav />
      </div>
    </FleetProvider>
  );
}
