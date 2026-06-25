import { Fragment, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, DollarSign, Award, HandCoins, TrendingUp } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { DateRangeSegmentedControl } from '@/components/ui/DateRangeSegmentedControl';
import {
  drawsApi,
  reportsApi,
  usersApi,
  BalanceBreakdownResponse,
  BalanceBreakdownTotals,
  AssociateBreakdownRow,
  AssociateDrawBreakdownRow,
} from '@/services/api';
import { Draw, User } from '@/types';
import { formatCurrency, formatDateTime, formatDrawLabel } from '@/utils/helpers';
import { DateRange, getDateRange, isDateRange, toISODateLocal } from '@/utils/dateRanges';
import { useAuth } from '@/context/AuthContext';

const BALANCE_RANGE_KEY = 'go_balance_selected_range';
const BALANCE_CUSTOM_FROM_KEY = 'go_balance_custom_from_date';
const BALANCE_CUSTOM_TO_KEY = 'go_balance_custom_to_date';

const EMPTY_TOTALS: BalanceBreakdownTotals = {
  ticketCount: 0,
  totalSales: 0,
  totalPrizes: 0,
  totalCommissions: 0,
  totalAssociateCommissions: 0,
  balance: 0,
};

const EMPTY_REPORT: BalanceBreakdownResponse = {
  filters: {
    drawId: null,
    userId: null,
    fromDate: null,
    toDate: null,
  },
  totals: EMPTY_TOTALS,
  rows: [],
  byVendor: {
    totals: EMPTY_TOTALS,
    rows: [],
  },
  byDraw: {
    totals: EMPTY_TOTALS,
    rows: [],
  },
  byAssociate: {
    totals: EMPTY_TOTALS,
    rows: [],
  },
};

function EventRow({
  event,
  totals,
  indented = false,
  variant = 'draw',
  expandable = false,
  isExpanded = false,
  onToggleExpand,
  showAssociateCommission = false,
}: {
  event: string;
  totals: BalanceBreakdownTotals;
  indented?: boolean;
  bold?: boolean;
  variant?: 'grand-total' | 'associate-total' | 'draw';
  expandable?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  showAssociateCommission?: boolean;
}) {
  const rowClass =
    variant === 'grand-total'
      ? 'bg-emerald-100 border-emerald-300 hover:bg-emerald-200'
      : variant === 'associate-total'
        ? 'bg-blue-100 border-blue-200 hover:bg-blue-200'
        : 'bg-white border-slate-100 hover:bg-slate-50';

  const textClass =
    variant === 'grand-total'
      ? 'font-bold text-slate-950'
      : variant === 'associate-total'
        ? 'font-semibold text-slate-900'
        : 'font-medium text-slate-800';

  const eventTextClass =
    variant === 'grand-total'
      ? 'text-emerald-950'
      : variant === 'associate-total'
        ? 'text-blue-950'
        : 'text-slate-700';

  const salesColorClass =
    variant === 'grand-total'
      ? 'text-green-900'
      : variant === 'associate-total'
        ? 'text-green-800'
        : 'text-green-700';

  const prizesColorClass =
    variant === 'grand-total'
      ? 'text-amber-900'
      : variant === 'associate-total'
        ? 'text-amber-800'
        : 'text-amber-700';

  const balanceColorClass =
    totals.balance >= 0
      ? variant === 'grand-total'
        ? 'text-emerald-900'
        : variant === 'associate-total'
          ? 'text-emerald-800'
          : 'text-emerald-700'
      : variant === 'grand-total'
        ? 'text-red-900'
        : variant === 'associate-total'
          ? 'text-red-800'
          : 'text-red-700';

  const commissionsColorClass =
    variant === 'grand-total'
      ? 'text-blue-900'
      : variant === 'associate-total'
        ? 'text-blue-800'
        : 'text-blue-700';

  return (
    <tr
      className={`border-t ${rowClass} ${expandable && onToggleExpand ? 'cursor-pointer' : ''}`}
      onClick={expandable && onToggleExpand ? onToggleExpand : undefined}
    >
      <td className={`px-4 py-3 ${eventTextClass} ${textClass} ${indented ? 'pl-10' : ''}`}>
        <div className="flex items-center gap-2">
          {expandable && onToggleExpand && (
            <span className="text-slate-400 flex-shrink-0">
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </span>
          )}
          {expandable && !onToggleExpand && <span className="w-4 flex-shrink-0" />}
          <span>{event}</span>
        </div>
      </td>
      <td className={`px-4 py-3 text-center ${textClass}`}>{totals.ticketCount}</td>
      <td className={`px-4 py-3 text-right ${salesColorClass} ${textClass}`}>{formatCurrency(totals.totalSales)}</td>
      <td className={`px-4 py-3 text-right ${prizesColorClass} ${textClass}`}>{formatCurrency(totals.totalPrizes)}</td>
      <td className={`px-4 py-3 text-right ${balanceColorClass} ${textClass}`}>
        {formatCurrency(totals.balance)}
      </td>
      <td className={`px-4 py-3 text-right ${commissionsColorClass} ${textClass}`}>{formatCurrency(totals.totalCommissions)}</td>
      {showAssociateCommission && (
        <td className={`px-4 py-3 text-right ${commissionsColorClass} ${textClass}`}>
          {formatCurrency(totals.totalAssociateCommissions ?? 0)}
        </td>
      )}
    </tr>
  );
}

function mapAssociateToTotals(row: AssociateBreakdownRow): BalanceBreakdownTotals {
  return {
    ticketCount: row.ticketCount,
    totalSales: row.totalSales,
    totalPrizes: row.totalPrizes,
    totalCommissions: row.totalCommissions,
    totalAssociateCommissions: row.totalAssociateCommissions,
    balance: row.balance,
  };
}

function mapDrawToTotals(row: AssociateDrawBreakdownRow): BalanceBreakdownTotals {
  return {
    ticketCount: row.ticketCount,
    totalSales: row.totalSales,
    totalPrizes: row.totalPrizes,
    totalCommissions: row.totalCommissions,
    totalAssociateCommissions: row.totalAssociateCommissions,
    balance: row.balance,
  };
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
  const styleMap = {
    blue: {
      card: 'bg-slate-900 border-slate-800 border-t-4 border-t-blue-500 text-white shadow-sm hover:border-slate-700',
      icon: 'bg-slate-950 text-blue-400',
      value: 'text-white font-bold',
      label: 'text-slate-400',
    },
    purple: {
      card: 'bg-slate-900 border-slate-800 border-t-4 border-t-violet-500 text-white shadow-sm hover:border-slate-700',
      icon: 'bg-slate-950 text-violet-400',
      value: 'text-white font-bold',
      label: 'text-slate-400',
    },
    green: {
      card: 'bg-slate-900 border-slate-800 border-t-4 border-t-emerald-500 text-white shadow-sm hover:border-slate-700',
      icon: 'bg-slate-950 text-emerald-400',
      value: 'text-white font-bold',
      label: 'text-slate-400',
    },
    orange: {
      card: 'bg-slate-900 border-slate-800 border-t-4 border-t-orange-500 text-white shadow-sm hover:border-slate-700',
      icon: 'bg-slate-950 text-orange-400',
      value: 'text-white font-bold',
      label: 'text-slate-400',
    },
    red: {
      card: 'bg-slate-900 border-slate-800 border-t-4 border-t-red-500 text-white shadow-sm hover:border-slate-700',
      icon: 'bg-slate-950 text-red-400',
      value: 'text-white font-bold',
      label: 'text-slate-400',
    },
    indigo: {
      card: 'bg-slate-900 border-slate-800 border-t-4 border-t-indigo-500 text-white shadow-sm hover:border-slate-700',
      icon: 'bg-slate-950 text-indigo-400',
      value: 'text-white font-bold',
      label: 'text-slate-400',
    },
  };

  const styles = styleMap[color];

  return (
    <div className={`p-2.5 px-3 rounded-xl border shadow-sm transition-all duration-300 flex items-center gap-3 ${styles.card}`}>
      <div className={`inline-flex p-1.5 rounded-lg ${styles.icon} flex-shrink-0`}>{icon}</div>
      <div>
        <p className={`text-xs font-medium ${styles.label} leading-none`}>{label}</p>
        <p className={`text-xl font-bold ${styles.value} mt-1.5 leading-none`}>{value}</p>
      </div>
    </div>
  );
}

export default function BalanceBreakdownPage() {
  const { user } = useAuth();
  const showAssociateCommission = user?.role === 'admin' || user?.role === 'asociado';

  const [draws, setDraws] = useState<Draw[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedDrawId, setSelectedDrawId] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [customFromDate, setCustomFromDate] = useState<string>(() => {
    const saved = localStorage.getItem(BALANCE_CUSTOM_FROM_KEY);
    return saved || toISODateLocal(new Date());
  });
  const [customToDate, setCustomToDate] = useState<string>(() => {
    const saved = localStorage.getItem(BALANCE_CUSTOM_TO_KEY);
    return saved || toISODateLocal(new Date());
  });
  const [selectedRange, setSelectedRange] = useState<DateRange>(() => {
    const saved = localStorage.getItem(BALANCE_RANGE_KEY);
    if (saved && isDateRange(saved)) {
      return saved;
    }
    return 'today';
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState<BalanceBreakdownResponse>(EMPTY_REPORT);

  useEffect(() => {
    drawsApi.list().then(setDraws).catch(() => {});
    usersApi.list().then(setUsers).catch(() => {});
  }, []);

  useEffect(() => {
    localStorage.setItem(BALANCE_RANGE_KEY, selectedRange);
  }, [selectedRange]);

  useEffect(() => {
    localStorage.setItem(BALANCE_CUSTOM_FROM_KEY, customFromDate);
  }, [customFromDate]);

  useEffect(() => {
    localStorage.setItem(BALANCE_CUSTOM_TO_KEY, customToDate);
  }, [customToDate]);

  const filteredDraws = useMemo(() => {
    const isCustomRange = selectedRange === 'custom';
    if (isCustomRange && (!customFromDate || !customToDate || customFromDate > customToDate)) {
      return [];
    }
    const { fromDate, toDate } = isCustomRange
      ? { fromDate: customFromDate, toDate: customToDate }
      : getDateRange(selectedRange);

    return draws.filter((d) => {
      const drawDate = toISODateLocal(new Date(d.closeTime));
      return drawDate >= fromDate && drawDate <= toDate;
    });
  }, [draws, selectedRange, customFromDate, customToDate]);

  useEffect(() => {
    if (selectedDrawId && !filteredDraws.some((d) => d.id === selectedDrawId)) {
      setSelectedDrawId('');
    }
  }, [filteredDraws, selectedDrawId]);

  useEffect(() => {
    setLoading(true);
    setError('');

    const isCustomRange = selectedRange === 'custom';
    if (isCustomRange && (!customFromDate || !customToDate || customFromDate > customToDate)) {
      setReport(EMPTY_REPORT);
      setLoading(false);
      return;
    }

    const { fromDate, toDate } = isCustomRange
      ? { fromDate: customFromDate, toDate: customToDate }
      : getDateRange(selectedRange);

    if (selectedDrawId && !filteredDraws.some((d) => d.id === selectedDrawId)) {
      return;
    }

    reportsApi.balanceBreakdown({
      drawId: selectedDrawId || undefined,
      userId: selectedUserId || undefined,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
    })
      .then((data) => {
        setReport(data); // Keeping this line for updated report with expand logic
        // Collapse all users by default when loading data or filtering
        setExpandedUsers(new Set());
      })
      .catch((err: unknown) => {
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
        setError(msg ?? 'No fue posible cargar el reporte.');
        setReport(EMPTY_REPORT);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [selectedDrawId, selectedUserId, selectedRange, customFromDate, customToDate, filteredDraws]);

  const resetFilters = () => {
    setSelectedDrawId('');
    setSelectedUserId('');
    setSelectedRange('today');
  };

  const toggleUserExpand = (userId: string) => {
    setExpandedUsers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  const isRowVisible = (row: AssociateBreakdownRow, rows: AssociateBreakdownRow[]): boolean => {
    if (!row.parentId) return true;
    const parentRow = rows.find((r) => r.associateId === row.parentId);
    if (!parentRow) return true;
    return expandedUsers.has(row.parentId) && isRowVisible(parentRow, rows);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Desglose de balance por asociados</h1>
        <p className="text-sm text-slate-500">Totales, asociado y sorteos en una sola tabla</p>
      </div>

      {/* Date range filter */}
      <DateRangeSegmentedControl
        selectedRange={selectedRange}
        onRangeChange={setSelectedRange}
        customFromDate={customFromDate}
        customToDate={customToDate}
        onCustomFromDateChange={setCustomFromDate}
        onCustomToDateChange={setCustomToDate}
      />

      {/* Additional filters */}
      <Card>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <Select
              label="Sorteo"
              value={selectedDrawId}
              onChange={(e) => setSelectedDrawId(e.target.value)}
              options={[
                { value: '', label: 'Todos los sorteos' },
                ...filteredDraws.map((d) => ({
                  value: d.id,
                  label: formatDrawLabel(d),
                })),
              ]}
            />
            <Select
              label="Usuario vendedor"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              options={[
                { value: '', label: 'Todos los usuarios' },
                ...users.map((u) => ({ value: u.id, label: `${u.fullName} (${u.username})` })),
              ]}
            />
            <Button variant="secondary" onClick={resetFilters}>
              Limpiar filtros
            </Button>
          </div>
          {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
        </CardBody>
      </Card>

      {/* Summary Cards */}
      <div className={`grid grid-cols-2 ${showAssociateCommission ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-4`}>
        <StatCard
          icon={<DollarSign size={20} />}
          label="Vendido"
          value={formatCurrency(report.byAssociate.totals.totalSales)}
          color="blue"
        />
        <StatCard
          icon={<Award size={20} />}
          label="Premios"
          value={formatCurrency(report.byAssociate.totals.totalPrizes)}
          color="orange"
        />
        {showAssociateCommission && (
          <StatCard
            icon={<HandCoins size={20} />}
            label="Comisión asociado"
            value={formatCurrency(report.byAssociate.totals.totalAssociateCommissions ?? 0)}
            color="indigo"
          />
        )}
        <StatCard
          icon={<HandCoins size={20} />}
          label="Comisión"
          value={formatCurrency(report.byAssociate.totals.totalCommissions)}
          color="purple"
        />
        <StatCard
          icon={<TrendingUp size={20} />}
          label="Balance"
          value={formatCurrency(report.byAssociate.totals.balance)}
          color={report.byAssociate.totals.balance >= 0 ? 'green' : 'red'}
        />
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-slate-600 font-medium">Evento</th>
                <th className="text-center px-4 py-3 text-slate-600 font-medium">Tickets</th>
                <th className="text-right px-4 py-3 text-slate-600 font-medium">Venta</th>
                <th className="text-right px-4 py-3 text-slate-600 font-medium">Premios</th>
                <th className="text-right px-4 py-3 text-slate-600 font-medium">Balance</th>
                <th className="text-right px-4 py-3 text-slate-600 font-medium">Comision</th>
                {showAssociateCommission && (
                  <th className="text-right px-4 py-3 text-slate-600 font-medium">Comision asociado</th>
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={showAssociateCommission ? 7 : 6} className="px-4 py-8 text-center text-slate-500">
                    Cargando reporte...
                  </td>
                </tr>
              ) : report.byAssociate.rows.length === 0 ? (
                <tr>
                  <td colSpan={showAssociateCommission ? 7 : 6} className="px-4 py-8 text-center text-slate-500">
                    No hay registros para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                <>
                  <EventRow event="Totales" totals={report.byAssociate.totals} bold variant="grand-total" showAssociateCommission={showAssociateCommission} />
                  {report.byAssociate.rows
                    .filter((row) => isRowVisible(row, report.byAssociate.rows))
                    .map((associate) => (
                      <Fragment key={associate.associateId}>
                      <EventRow
                        event={associate.associateName}
                        totals={mapAssociateToTotals(associate)}
                        bold
                        variant="associate-total"
                        expandable
                        isExpanded={expandedUsers.has(associate.associateId)}
                        onToggleExpand={() => toggleUserExpand(associate.associateId)}
                        showAssociateCommission={showAssociateCommission}
                      />
                      {expandedUsers.has(associate.associateId) &&
                        associate.draws.map((draw) => (
                          <EventRow
                            key={`${associate.associateId}-${draw.drawId}`}
                            event={
                              draw.lastTicketCreatedAt
                                ? `${draw.drawName} · ${formatDateTime(draw.lastTicketCreatedAt)}`
                                : draw.drawName
                            }
                            totals={mapDrawToTotals(draw)}
                            indented
                            variant="draw"
                            showAssociateCommission={showAssociateCommission}
                          />
                        ))}
                    </Fragment>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
