import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  CreditCard,
  Ticket,
  ShoppingCart,
  HandCoins,
  BarChart3,
  ChevronDown,
  ChevronRight,
  LogOut,
  Menu,
  X,
  PrinterCheck,
  Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { UserRole } from '@/types';

interface NavItem {
  to?: string;
  label: string;
  icon: React.ReactNode;
  roles: UserRole[];
  children?: Array<{ to: string; label: string; roles: UserRole[] }>;
}

const NAV_ITEMS: NavItem[] = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    icon: <LayoutDashboard size={18} />,
    roles: ['admin', 'asociado', 'vendedor'],
  },
  {
    to: '/users',
    label: 'Usuarios',
    icon: <Users size={18} />,
    roles: ['admin', 'asociado'],
  },
  {
    to: '/roles',
    label: 'Roles',
    icon: <ShieldCheck size={18} />,
    roles: ['admin'],
  },
  {
    to: '/plans',
    label: 'Planes',
    icon: <CreditCard size={18} />,
    roles: ['admin', 'asociado'],
  },
  {
    to: '/draws',
    label: 'Sorteos',
    icon: <Ticket size={18} />,
    roles: ['admin', 'asociado'],
  },
  {
    to: '/multiplicadores',
    label: 'Multiplicadores especiales',
    icon: <Zap size={18} />,
    roles: ['admin'],
  },
  {
    to: '/sales',
    label: 'Ventas',
    icon: <ShoppingCart size={18} />,
    roles: ['admin', 'asociado', 'vendedor'],
  },
  {
    to: '/ticket-payments',
    label: 'Pago de tickets',
    icon: <HandCoins size={18} />,
    roles: ['admin', 'asociado', 'vendedor'],
  },
  {
    to: '/print-queue',
    label: 'Cola de impresión',
    icon: <PrinterCheck size={18} />,
    roles: ['admin', 'asociado', 'vendedor'],
  },
  {
    to: '/reports',
    label: 'Reportes',
    icon: <BarChart3 size={18} />,
    roles: ['admin', 'asociado'],
    children: [
      {
        to: '/reports/sales-stats',
        label: 'Estadisctica de ventas',
        roles: ['admin', 'asociado'],
      },
      {
        to: '/reports/balance-breakdown',
        label: 'Desglose de balance por asociados/vendedores',
        roles: ['admin', 'asociado'],
      },
      {
        to: '/reports/sales-by-user',
        label: 'Ventas por usuario / tickets',
        roles: ['admin', 'asociado'],
      },
      {
        to: '/reports/draw-lists',
        label: 'Listas de sorteos',
        roles: ['admin', 'asociado'],
      },
    ],
  },
];

export function Sidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(location.pathname.startsWith('/reports'));

  useEffect(() => {
    setReportsOpen(location.pathname.startsWith('/reports'));
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const visibleItems = NAV_ITEMS.filter(
    (item) => user && item.roles.includes(user.role)
  );

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-2 px-6 py-5 border-b border-slate-700">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
          GO
        </div>
        <div>
          <p className="text-white font-semibold text-sm leading-tight">GameOver</p>
          <p className="text-slate-400 text-xs">Lotería Sistema</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {visibleItems.map((item) => {
          if (item.children && item.children.length > 0) {
            const childItems = item.children.filter((child) => user && child.roles.includes(user.role));
            if (childItems.length === 0) return null;

            const isParentActive = childItems.some((child) => location.pathname.startsWith(child.to));

            return (
              <div key={item.label} className="space-y-1">
                <button
                  type="button"
                  onClick={() => setReportsOpen((v) => !v)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isParentActive
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  {item.icon}
                  <span className="flex-1 text-left">{item.label}</span>
                  {reportsOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>

                {reportsOpen && (
                  <div className="pl-8 space-y-1">
                    {childItems.map((child) => (
                      <NavLink
                        key={child.to}
                        to={child.to}
                        onClick={() => setOpen(false)}
                        className={({ isActive }) =>
                          `flex items-center px-3 py-2 rounded-lg text-sm transition-colors ${
                            isActive
                              ? 'bg-slate-700 text-white'
                              : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                          }`
                        }
                      >
                        {child.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return (
            <NavLink
              key={item.to}
              to={item.to!}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                }`
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      {/* User info */}
      <div className="px-4 py-4 border-t border-slate-700">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold uppercase">
            {user?.fullName?.[0] ?? 'U'}
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-medium truncate">{user?.fullName}</p>
            <p className="text-slate-400 text-xs capitalize">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg text-sm transition-colors"
        >
          <LogOut size={16} />
          Cerrar sesión
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        className="fixed top-4 left-4 z-50 lg:hidden bg-slate-800 text-white p-2 rounded-lg"
        onClick={() => setOpen(!open)}
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar desktop */}
      <aside className="hidden lg:flex flex-col w-60 bg-slate-800 min-h-screen fixed left-0 top-0 bottom-0 z-30">
        <SidebarContent />
      </aside>

      {/* Sidebar mobile */}
      <aside
        className={`flex flex-col w-60 bg-slate-800 fixed left-0 top-0 bottom-0 z-50 transform transition-transform lg:hidden ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <SidebarContent />
      </aside>
    </>
  );
}
