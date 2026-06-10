import { useEffect, useMemo, useState } from 'react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { DateRangeSegmentedControl } from '@/components/ui/DateRangeSegmentedControl';
import { FilteredTicketsCard } from '@/components/tickets/FilteredTicketsCard';
import {
  drawsApi,
  reportsApi,
  usersApi,
  SalesByUserResponse,
  SalesByUserRow,
} from '@/services/api';
import { Draw, Ticket, User } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { formatCurrency, formatDrawLabel } from '@/utils/helpers';
import { DateRange, getDateRange, isDateRange, toISODateLocal } from '@/utils/dateRanges';
import { useTicketActions } from '@/hooks/useTicketActions';
import { printSaleTicket } from '@/utils/ticketPrint';

const SALES_USER_RANGE_KEY = 'go_salesuser_selected_range';
const SALES_USER_CUSTOM_FROM_KEY = 'go_salesuser_custom_from_date';
const SALES_USER_CUSTOM_TO_KEY = 'go_salesuser_custom_to_date';

const EMPTY_REPORT: SalesByUserResponse = {
  filters: {
    drawId: null,
    userId: null,
    fromDate: null,
    toDate: null,
  },
  totals: {
    ticketCount: 0,
    activeTicketCount: 0,
    canceledTicketCount: 0,
    totalSales: 0,
  },
  rows: [],
  tickets: [],
};

export default function SalesByUserPage() {
  const { hasPermission } = useAuth();
  const [draws, setDraws] = useState<Draw[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const canCancelTickets = hasPermission('/sales:cancel');

  const [selectedDrawId, setSelectedDrawId] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [customFromDate, setCustomFromDate] = useState<string>(() => {
    const saved = localStorage.getItem(SALES_USER_CUSTOM_FROM_KEY);
    return saved || toISODateLocal(new Date());
  });
  const [customToDate, setCustomToDate] = useState<string>(() => {
    const saved = localStorage.getItem(SALES_USER_CUSTOM_TO_KEY);
    return saved || toISODateLocal(new Date());
  });
  const [selectedRange, setSelectedRange] = useState<DateRange>(() => {
    const saved = localStorage.getItem(SALES_USER_RANGE_KEY);
    if (saved && isDateRange(saved)) {
      return saved;
    }
    return 'today';
  });

  const [report, setReport] = useState<SalesByUserResponse>(EMPTY_REPORT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    drawsApi.list().then(setDraws).catch(() => {});
    usersApi.list().then(setUsers).catch(() => {});
  }, []);

  useEffect(() => {
    localStorage.setItem(SALES_USER_RANGE_KEY, selectedRange);
  }, [selectedRange]);

  useEffect(() => {
    localStorage.setItem(SALES_USER_CUSTOM_FROM_KEY, customFromDate);
  }, [customFromDate]);

  useEffect(() => {
    localStorage.setItem(SALES_USER_CUSTOM_TO_KEY, customToDate);
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

    reportsApi.salesByUser({
      drawId: selectedDrawId || undefined,
      userId: selectedUserId || undefined,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
    })
      .then(setReport)
      .catch((err: unknown) => {
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
        setError(msg ?? 'No fue posible cargar el reporte de ventas por usuario.');
        setReport(EMPTY_REPORT);
      })
      .finally(() => setLoading(false));
  }, [selectedDrawId, selectedUserId, selectedRange, customFromDate, customToDate]);

  const userOptions = useMemo(
    () => [
      { value: '', label: 'Todos los usuarios' },
      ...users.map((u) => ({ value: u.id, label: `${u.fullName} (${u.username})` })),
    ],
    [users]
  );

  const usersById = useMemo(
    () => new Map(users.map((u) => [u.id, u])),
    [users],
  );

  const getSellerDisplayName = (ticket: Ticket) => {
    const seller = ticket.seller ?? usersById.get(ticket.sellerId);
    if (!seller) return 'Usuario no disponible';
    return seller.fullName ? `${seller.fullName} (${seller.username})` : seller.username;
  };

  const resetFilters = () => {
    setSelectedDrawId('');
    setSelectedUserId('');
    setSelectedRange('today');
  };

  const refreshReport = () => {
    const isCustomRange = selectedRange === 'custom';
    if (isCustomRange && (!customFromDate || !customToDate || customFromDate > customToDate)) {
      return;
    }

    const { fromDate, toDate } = isCustomRange
      ? { fromDate: customFromDate, toDate: customToDate }
      : getDateRange(selectedRange);

    reportsApi.salesByUser({
      drawId: selectedDrawId || undefined,
      userId: selectedUserId || undefined,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
    })
      .then(setReport)
      .catch(() => {});
  };

  const {
    actionError,
    selectedTicket,
    setSelectedTicket,
    handleViewTicket,
    handlePrintTicket,
    handlePrintTicketBridge,
    handleCancelTicket,
  } = useTicketActions({
    draws,
    users,
    onRefresh: refreshReport,
    printTicket: printSaleTicket,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Ventas por usuario</h1>
        <p className="text-sm text-slate-500">Filtra tickets y administra anulaciones con control jerarquico</p>
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
                ...draws.map((d) => ({ value: d.id, label: formatDrawLabel(d) })),
              ]}
            />
            <Select
              label="Usuario"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              options={userOptions}
            />
            <Button variant="secondary" onClick={resetFilters}>Limpiar filtros</Button>
          </div>
          {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
        </CardBody>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-sm text-slate-500 mb-1">Tickets</p>
          <p className="text-2xl font-bold text-slate-900">{report.totals.ticketCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-slate-500 mb-1">Activos</p>
          <p className="text-2xl font-bold text-emerald-700">{report.totals.activeTicketCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-slate-500 mb-1">Anulados</p>
          <p className="text-2xl font-bold text-red-700">{report.totals.canceledTicketCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-slate-500 mb-1">Ventas vigentes</p>
          <p className="text-2xl font-bold text-blue-700">{formatCurrency(report.totals.totalSales)}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-1">
          <Card>
            <CardHeader>
              <h2 className="font-semibold text-slate-800">Resumen por usuario</h2>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-slate-600 font-medium">Usuario</th>
                    <th className="px-4 py-3 text-center text-slate-600 font-medium">Activos</th>
                    <th className="px-4 py-3 text-right text-slate-600 font-medium">Ventas</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-slate-500">Cargando...</td>
                    </tr>
                  ) : report.rows.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-slate-500">Sin datos</td>
                    </tr>
                  ) : (
                    report.rows.map((row: SalesByUserRow) => (
                      <tr key={row.userId} className="border-t border-slate-100">
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900">{row.fullName}</p>
                          <p className="text-xs text-slate-500">{row.username} · {row.role}</p>
                        </td>
                        <td className="px-4 py-3 text-center">{row.activeTicketCount}</td>
                        <td className="px-4 py-3 text-right font-semibold text-green-700">{formatCurrency(row.totalSales)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="xl:col-span-2">
          <FilteredTicketsCard
            title="Historial de tickets"
            loading={loading}
            tickets={report.tickets}
            canCancelTickets={canCancelTickets}
            actionError={actionError}
            selectedTicket={selectedTicket}
            onCloseTicket={() => setSelectedTicket(null)}
            onViewTicket={handleViewTicket}
            onPrintTicket={handlePrintTicket}
            onPrintTicketBridge={handlePrintTicketBridge}
            onCancelTicket={handleCancelTicket}
            getSellerDisplayName={getSellerDisplayName}
          />
        </div>
      </div>
    </div>
  );
}
