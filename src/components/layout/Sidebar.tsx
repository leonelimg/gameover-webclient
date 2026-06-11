import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  CircleDollarSign,
  LayoutDashboard,
  ShieldCheck,
  CreditCard,
  Ticket,
  ShoppingCart,
  HandCoins,
  BarChart3,
  ChevronRight,
  LogOut,
  Menu,
  X,
  PrinterCheck,
  Wallet,
  Bell,
  RefreshCcw,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { cashMovementsApi } from '@/services/api';
import { formatCurrency } from '@/utils/helpers';
import { toISODateLocal } from '@/utils/dateRanges';
import logoPM from '@/assets/logoPM.svg';

interface NavItem {
  to?: string;
  label: string;
  icon: React.ReactNode;
  permissionKey?: string;
  children?: NavItemChild[];
}

interface NavItemChild {
  to: string;
  label: string;
  permissionKey?: string;
  children?: Array<{ to: string; label: string; permissionKey?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    icon: <LayoutDashboard size={18} />,
  },
  {
    to: '/plans',
    label: 'Planes',
    icon: <CreditCard size={18} />,
  },
  {
    to: '/draws',
    label: 'Sorteos',
    icon: <Ticket size={18} />,
  },
  {
    to: '/sales',
    label: 'Ventas',
    icon: <ShoppingCart size={18} />,
  },
  {
    to: '/ticket-payments',
    label: 'Pago de tickets',
    icon: <HandCoins size={18} />,
  },
  {
    to: '/cash-movements',
    label: 'Depositos y retiros',
    icon: <Wallet size={18} />,
  },
  {
    to: '/announcements',
    label: 'Anuncios',
    icon: <Bell size={18} />,
  },
  {
    to: '/print-queue',
    label: 'Cola de impresión',
    icon: <PrinterCheck size={18} />,
  },
  {
    to: '/reports',
    label: 'Reportes',
    icon: <BarChart3 size={18} />,
    children: [
      {
        to: '/reports/sales-stats',
        label: 'Estadisctica de ventas',
      },
      {
        to: '/reports/balance-breakdown',
        label: 'Desglose de balance por asociados/vendedores',
      },
      {
        to: '/reports/sales-by-user',
        label: 'Ventas por usuario / tickets',
      },
      {
        to: '/reports/draw-lists',
        label: 'Listas de sorteos',
      },
      {
        to: '/reports/commissions',
        label: 'Comisiones',
      },
    ],
  },
  {
    label: 'Configuraciones',
    icon: <ShieldCheck size={18} />,
    children: [
      {
        to: '/users',
        label: 'Usuarios',
      },
      {
        to: '/roles',
        label: 'Roles',
      },
      {
        to: '/restrictions',
        label: 'Restricciones',
        children: [
          {
            to: '/restrictions/global',
            label: 'Global',
          },
          {
            to: '/restrictions/user-global',
            label: 'Global por usuario',
          },
          {
            to: '/restrictions/user-sales-limit',
            label: 'Venta por usuario',
          },
        ],
      },
      {
        to: '/multiplicadores',
        label: 'Multiplicadores especiales',
      },
      {
        to: '/frontend-settings',
        label: 'Config. tickets',
        permissionKey: '/roles:update',
      },
    ],
  },
];

export function Sidebar() {
  const { user, logout, hasPermission } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState<Record<string, boolean>>({
    Reportes: location.pathname.startsWith('/reports'),
    Configuraciones:
      location.pathname.startsWith('/users') ||
      location.pathname.startsWith('/roles') ||
      location.pathname.startsWith('/restrictions') ||
      location.pathname.startsWith('/multiplicadores') ||
      location.pathname.startsWith('/frontend-settings'),
    'Configuraciones-Restricciones': location.pathname.startsWith('/restrictions'),
  });
  const [finalBalance, setFinalBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  const loadFinalBalance = useCallback(async () => {
    if (!user?.id) {
      setFinalBalance(null);
      return;
    }

    setBalanceLoading(true);
    try {
      const today = toISODateLocal(new Date());
      const response = await cashMovementsApi.balance({
        targetUserId: user.id,
        fromDate: today,
        toDate: today,
      });

      setFinalBalance(response.totals.balance);
    } catch {
      setFinalBalance(null);
    } finally {
      setBalanceLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadFinalBalance();
  }, [loadFinalBalance]);

  useEffect(() => {
    setGroupOpen((prev) => ({
      ...prev,
      Reportes: location.pathname.startsWith('/reports'),
      Configuraciones:
        location.pathname.startsWith('/users') ||
        location.pathname.startsWith('/roles') ||
        location.pathname.startsWith('/restrictions') ||
        location.pathname.startsWith('/multiplicadores') ||
        location.pathname.startsWith('/frontend-settings'),
      'Configuraciones-Restricciones': location.pathname.startsWith('/restrictions'),
    }));
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.children && item.children.length > 0) {
      return item.children.some((child) => {
        if (child.children && child.children.length > 0) {
          return child.children.some((nestedChild) => hasPermission(nestedChild.permissionKey ?? nestedChild.to));
        }
        return hasPermission(child.permissionKey ?? child.to);
      });
    }
    if (!item.to) {
      return false;
    }
    return hasPermission(item.permissionKey ?? item.to);
  });

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-slate-700 text-center">
        <img src={logoPM} alt="PM Comercial" className="w-16 h-16 mx-auto object-contain" />
        <div className="mt-3">
          <p className="text-white font-semibold text-base leading-tight">PM Comercial</p>
          <p className="text-slate-400 text-xs">Venta de Tickets</p>
        </div>
      </div>

      <div className="px-4 py-4 border-b border-slate-700">
        <div className="relative rounded-xl border border-emerald-800/60 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/55 px-3 py-3 shadow-[0_0_0_1px_rgba(16,185,129,0.08)]">
          <button
            type="button"
            onClick={loadFinalBalance}
            disabled={balanceLoading || !user?.id}
            className="absolute right-2 top-2 rounded-md p-1 text-emerald-300/90 hover:bg-emerald-900/40 hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Refrescar balance final"
            title="Refrescar balance final"
          >
            <RefreshCcw size={13} className={balanceLoading ? 'animate-spin' : ''} />
          </button>
          <div className="flex items-center gap-2 text-emerald-300 text-xs uppercase tracking-wide">
            <CircleDollarSign size={14} />
            Balance final
          </div>
          <p
            className={`mt-2 text-lg font-semibold ${
              finalBalance === null
                ? 'text-slate-300'
                : finalBalance >= 0
                  ? 'text-emerald-300'
                  : 'text-rose-300'
            }`}
          >
            {balanceLoading ? 'Cargando...' : finalBalance !== null ? formatCurrency(finalBalance) : 'No disponible'}
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="sidebar-scrollbar flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {visibleItems.map((item) => {
          if (item.children && item.children.length > 0) {
            const childItems = item.children.filter((child) => {
              if (child.children && child.children.length > 0) {
                return child.children.some((nestedChild) => hasPermission(nestedChild.permissionKey ?? nestedChild.to));
              }
              return hasPermission(child.permissionKey ?? child.to);
            });
            if (childItems.length === 0) return null;

            const isParentActive = childItems.some((child) => {
              if (child.children && child.children.length > 0) {
                return child.children.some((nestedChild) => location.pathname.startsWith(nestedChild.to));
              }
              return location.pathname.startsWith(child.to);
            });
            const isOpen = groupOpen[item.label] ?? isParentActive;

            return (
              <div key={item.label} className="space-y-1">
                <button
                  type="button"
                  onClick={() => setGroupOpen((prev) => ({ ...prev, [item.label]: !isOpen }))}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isParentActive
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  {item.icon}
                  <span className="flex-1 text-left">{item.label}</span>
                  <ChevronRight
                    size={16}
                    className={`transition-transform duration-200 ${isOpen ? 'rotate-90' : 'rotate-0'}`}
                  />
                </button>

                <div className={`sidebar-submenu ${isOpen ? 'is-open' : ''}`}>
                  <div className="sidebar-submenu-content pl-8 space-y-1">
                    {childItems.map((child) => (
                      child.children && child.children.length > 0 ? (
                        <div key={`${item.label}-${child.label}`} className="space-y-1">
                          <button
                            type="button"
                            onClick={() =>
                              setGroupOpen((prev) => ({
                                ...prev,
                                [`${item.label}-${child.label}`]: !(prev[`${item.label}-${child.label}`] ?? false),
                              }))
                            }
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                              child.children.some((nestedChild) => location.pathname.startsWith(nestedChild.to))
                                ? 'bg-slate-700 text-white'
                                : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                            }`}
                          >
                            <span className="flex-1 text-left">{child.label}</span>
                            <ChevronRight
                              size={14}
                              className={`transition-transform duration-200 ${
                                groupOpen[`${item.label}-${child.label}`] ??
                                child.children.some((nestedChild) => location.pathname.startsWith(nestedChild.to))
                                  ? 'rotate-90'
                                  : 'rotate-0'
                              }`}
                            />
                          </button>
                          <div
                            className={`sidebar-submenu ${
                              (groupOpen[`${item.label}-${child.label}`] ??
                                child.children.some((nestedChild) => location.pathname.startsWith(nestedChild.to)))
                                ? 'is-open'
                                : ''
                            }`}
                          >
                            <div className="sidebar-submenu-content pl-4 space-y-1">
                              {child.children
                                .filter((nestedChild) => hasPermission(nestedChild.permissionKey ?? nestedChild.to))
                                .map((nestedChild) => (
                                  <NavLink
                                    key={nestedChild.to}
                                    to={nestedChild.to}
                                    onClick={() => setOpen(false)}
                                    className={({ isActive }) =>
                                      `flex items-center px-3 py-2 rounded-lg text-sm transition-colors ${
                                        isActive
                                          ? 'bg-slate-700 text-white'
                                          : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                                      }`
                                    }
                                  >
                                    {nestedChild.label}
                                  </NavLink>
                                ))}
                            </div>
                          </div>
                        </div>
                      ) : (
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
                      )
                    ))}
                  </div>
                </div>
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
        {renderSidebarContent()}
      </aside>

      {/* Sidebar mobile */}
      <aside
        className={`flex flex-col w-60 bg-slate-800 fixed left-0 top-0 bottom-0 z-50 transform transition-transform lg:hidden ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {renderSidebarContent()}
      </aside>
    </>
  );
}
