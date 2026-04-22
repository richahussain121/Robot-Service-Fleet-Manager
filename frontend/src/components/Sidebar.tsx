import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Bot, ClipboardList, Map } from 'lucide-react';

const links = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/robots', label: 'Robots', icon: Bot },
  { to: '/jobs', label: 'Jobs', icon: ClipboardList },
  { to: '/map', label: 'Fleet Map', icon: Map },
];

export default function Sidebar() {
  return (
    <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
      <div className="p-6 border-b border-gray-800">
        <h1 className="text-lg font-bold text-white flex items-center gap-2">
          <Bot className="w-6 h-6 text-blue-400" />
          Fleet Command
        </h1>
        <p className="text-xs text-gray-500 mt-1">Robot Service Management</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <Icon className="w-4 h-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-800">
        <div className="text-xs text-gray-600">
          <p>Pudu + Keenon Fleet</p>
          <p>v1.0.0</p>
        </div>
      </div>
    </aside>
  );
}
