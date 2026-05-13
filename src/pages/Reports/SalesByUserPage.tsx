import { useEffect, useMemo, useState } from 'react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { DateRangeSegmentedControl } from '@/components/ui/DateRangeSegmentedControl';
import {
  drawsApi,
  reportsApi,
  usersApi,
  ticketsApi,
  SalesByUserResponse,
  SalesByUserRow,
} from '@/services/api';
import { Draw, Ticket, User } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { formatCurrency, formatDateTime, formatDrawLabel } from '@/utils/helpers';
import { DateRange, getDateRange, isDateRange, toISODateLocal } from '@/utils/dateRanges';
import { mapSaleTicketToPrintBridge, printBridgeApi } from '@/services/printBridge';

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

function printTicket(ticket: Ticket): void {
  const hasSpecialAmounts = ticket.lines.some((line) => (line.specialAmount ?? 0) > 0);
  const regularTotal = ticket.lines.reduce((sum, line) => sum + line.amount, 0);
  const specialTotal = hasSpecialAmounts
    ? ticket.lines.reduce((sum, line) => sum + (line.specialAmount ?? 0), 0)
    : 0;
  const regularMultiplier = ticket.seller?.plan?.multiplier;
  const specialMultiplier = ticket.draw?.specialMultiplier?.value;

  const headerHtml = `
      <tr>
        <th style="text-align:left;">Numero</th>
        <th style="text-align:right;">Regular</th>
        <th style="text-align:right;">Especial</th>
        <th style="text-align:right;">Total</th>
      </tr>`;

  const linesHtml = ticket.lines
    .map(
      (line) => `
      <tr>
        <td>${line.number}</td>
        <td style="text-align:right;">C$ ${line.amount.toFixed(2)}</td>
        <td style="text-align:right;">C$ ${(line.specialAmount ?? 0).toFixed(2)}</td>
        <td style="text-align:right;">C$ ${(line.amount + (line.specialAmount ?? 0)).toFixed(2)}</td>
      </tr>`
    )
    .join('');

  const popup = window.open('', '_blank', 'width=420,height=760');
  if (!popup) return;

  popup.document.write(`
    <html>
      <head>
        <title>Ticket ${ticket.code}</title>
        <style>
          body { font-family: monospace; padding: 16px; }
          .box { border: 1px solid #ddd; border-radius: 8px; padding: 12px; }
          .title { text-align:center; font-weight:bold; font-size:18px; }
          .muted { color:#666; font-size:12px; }
          table { width:100%; border-collapse: collapse; margin-top: 8px; }
          td, th { font-size:12px; padding: 4px 0; border-bottom: 1px dashed #ddd; }
          .tot { font-weight: bold; margin-top: 8px; display:flex; justify-content:space-between; }
        </style>
      </head>
      <body>
        <div class="box">
          <div class="title">GameOver Loteria</div>
          <div class="title" style="font-size:16px; letter-spacing:2px; margin-top:6px;">${ticket.code}</div>
          <p class="muted">Sorteo: ${ticket.draw ? formatDrawLabel(ticket.draw) : ticket.drawId}</p>
          <p class="muted">Cliente: ${ticket.customerName}</p>
          <p class="muted">Vendedor: ${ticket.seller?.fullName ?? ticket.sellerId}</p>
          <p class="muted">Fecha: ${formatDateTime(ticket.createdAt)}</p>
          ${typeof regularMultiplier === 'number' ? `<p class="muted">Multiplicador regular: x${regularMultiplier}</p>` : ''}
          ${typeof specialMultiplier === 'number' ? `<p class="muted">Multiplicador especial: x${specialMultiplier}</p>` : ''}
          <table>
            <thead>${headerHtml}</thead>
            <tbody>${linesHtml}</tbody>
          </table>
          ${hasSpecialAmounts ? `
          <div class="tot" style="font-size:12px; font-weight:normal; color:#444; margin-top:6px;">
            <span>Subtotal regular</span>
            <span>C$ ${regularTotal.toFixed(2)}</span>
          </div>
          <div class="tot" style="font-size:12px; font-weight:normal; color:#444; margin-top:4px;">
            <span>Subtotal especial</span>
            <span>C$ ${specialTotal.toFixed(2)}</span>
          </div>` : ''}
          <div class="tot">
            <span>TOTAL</span>
            <span>C$ ${ticket.total.toFixed(2)}</span>
          </div>
        </div>
      </body>
    </html>
  `);

  popup.document.close();
  popup.focus();
  popup.print();
}

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
  const [actionError, setActionError] = useState('');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

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

  const handleView = async (ticketId: string) => {
    setActionError('');
    try {
      const ticket = await ticketsApi.get(ticketId);
      setSelectedTicket(ticket);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setActionError(msg ?? 'No fue posible cargar el ticket.');
    }
  };

  const handlePrint = async (ticketId: string) => {
    setActionError('');
    try {
      const ticket = await ticketsApi.get(ticketId);
      if (ticket.canceledAt) {
        setActionError('No se puede imprimir un ticket anulado.');
        return;
      }
      await ticketsApi.markPrinted(ticketId);
      printTicket(ticket);
      refreshReport();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setActionError(msg ?? 'No fue posible imprimir el ticket.');
    }
  };

  const handlePrintBridge = async (ticketId: string) => {
    setActionError('');
    try {
      const ticket = await ticketsApi.get(ticketId);
      if (ticket.canceledAt) {
        setActionError('No se puede imprimir un ticket anulado.');
        return;
      }
      const draw = draws.find((item) => item.id === ticket.drawId);
      const seller = users.find((item) => item.id === ticket.sellerId);
      const payload = mapSaleTicketToPrintBridge({
        ticket,
        draw,
        user: seller,
      });
      await printBridgeApi.printTicket(payload);
    } catch (err: unknown) {
      const msg =
        (err instanceof Error ? err.message : undefined) ??
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setActionError(msg ?? 'No fue posible imprimir el ticket por bridge.');
    }
  };

  const handleCancel = async (ticket: Ticket) => {
    setActionError('');
    if (ticket.canceledAt) return;

    const confirmed = window.confirm(`Deseas anular el ticket ${ticket.code}?`);
    if (!confirmed) return;

    const reason = window.prompt('Motivo de anulacion (opcional):') ?? undefined;

    try {
      await ticketsApi.cancel(ticket.id, reason?.trim() ? reason.trim() : undefined);
      if (selectedTicket?.id === ticket.id) {
        const updated = await ticketsApi.get(ticket.id);
        setSelectedTicket(updated);
      }
      refreshReport();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setActionError(msg ?? 'No fue posible anular el ticket.');
    }
  };

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
          {actionError && <p className="text-sm text-red-600 mt-2">{actionError}</p>}
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
          <Card>
            <CardHeader>
              <h2 className="font-semibold text-slate-800">Tickets filtrados</h2>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-slate-600 font-medium">Ticket</th>
                    <th className="px-4 py-3 text-left text-slate-600 font-medium">Usuario</th>
                    <th className="px-4 py-3 text-right text-slate-600 font-medium">Monto</th>
                    <th className="px-4 py-3 text-center text-slate-600 font-medium">Estado</th>
                    <th className="px-4 py-3 text-right text-slate-600 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500">Cargando...</td>
                    </tr>
                  ) : report.tickets.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500">No hay tickets</td>
                    </tr>
                  ) : (
                    report.tickets.map((ticket) => (
                      <tr key={ticket.id} className="border-t border-slate-100">
                        <td className="px-4 py-3">
                          <p className="font-mono text-xs text-slate-800">{ticket.code}</p>
                          <p className="text-xs text-slate-500">{formatDateTime(ticket.createdAt)}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-slate-900">{ticket.seller?.fullName ?? ticket.sellerId}</p>
                          <p className="text-xs text-slate-500">{ticket.customerName}</p>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">
                          {formatCurrency(ticket.total)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {ticket.canceledAt ? (
                            <Badge variant="danger">Anulado</Badge>
                          ) : (
                            <Badge variant="success">Activo</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <Button size="sm" variant="secondary" onClick={() => handleView(ticket.id)}>
                              Ver
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handlePrint(ticket.id)}
                              disabled={!!ticket.canceledAt}
                            >
                              Imprimir
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handlePrintBridge(ticket.id)}
                              disabled={!!ticket.canceledAt}
                            >
                              Nativo
                            </Button>
                            {canCancelTickets && (
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() => handleCancel(ticket)}
                                disabled={!!ticket.canceledAt}
                              >
                                Anular
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={!!selectedTicket}
        onClose={() => setSelectedTicket(null)}
        title={selectedTicket ? `Ticket ${selectedTicket.code}` : 'Ticket'}
        size="lg"
      >
        {selectedTicket && (
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500">Sorteo</p>
                <p className="font-medium">{selectedTicket.draw ? formatDrawLabel(selectedTicket.draw) : selectedTicket.drawId}</p>
              </div>
              <div>
                <p className="text-slate-500">Fecha</p>
                <p className="font-medium">{formatDateTime(selectedTicket.createdAt)}</p>
              </div>
              <div>
                <p className="text-slate-500">Cliente</p>
                <p className="font-medium">{selectedTicket.customerName}</p>
              </div>
              <div>
                <p className="text-slate-500">Vendedor</p>
                <p className="font-medium">{selectedTicket.seller?.fullName ?? selectedTicket.sellerId}</p>
              </div>
              <div>
                <p className="text-slate-500">Multiplicador regular</p>
                <p className="font-medium">
                  {typeof selectedTicket.seller?.plan?.multiplier === 'number'
                    ? `x${selectedTicket.seller.plan.multiplier}`
                    : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Multiplicador especial</p>
                <p className="font-medium">
                  {typeof selectedTicket.draw?.specialMultiplier?.value === 'number'
                    ? `x${selectedTicket.draw.specialMultiplier.value}`
                    : 'No aplica'}
                </p>
              </div>
            </div>

            {selectedTicket.canceledAt && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <p className="font-semibold">Ticket anulado</p>
                <p>Anulado el {formatDateTime(selectedTicket.canceledAt)}</p>
                {selectedTicket.cancelReason && <p>Motivo: {selectedTicket.cancelReason}</p>}
              </div>
            )}

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-slate-600 font-medium">Numero</th>
                    <th className="px-4 py-2 text-right text-slate-600 font-medium">Regular</th>
                    <th className="px-4 py-2 text-right text-slate-600 font-medium">Especial</th>
                    <th className="px-4 py-2 text-right text-slate-600 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedTicket.lines.map((line, idx) => (
                    <tr key={`${line.number}-${idx}`} className="border-t border-slate-100">
                      <td className="px-4 py-2 font-mono">{line.number}</td>
                      <td className="px-4 py-2 text-right">{formatCurrency(line.amount)}</td>
                      <td className="px-4 py-2 text-right text-purple-700">{formatCurrency(line.specialAmount ?? 0)}</td>
                      <td className="px-4 py-2 text-right">{formatCurrency(line.amount + (line.specialAmount ?? 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 pt-3">
              <div>
                <p className="font-semibold text-slate-700">Total</p>
                {selectedTicket.lines.some((line) => (line.specialAmount ?? 0) > 0) && (
                  <p className="text-xs text-slate-500">
                    Regular: {formatCurrency(selectedTicket.lines.reduce((sum, line) => sum + line.amount, 0))} | Especial:{' '}
                    {formatCurrency(selectedTicket.lines.reduce((sum, line) => sum + (line.specialAmount ?? 0), 0))}
                  </p>
                )}
              </div>
              <p className="font-bold text-lg text-slate-900">{formatCurrency(selectedTicket.total)}</p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setSelectedTicket(null)}>
                Cerrar
              </Button>
              <Button
                variant="ghost"
                onClick={() => handlePrint(selectedTicket.id)}
                disabled={!!selectedTicket.canceledAt}
              >
                Imprimir
              </Button>
              <Button
                variant="ghost"
                onClick={() => handlePrintBridge(selectedTicket.id)}
                disabled={!!selectedTicket.canceledAt}
              >
                Nativo
              </Button>
              {canCancelTickets && (
                <Button
                  variant="danger"
                  onClick={() => handleCancel(selectedTicket)}
                  disabled={!!selectedTicket.canceledAt}
                >
                  Anular
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
