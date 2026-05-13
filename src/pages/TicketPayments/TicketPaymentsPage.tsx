import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, RotateCcw, ScanLine } from 'lucide-react';
import { drawsApi, paymentsApi, ticketsApi } from '@/services/api';
import { Draw, PaymentWinningTicket, Ticket } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Input';
import { formatCurrency, formatDateTime, formatDrawLabel } from '@/utils/helpers';
import { Modal } from '@/components/ui/Modal';

interface PaymentsTotals {
  totalToPay: number;
  totalPaid: number;
  totalPending: number;
  winnersCount: number;
  paidCount: number;
  pendingCount: number;
}

const EMPTY_TOTALS: PaymentsTotals = {
  totalToPay: 0,
  totalPaid: 0,
  totalPending: 0,
  winnersCount: 0,
  paidCount: 0,
  pendingCount: 0,
};

export default function TicketPaymentsPage() {
  const [draws, setDraws] = useState<Draw[]>([]);
  const [selectedDrawId, setSelectedDrawId] = useState('');
  const [status, setStatus] = useState<'all' | 'pendiente' | 'pagado'>('all');
  const [searchCode, setSearchCode] = useState('');
  const [quickPayCode, setQuickPayCode] = useState('');

  const [loading, setLoading] = useState(false);
  const [processingCode, setProcessingCode] = useState<string | null>(null);
  const [scanLookupLoading, setScanLookupLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [hasWinnerNumber, setHasWinnerNumber] = useState(false);
  const [winnerNumber, setWinnerNumber] = useState<string | null>(null);
  const [tickets, setTickets] = useState<PaymentWinningTicket[]>([]);
  const [paidTickets, setPaidTickets] = useState<PaymentWinningTicket[]>([]);
  const [totals, setTotals] = useState<PaymentsTotals>(EMPTY_TOTALS);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [selectedTicketWinner, setSelectedTicketWinner] = useState<string | null>(null);
  const [selectedTicketPrizeAmount, setSelectedTicketPrizeAmount] = useState<number | null>(null);
  const [selectedTicketPaymentStatus, setSelectedTicketPaymentStatus] = useState<'pendiente' | 'pagado' | null>(null);

  useEffect(() => {
    drawsApi
      .list()
      .then((items) => {
        setDraws(items);
      })
      .catch(() => {
        setError('No se pudo cargar la lista de sorteos.');
      });
  }, []);

  const drawOptions = useMemo(
    () => [
      { value: '', label: 'Seleccione un sorteo' },
      ...draws.map((draw) => ({ value: draw.id, label: formatDrawLabel(draw) })),
    ],
    [draws]
  );

  const loadData = async (overrideCode?: string) => {
    if (!selectedDrawId) {
      setTickets([]);
      setPaidTickets([]);
      setTotals(EMPTY_TOTALS);
      setHasWinnerNumber(false);
      setWinnerNumber(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await paymentsApi.listWinningTickets({
        drawId: selectedDrawId,
        status,
        code: (overrideCode ?? searchCode).trim() || undefined,
      });

      setTickets(data.tickets);
      setPaidTickets(data.paidTickets);
      setTotals(data.totals);
      setHasWinnerNumber(data.draw.hasWinnerNumber);
      setWinnerNumber(data.draw.winnerNumber ?? null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No fue posible cargar los pagos.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedDrawId, status]);

  const handleSearchSubmit = (event: FormEvent) => {
    event.preventDefault();
    loadData();
  };

  const normalizeTicketCodeInput = (value: string) => {
    const upper = value.toUpperCase().trim();
    const compact = upper.replace(/[^A-Z0-9]/g, '');

    if (compact.length >= 10) {
      const candidate = compact.slice(0, 10);
      return `${candidate.slice(0, 5)}-${candidate.slice(5, 10)}`;
    }

    return upper;
  };

  const getApiErrorMessage = (err: unknown, fallback: string) => {
    const maybe = err as { response?: { data?: { message?: string } }; message?: string };
    return maybe?.response?.data?.message ?? maybe?.message ?? fallback;
  };

  const closeDetailModal = () => {
    setSelectedTicket(null);
    setSelectedTicketWinner(null);
    setSelectedTicketPrizeAmount(null);
    setSelectedTicketPaymentStatus(null);
  };

  const handleMarkPaidByCode = async () => {
    const code = normalizeTicketCodeInput(quickPayCode);
    if (!code) return;

    if (!selectedDrawId) {
      setError('Seleccione un sorteo antes de escanear un ticket.');
      return;
    }

    setScanLookupLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const data = await paymentsApi.listWinningTickets({
        drawId: selectedDrawId,
        status: 'all',
        code,
      });

      const normalizedCode = normalizeTicketCodeInput(code);
      const ticketMatch =
        data.tickets.find((item) => normalizeTicketCodeInput(item.code) === normalizedCode) ??
        data.paidTickets.find((item) => normalizeTicketCodeInput(item.code) === normalizedCode);

      if (!ticketMatch) {
        setError(`No se encontro el ticket ${code} como ganador en este sorteo.`);
        return;
      }

      const ticketDetail = await ticketsApi.get(ticketMatch.ticketId);
      setSelectedTicket(ticketDetail);
      setSelectedTicketWinner(data.draw.winnerNumber ?? ticketDetail.draw?.winnerNumber ?? null);
      setSelectedTicketPrizeAmount(ticketMatch.prizeAmount);
      setSelectedTicketPaymentStatus(ticketMatch.paymentStatus);
      setQuickPayCode('');
    } catch (err) {
      const message = getApiErrorMessage(err, 'No se pudo buscar el ticket.');
      setError(message);
    } finally {
      setScanLookupLoading(false);
    }
  };

  const handleMarkPaid = async (ticketId: string) => {
    setProcessingCode(ticketId);
    setError(null);
    setSuccessMessage(null);
    try {
      await paymentsApi.markPaid({ ticketId });
      await loadData();
    } catch (err) {
      const message = getApiErrorMessage(err, 'No se pudo registrar el pago.');
      setError(message);
    } finally {
      setProcessingCode(null);
    }
  };

  const handleRevert = async (ticketId: string) => {
    setProcessingCode(ticketId);
    setError(null);
    setSuccessMessage(null);
    try {
      await paymentsApi.revertPayment(ticketId);
      await loadData();
    } catch (err) {
      const message = getApiErrorMessage(err, 'No se pudo revertir el pago.');
      setError(message);
    } finally {
      setProcessingCode(null);
    }
  };

  const normalizeNumber = (value: string) => value.trim().replace(/^0+(?=\d)/, '');

  const handleViewDetail = async (ticket: PaymentWinningTicket) => {
    setError(null);
    try {
      const detail = await ticketsApi.get(ticket.ticketId);
      setSelectedTicket(detail);
      setSelectedTicketWinner(detail.draw?.winnerNumber ?? null);
      setSelectedTicketPrizeAmount(ticket.prizeAmount);
      setSelectedTicketPaymentStatus(ticket.paymentStatus);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo cargar el detalle del ticket.';
      setError(message);
    }
  };

  const handlePayFromDetail = async () => {
    if (!selectedTicket) return;

    setProcessingCode(selectedTicket.id);
    setError(null);
    setSuccessMessage(null);
    try {
      const result = await paymentsApi.markPaid({ ticketId: selectedTicket.id });
      setSelectedTicketPaymentStatus('pagado');
      setSelectedTicketPrizeAmount(result.prizeAmount);
      setSuccessMessage(`Ticket ${result.ticket.code} pagado correctamente por ${formatCurrency(result.prizeAmount)}.`);
      await loadData();
    } catch (err) {
      const message = getApiErrorMessage(err, 'No se pudo registrar el pago.');
      setError(message);
    } finally {
      setProcessingCode(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Pago de tickets</h1>
        <p className="text-sm text-slate-500">Gestiona pagos de tickets ganadores por sorteo.</p>
      </div>

      <Card>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <Select
              label="Sorteo"
              value={selectedDrawId}
              onChange={(event) => setSelectedDrawId(event.target.value)}
              options={drawOptions}
            />
            <Select
              label="Estado"
              value={status}
              onChange={(event) => setStatus(event.target.value as 'all' | 'pendiente' | 'pagado')}
              options={[
                { value: 'all', label: 'Todos' },
                { value: 'pendiente', label: 'Pendientes' },
                { value: 'pagado', label: 'Pagados' },
              ]}
            />
            <form className="md:col-span-2 grid grid-cols-1 md:grid-cols-4 gap-2" onSubmit={handleSearchSubmit}>
              <div className="md:col-span-3">
                <Input
                  label="Buscar ticket"
                  placeholder="Código de ticket"
                  value={searchCode}
                  onChange={(event) => setSearchCode(event.target.value)}
                />
              </div>
              <div className="pt-0 md:pt-6">
                <Button type="submit" variant="secondary" className="w-full">
                  Filtrar
                </Button>
              </div>
            </form>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
            <div className="md:col-span-4">
              <Input
                label="Digitar/escanear ticket"
                placeholder="XXXXXX-XXXX"
                value={quickPayCode}
                onChange={(event) => setQuickPayCode(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleMarkPaidByCode();
                  }
                }}
              />
            </div>
            <Button
              variant="success"
              onClick={handleMarkPaidByCode}
              disabled={!quickPayCode.trim()}
              loading={scanLookupLoading}
            >
              <ScanLine size={16} />
              Buscar ticket
            </Button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge variant={hasWinnerNumber ? 'success' : 'warning'}>
              {hasWinnerNumber ? `Número ganador: ${winnerNumber}` : 'Sorteo sin número ganador'}
            </Badge>
            {selectedDrawId && hasWinnerNumber && (
              <Badge variant="info">Listo para pagos</Badge>
            )}
          </div>

          {error && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {successMessage && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              <CheckCircle2 size={16} />
              {successMessage}
            </div>
          )}

          {scanLookupLoading && (
            <div className="mt-3 flex items-center gap-2 text-sm text-slate-600">
              <Loader2 size={15} className="animate-spin" />
              Buscando ticket escaneado...
            </div>
          )}
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardBody>
            <p className="text-sm text-slate-500">Total a pagar</p>
            <p className="text-2xl font-bold text-slate-900">{formatCurrency(totals.totalToPay)}</p>
            <p className="text-xs text-slate-500 mt-1">{totals.winnersCount} tickets ganadores</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm text-slate-500">Pagados</p>
            <p className="text-2xl font-bold text-green-700">{formatCurrency(totals.totalPaid)}</p>
            <p className="text-xs text-slate-500 mt-1">{totals.paidCount} tickets pagados</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm text-slate-500">Pendientes</p>
            <p className="text-2xl font-bold text-amber-700">{formatCurrency(totals.totalPending)}</p>
            <p className="text-xs text-slate-500 mt-1">{totals.pendingCount} tickets pendientes</p>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-slate-800">Tickets ganadores</h2>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left">Ticket</th>
                <th className="px-4 py-3 text-left">Cliente</th>
                <th className="px-4 py-3 text-left">Número ganador</th>
                <th className="px-4 py-3 text-left">Vendedor</th>
                <th className="px-4 py-3 text-right">Monto a pagar</th>
                <th className="px-4 py-3 text-center">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 size={16} className="animate-spin" />
                      Cargando tickets...
                    </span>
                  </td>
                </tr>
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    No hay tickets ganadores para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                tickets.map((ticket) => (
                  <tr key={ticket.ticketId} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs">{ticket.code}</td>
                    <td className="px-4 py-3">{ticket.customerName || 'Sin nombre'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {ticket.winningNumbers.length > 0 ? (
                          ticket.winningNumbers.map((number, idx) => (
                            <span
                              key={`${ticket.ticketId}-${number}-${idx}`}
                              className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800"
                            >
                              {number}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-400">Sin coincidencia</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">{ticket.seller.fullName}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatCurrency(ticket.prizeAmount)}</td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={ticket.paymentStatus === 'pagado' ? 'success' : 'warning'}>
                        {ticket.paymentStatus}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleViewDetail(ticket)}
                        >
                          Ver detalle
                        </Button>
                        {ticket.paymentStatus !== 'pagado' ? (
                          <Button
                            size="sm"
                            variant="success"
                            onClick={() => handleMarkPaid(ticket.ticketId)}
                            loading={processingCode === ticket.ticketId}
                          >
                            <CheckCircle2 size={14} />
                            Pagar
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleRevert(ticket.ticketId)}
                            loading={processingCode === ticket.ticketId}
                          >
                            <RotateCcw size={14} />
                            Revertir
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

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-slate-800">Tickets ya pagados del sorteo</h2>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left">Ticket</th>
                <th className="px-4 py-3 text-left">Cliente</th>
                <th className="px-4 py-3 text-left">Número ganador</th>
                <th className="px-4 py-3 text-right">Monto pagado</th>
                <th className="px-4 py-3 text-left">Pagado por</th>
                <th className="px-4 py-3 text-left">Fecha pago</th>
              </tr>
            </thead>
            <tbody>
              {paidTickets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No hay tickets pagados para este sorteo.
                  </td>
                </tr>
              ) : (
                paidTickets.map((ticket) => (
                  <tr key={`paid-${ticket.ticketId}`} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-mono text-xs">{ticket.code}</td>
                    <td className="px-4 py-3">{ticket.customerName || 'Sin nombre'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {ticket.winningNumbers.map((number, idx) => (
                          <span
                            key={`paid-${ticket.ticketId}-${number}-${idx}`}
                            className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800"
                          >
                            {number}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-green-700">
                      {formatCurrency(ticket.prizeAmount)}
                    </td>
                    <td className="px-4 py-3">{ticket.paidBy?.fullName ?? 'N/A'}</td>
                    <td className="px-4 py-3">{ticket.paidAt ? formatDateTime(ticket.paidAt) : 'N/A'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={!!selectedTicket}
        onClose={closeDetailModal}
        title={selectedTicket ? `Ticket ${selectedTicket.code}` : 'Detalle de ticket'}
        size="lg"
      >
        {selectedTicket && (
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500">Sorteo</p>
                <p className="font-medium">
                  {selectedTicket.draw ? formatDrawLabel(selectedTicket.draw) : selectedTicket.drawId}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Fecha</p>
                <p className="font-medium">{formatDateTime(selectedTicket.createdAt)}</p>
              </div>
              <div>
                <p className="text-slate-500">Cliente</p>
                <p className="font-medium">{selectedTicket.customerName || 'Sin nombre'}</p>
              </div>
              <div>
                <p className="text-slate-500">Vendedor</p>
                <p className="font-medium">{selectedTicket.seller?.fullName ?? selectedTicket.sellerId}</p>
              </div>
            </div>

            {selectedTicketWinner && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                Numero ganador del sorteo: <span className="font-semibold">{selectedTicketWinner}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Monto a pagar</p>
                <p className="text-xl font-bold text-emerald-700">{formatCurrency(selectedTicketPrizeAmount ?? 0)}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Estado de pago</p>
                <div className="mt-1">
                  <Badge variant={selectedTicketPaymentStatus === 'pagado' ? 'success' : 'warning'}>
                    {selectedTicketPaymentStatus ?? 'pendiente'}
                  </Badge>
                </div>
              </div>
            </div>

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
                  {selectedTicket.lines.map((line, idx) => {
                    const isWinner =
                      !!selectedTicketWinner &&
                      normalizeNumber(line.number) === normalizeNumber(selectedTicketWinner);

                    return (
                      <tr
                        key={`${line.number}-${idx}`}
                        className={`border-t ${isWinner ? 'bg-green-50 border-green-100' : 'border-slate-100'}`}
                      >
                        <td className={`px-4 py-2 font-mono ${isWinner ? 'text-green-700 font-semibold' : ''}`}>
                          {line.number}
                        </td>
                        <td className="px-4 py-2 text-right">{formatCurrency(line.amount)}</td>
                        <td className="px-4 py-2 text-right">{formatCurrency(line.specialAmount ?? 0)}</td>
                        <td className={`px-4 py-2 text-right ${isWinner ? 'text-green-700 font-semibold' : ''}`}>
                          {formatCurrency(line.amount + (line.specialAmount ?? 0))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 pt-3">
              <p className="font-semibold text-slate-700">Total ticket</p>
              <p className="font-bold text-lg text-slate-900">{formatCurrency(selectedTicket.total)}</p>
            </div>

            <div className="flex justify-end gap-2">
              {selectedTicketPaymentStatus !== 'pagado' && (
                <Button
                  variant="success"
                  onClick={handlePayFromDetail}
                  loading={processingCode === selectedTicket.id}
                >
                  <CheckCircle2 size={14} />
                  Pagar ticket
                </Button>
              )}
              <Button variant="secondary" onClick={closeDetailModal}>
                Cerrar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
