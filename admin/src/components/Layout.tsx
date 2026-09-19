import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const navItems = [
  { to: '/drivers', label: 'Drivers' },
  { to: '/trips', label: 'Live trips' },
  { to: '/zones', label: 'Zones & fares' },
  { to: '/disputes', label: 'Disputes' },
  { to: '/audit-log', label: 'Audit log' },
];

export function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-slate-200 bg-white p-4">
        <div className="mb-6 px-2">
          <div className="text-lg font-bold text-teal-700">Monze Ride</div>
          <div className="text-xs text-slate-500">Admin</div>
        </div>
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm font-medium ${
                  isActive ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-8 border-t border-slate-200 pt-4 px-2 text-xs text-slate-500">
          <div>{user?.name}</div>
          <div>{user?.phoneNumber}</div>
          <button
            onClick={logout}
            className="mt-2 text-teal-700 underline hover:text-teal-900"
          >
            Log out
          </button>
        </div>
      </aside>
      <main className="flex-1 p-8">
        <Outlet />
      </main>
    </div>
  );
}
