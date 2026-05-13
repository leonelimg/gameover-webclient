import { Fragment, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
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
import { formatCurrency, formatDrawLabel } from '@/utils/helpers';
import { DateRange, getDateRange, isDateRange, toISODateLocal } from '@/utils/dateRanges';

const BALANCE_RANGE_KEY = 'go_balance_selected_range';
const BALANCE_CUSTOM_FROM_KEY = 'go_balance_custom_from_date';
const BALANCE_CUSTOM_TO_KEY = 'go_balance_custom_to_date';

const EMPTY_TOTALS: BalanceBreakdownTotals = {
  ticketCount: 0,
  totalSales: 0,
  totalPrizes: 0,
  totalCommissions: 0,
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
  bold = false,
  variant = 'draw',
  expandable = false,
  isExpanded = false,
  onToggleExpand,
}: {
  event: string;
  totals: BalanceBreakdownTotals;
  indented?: boolean;
  bold?: boolean;
  variant?: 'grand-total' | 'associate-total' | 'draw';
  expandable?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}) {
  const textClass = bold ? 'font-semibold' : 'font-medium';
  const rowClass =
    variant === 'grand-total'
      ? 'bg-emerald-50 border-emerald-200'
      : variant === 'associate-total'
        ? 'bg-blue-50 border-blue-100'
        : 'bg-white border-slate-100';

  const eventTextClass =
    variant === 'grand-total'
      ? 'text-emerald-900'
      : variant === 'associate-total'
        ? 'text-blue-900'
        : 'text-slate-800';

  return (
    <tr className={`border-t hover:bg-slate-50 ${rowClass} ${expandable && onToggleExpand ? 'cursor-pointer' : ''}`}>
      <td className={`px-4 py-3 ${eventTextClass} ${textClass} ${indented ? 'pl-10' : ''}`}>
        <div className="flex items-center gap-2">
          {expandable && onToggleExpand && (
            <button
              onClick={onToggleExpand}
              className="text-slate-400 hover:text-slate-700 flex-shrink-0"
            >
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          )}
          {expandable && !onToggleExpand && <span className="w-4 flex-shrink-0" />}
          <span>{event}</span>
        </div>
      </td>
      <td className={`px-4 py-3 text-center text-slate-900 ${textClass}`}>{totals.ticketCount}</td>
      <td className={`px-4 py-3 text-right text-green-700 ${textClass}`}>{formatCurrency(totals.totalSales)}</td>
      <td className={`px-4 py-3 text-right text-amber-700 ${textClass}`}>{formatCurrency(totals.totalPrizes)}</td>
      <td className={`px-4 py-3 text-right ${totals.balance >= 0 ? 'text-emerald-700' : 'text-red-700'} ${textClass}`}>
        {formatCurrency(totals.balance)}
      </td>
      <td className={`px-4 py-3 text-right text-blue-700 ${textClass}`}>{formatCurrency(totals.totalCommissions)}</td>
    </tr>
  );
}

function mapAssociateToTotals(row: AssociateBreakdownRow): BalanceBreakdownTotals {
  return {
    ticketCount: row.ticketCount,
    totalSales: row.totalSales,
    totalPrizes: row.totalPrizes,
    totalCommissions: row.totalCommissions,
    balance: row.balance,
  };
}

function mapDrawToTotals(row: AssociateDrawBreakdownRow): BalanceBreakdownTotals {
  return {
    ticketCount: row.ticketCount,
    totalSales: row.totalSales,
    totalPrizes: row.totalPrizes,
    totalCommissions: row.totalCommissions,
    balance: row.balance,
  };
}

export default function BalanceBreakdownPage() {
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

    reportsApi.balanceBreakdown({
      drawId: selectedDrawId || undefined,
      userId: selectedUserId || undefined,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
    })
      .then((data) => {
        setReport(data); // Keeping this line for updated report with expand logic
        // Expand all users by default
        const userIds = new Set(data.byAssociate.rows.map((row) => row.associateId));
        setExpandedUsers(userIds);
      })
      .catch((err: unknown) => {
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
        setError(msg ?? 'No fue posible cargar el reporte.');
        setReport(EMPTY_REPORT);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [selectedDrawId, selectedUserId, selectedRange, customFromDate, customToDate]);

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
                ...draws.map((d) => ({
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

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-slate-800">Formato de evento</h2>
        </CardHeader>
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
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    Cargando reporte...
                  </td>
                </tr>
              ) : report.byAssociate.rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No hay registros para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                <>
                  <EventRow event="Totales" totals={report.byAssociate.totals} bold variant="grand-total" />
                  {report.byAssociate.rows.map((associate) => (
                    <Fragment key={associate.associateId}>
                      <EventRow
                        event={associate.associateName}
                        totals={mapAssociateToTotals(associate)}
                        bold
                        variant="associate-total"
                        expandable
                        isExpanded={expandedUsers.has(associate.associateId)}
                        onToggleExpand={() => toggleUserExpand(associate.associateId)}
                      />
                      {expandedUsers.has(associate.associateId) &&
                        associate.draws.map((draw) => (
                          <EventRow
                            key={`${associate.associateId}-${draw.drawId}`}
                            event={formatDrawLabel({ name: draw.drawName, closeTime: draw.drawCloseTime })}
                            totals={mapDrawToTotals(draw)}
                            indented
                            variant="draw"
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
