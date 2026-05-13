import { useEffect, useState } from 'react';
import {
  Users,
  Ticket,
  ShoppingCart,
  TrendingUp,
  DollarSign,
  Award,
  CalendarDays,
  HandCoins,
} from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, formatDateTime } from '@/utils/helpers';
import { useAuth } from '@/context/AuthContext';
import { reportsApi, ReportSummary, TopNumber } from '@/services/api';
import { Ticket as TicketType } from '@/types';

type DashboardRange = 'today' | 'last7' | 'week' | 'month' | 'custom';
const DASHBOARD_RANGE_STORAGE_KEY = 'go_dashboard_selected_range';
const DASHBOARD_CUSTOM_FROM_STORAGE_KEY = 'go_dashboard_custom_from_date';
const DASHBOARD_CUSTOM_TO_STORAGE_KEY = 'go_dashboard_custom_to_date';

const DASHBOARD_RANGES: Array<{ key: DashboardRange; label: string; hint: string }> = [
  { key: 'today', label: 'Hoy', hint: 'Cierre diario' },
  { key: 'last7', label: 'Ultimos 7 dias', hint: 'Ventana movil' },
  { key: 'week', label: 'Esta semana', hint: 'Lun a hoy' },
  { key: 'month', label: 'Este mes', hint: 'Mes en curso' },
  { key: 'custom', label: 'Custom', hint: 'Rango manual' },
];

function isDashboardRange(value: string): value is DashboardRange {
  return DASHBOARD_RANGES.some((range) => range.key === value);
}

function toISODateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDateRange(range: DashboardRange): { fromDate: string; toDate: string } {
  const now = new Date();
  const start = new Date(now);

  if (range === 'today') {
    return { fromDate: toISODateLocal(now), toDate: toISODateLocal(now) };
  }

  if (range === 'last7') {
    start.setDate(now.getDate() - 6);
    return { fromDate: toISODateLocal(start), toDate: toISODateLocal(now) };
  }

  if (range === 'week') {
    const mondayOffset = (now.getDay() + 6) % 7;
    start.setDate(now.getDate() - mondayOffset);
    return { fromDate: toISODateLocal(start), toDate: toISODateLocal(now) };
  }

  start.setDate(1);
  return { fromDate: toISODateLocal(start), toDate: toISODateLocal(now) };
}

export default function DashboardPage() {
  const { user } = useAuth();

  const [stats, setStats] = useState<ReportSummary>({
    userCount: 0,
    drawCount: 0,
    ticketCount: 0,
    totalSales: 0,
    totalPrizes: 0,
    totalCommissions: 0,
  });

  const [recentTickets, setRecentTickets] = useState<TicketType[]>([]);
  const [topNumbers, setTopNumbers] = useState<TopNumber[]>([]);
  const [customFromDate, setCustomFromDate] = useState<string>(() => {
    const savedFromDate = localStorage.getItem(DASHBOARD_CUSTOM_FROM_STORAGE_KEY);
    return savedFromDate || toISODateLocal(new Date());
  });
  const [customToDate, setCustomToDate] = useState<string>(() => {
    const savedToDate = localStorage.getItem(DASHBOARD_CUSTOM_TO_STORAGE_KEY);
    return savedToDate || toISODateLocal(new Date());
  });
  const [selectedRange, setSelectedRange] = useState<DashboardRange>(() => {
    const savedRange = localStorage.getItem(DASHBOARD_RANGE_STORAGE_KEY);
    if (savedRange && isDashboardRange(savedRange)) {
      return savedRange;
    }
    return 'today';
  });

  useEffect(() => {
    localStorage.setItem(DASHBOARD_RANGE_STORAGE_KEY, selectedRange);
  }, [selectedRange]);

  useEffect(() => {
    localStorage.setItem(DASHBOARD_CUSTOM_FROM_STORAGE_KEY, customFromDate);
  }, [customFromDate]);

  useEffect(() => {
    localStorage.setItem(DASHBOARD_CUSTOM_TO_STORAGE_KEY, customToDate);
  }, [customToDate]);

  useEffect(() => {
    const isCustomRange = selectedRange === 'custom';
    if (isCustomRange && (!customFromDate || !customToDate || customFromDate > customToDate)) {
      return;
    }

    const { fromDate, toDate } = isCustomRange
      ? { fromDate: customFromDate, toDate: customToDate }
      : getDateRange(selectedRange);

    let isMounted = true;

    Promise.all([
      reportsApi.summary(undefined, fromDate, toDate),
      reportsApi.recentTickets(undefined, 5, fromDate, toDate),
      reportsApi.topNumbers(undefined, 10, fromDate, toDate),
    ])
      .then(([summaryData, recentData, topData]) => {
        if (!isMounted) return;
        setStats(summaryData);
        setRecentTickets(recentData);
        setTopNumbers(topData);
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [selectedRange, customFromDate, customToDate]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Bienvenido, {user?.fullName?.split(' ')[0]}
          </h1>
          <p className="text-slate-500 text-sm mt-1">Resumen del sistema</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-sm backdrop-blur">
          <div className="mb-2 flex items-center gap-2 px-2 text-xs font-medium uppercase tracking-wider text-slate-500">
            <CalendarDays size={14} />
            Periodo del dashboard
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
            {DASHBOARD_RANGES.map((range) => {
              const isActive = selectedRange === range.key;
              return (
                <button
                  key={range.key}
                  type="button"
                  onClick={() => setSelectedRange(range.key)}
                  className={`rounded-xl border px-3 py-2 text-left transition-all ${
                    isActive
                      ? 'border-blue-200 bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-sm'
                      : 'border-slate-200 bg-slate-50/70 text-slate-700 hover:border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  <p className="text-sm font-semibold leading-tight">{range.label}</p>
                  <p className={`text-[11px] ${isActive ? 'text-blue-100' : 'text-slate-500'}`}>
                    {range.hint}
                  </p>
                </button>
              );
            })}
          </div>

          {selectedRange === 'custom' && (
            <div className="mt-3 grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3 md:grid-cols-2">
              <label className="text-xs font-medium text-slate-600">
                Desde
                <input
                  type="date"
                  value={customFromDate}
                  onChange={(e) => setCustomFromDate(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <label className="text-xs font-medium text-slate-600">
                Hasta
                <input
                  type="date"
                  value={customToDate}
                  onChange={(e) => setCustomToDate(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              {customFromDate > customToDate && (
                <p className="md:col-span-2 text-xs text-red-600">
                  El rango es invalido: la fecha desde debe ser menor o igual que hasta.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <StatCard icon={<Users size={20} />} label="Usuarios" value={stats.userCount} color="blue" />
        <StatCard icon={<Ticket size={20} />} label="Sorteos" value={stats.drawCount} color="purple" />
        <StatCard icon={<ShoppingCart size={20} />} label="Tickets" value={stats.ticketCount} color="green" />
        <StatCard
          icon={<DollarSign size={20} />}
          label="Ventas Totales"
          value={formatCurrency(stats.totalSales)}
          color="orange"
        />
        <StatCard
          icon={<Award size={20} />}
          label="Premios"
          value={formatCurrency(stats.totalPrizes)}
          color="red"
        />
        <StatCard
          icon={<HandCoins size={20} />}
          label="Comisiones"
          value={formatCurrency(stats.totalCommissions)}
          color="indigo"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent tickets */}
        <Card>
          <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-2">
            <TrendingUp size={18} className="text-blue-600" />
            <h2 className="font-semibold text-slate-800">Tickets Recientes</h2>
          </div>
          <CardBody className="p-0">
            {recentTickets.length === 0 ? (
              <p className="text-slate-500 text-sm p-6 text-center">Sin tickets registrados</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-4 py-2 text-slate-600 font-medium">Código</th>
                    <th className="text-left px-4 py-2 text-slate-600 font-medium">Cliente</th>
                    <th className="text-right px-4 py-2 text-slate-600 font-medium">Total</th>
                    <th className="text-left px-4 py-2 text-slate-600 font-medium">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTickets.map((t) => (
                    <tr key={t.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-mono text-xs">{t.code}</td>
                      <td className="px-4 py-3">{t.customerName}</td>
                      <td className="px-4 py-3 text-right font-medium text-green-700">
                        {formatCurrency(t.total)}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {formatDateTime(t.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardBody>
        </Card>

        {/* Top numbers */}
        <Card>
          <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-2">
            <Award size={18} className="text-yellow-600" />
            <h2 className="font-semibold text-slate-800">Top 10 Números</h2>
          </div>
          <CardBody className="p-0">
            {topNumbers.length === 0 ? (
              <p className="text-slate-500 text-sm p-6 text-center">Sin datos de ventas</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {topNumbers.map((n, i) => (
                  <div key={n.number} className="flex items-center gap-3 px-4 py-3">
                    <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <Badge variant="info">{n.number}</Badge>
                    <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{
                          width: `${Math.round((n.total / topNumbers[0].total) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium text-slate-700">
                      {formatCurrency(n.total)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: 'blue' | 'purple' | 'green' | 'orange' | 'red' | 'indigo';
}) {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
    green: 'bg-green-50 text-green-600',
    orange: 'bg-orange-50 text-orange-600',
    red: 'bg-red-50 text-red-600',
    indigo: 'bg-indigo-50 text-indigo-600',
  };
  return (
    <Card className="p-4">
      <div className={`inline-flex p-2 rounded-lg ${colorMap[color]} mb-3`}>{icon}</div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-sm text-slate-500 mt-0.5">{label}</p>
    </Card>
  );
}
