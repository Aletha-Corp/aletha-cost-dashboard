import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Layers, List, CloudCog, Users, ShieldAlert } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/', label: 'Summary', icon: LayoutDashboard },
  { to: '/resource-groups', label: 'Resource Groups', icon: Layers },
  { to: '/services', label: 'Services', icon: CloudCog },
  { to: '/personnel', label: 'Personnel', icon: Users },
  { to: '/entries', label: 'All Entries', icon: List },
  { to: '/security', label: 'Security', icon: ShieldAlert },
];

export function Sidebar() {
  return (
    <aside className="w-60 shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col min-h-screen">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-azure-600 rounded-lg flex items-center justify-center">
            <CloudCog size={16} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-100">Azure Costs</p>
            <p className="text-xs text-slate-500">Dashboard</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-azure-600/20 text-azure-300 border border-azure-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-slate-800">
        <p className="text-xs text-slate-600">Powered by Azure Cost Management API</p>
      </div>
    </aside>
  );
}
