import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, CircleDollarSign, Printer, RefreshCcw, Trash2 } from 'lucide-react';
import { printBridgeApi } from '@/services/printBridge';
import { formatMovementTicketText } from '@/utils/cashMovementPrint';
import {
  cashMovementsApi,
  CashMovementBalanceResponse,
  CashMovementEventSummaryResponse,
  CashMovementHistoryItem,
  CashMovementType,
  CashMovementUserSummary,
} from '@/services/api';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Select, Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { DateRangeSegmentedControl } from '@/components/ui/DateRangeSegmentedControl';
import { useAuth } from '@/context/AuthContext';
import { formatCurrency, formatDateTime } from '@/utils/helpers';
import { DateRange, getDateRange, isDateRange, toISODateLocal } from '@/utils/dateRanges';

const CASH_MOVEMENTS_RANGE_KEY = 'go_cashmovements_selected_range';
const CASH_MOVEMENTS_CUSTOM_FROM_KEY = 'go_cashmovements_custom_from_date';
const CASH_MOVEMENTS_CUSTOM_TO_KEY = 'go_cashmovements_custom_to_date';

type CashMovementsTab = 'history' | 'by-event';

const EMPTY_BALANCE: CashMovementBalanceResponse = {
  targetUser: {
    id: '',
    fullName: '',
    username: '',
    role: 'vendedor',
    status: 'activo',
  },
  totals: {
    openingBalance: 0,
    totalDeposits: 0,
    totalWithdrawals: 0,
    totalSales: 0,
    totalPrizes: 0,
    ticketCount: 0,
    balance: 0,
  },
  filters: {
    fromDate: null,
    toDate: null,
  },
};

const EMPTY_EVENT_SUMMARY: CashMovementEventSummaryResponse = {
  targetUser: {
    id: '',
    fullName: '',
    username: '',
    role: 'vendedor',
    status: 'activo',
  },
  totals: {
    openingBalance: 0,
    ticketCount: 0,
    totalSales: 0,
    totalPrizes: 0,
    totalCommissions: 0,
    balance: 0,
  },
  filters: {
    fromDate: null,
    toDate: null,
  },
  rows: [],
};

export default function CashMovementsPage() {
  const { user, hasPermission } = useAuth();
  const [targets, setTargets] = useState<CashMovementUserSummary[]>([]);
  const [activeTab, setActiveTab] = useState<CashMovementsTab>('history');
  const [selectedTargetId, setSelectedTargetId] = useState('');
  const [customFromDate, setCustomFromDate] = useState<string>(() => {
    const saved = localStorage.getItem(CASH_MOVEMENTS_CUSTOM_FROM_KEY);
    return saved || toISODateLocal(new Date());
  });
  const [customToDate, setCustomToDate] = useState<string>(() => {
    const saved = localStorage.getItem(CASH_MOVEMENTS_CUSTOM_TO_KEY);
    return saved || toISODateLocal(new Date());
  });
  const [selectedRange, setSelectedRange] = useState<DateRange>(() => {
    const saved = localStorage.getItem(CASH_MOVEMENTS_RANGE_KEY);
    if (saved && isDateRange(saved)) {
      return saved;
    }
    return 'today';
  });
  const [movementType, setMovementType] = useState<CashMovementType>('deposito');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [rows, setRows] = useState<CashMovementHistoryItem[]>([]);
  const [balance, setBalance] = useState<CashMovementBalanceResponse>(EMPTY_BALANCE);
  const [eventSummary, setEventSummary] = useState<CashMovementEventSummaryResponse>(EMPTY_EVENT_SUMMARY);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellingMovementId, setCancellingMovementId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [canceling, setCanceling] = useState(false);

  const canCreate = hasPermission('/cash-movements:create');
  const canCancelPermission = hasPermission('/cash-movements:cancel');

  const getApiErrorMessage = (err: unknown, fallback: string) =>
    (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;

  const selectedTarget = useMemo(
    () => targets.find((t) => t.id === selectedTargetId) ?? null,
    [targets, selectedTargetId]
  );

  const canOperateTarget = Boolean(selectedTarget && selectedTarget.canOperate && selectedTarget.id !== user?.id);

  const getMovementBadgeVariant = (type: CashMovementHistoryItem['type']) => {
    if (type === 'deposito') return 'success';
    if (type === 'venta') return 'info';
    return 'danger';
  };

  const canCancelMovement = (movement: CashMovementHistoryItem): boolean => {
    if (!canCancelPermission) return false;
    if (movement.source !== 'cash-movement') return false;
    if (movement.canceledAt) return false;
    if (user?.role === 'admin') return true;
    if (user?.id === movement.createdById) return true;
    // Asociado can cancel movements created by subordinates (would be validated on backend too)
    if (user?.role === 'asociado') return true;
    return false;
  };

  const loadTargets = async () => {
    const data = await cashMovementsApi.targets();
    setTargets(data);
    if (data.length > 0) {
      setSelectedTargetId((prev) => prev || data[0].id);
    }
  };

  const loadData = async (targetUserId: string, fromDate: string, toDate: string) => {
    setLoading(true);
    setError(null);
    try {
      const [historyResult, balanceResult, eventSummaryResult] = await Promise.allSettled([
        cashMovementsApi.list({ targetUserId, fromDate, toDate, limit: 200 }),
        cashMovementsApi.balance({ targetUserId, fromDate, toDate }),
        cashMovementsApi.summaryByEvent({ targetUserId, fromDate, toDate }),
      ]);

      const historyError =
        historyResult.status === 'rejected' ? getApiErrorMessage(historyResult.reason, 'No se pudo cargar el historial.') : null;
      const balanceError =
        balanceResult.status === 'rejected' ? getApiErrorMessage(balanceResult.reason, 'No se pudo cargar el balance.') : null;
      const eventSummaryError =
        eventSummaryResult.status === 'rejected'
          ? getApiErrorMessage(eventSummaryResult.reason, 'No se pudo cargar el resumen por evento.')
          : null;

      setRows(historyResult.status === 'fulfilled' ? historyResult.value : []);
      setBalance(balanceResult.status === 'fulfilled' ? balanceResult.value : EMPTY_BALANCE);
      setEventSummary(eventSummaryResult.status === 'fulfilled' ? eventSummaryResult.value : EMPTY_EVENT_SUMMARY);
      setError(historyError ?? balanceError ?? eventSummaryError);
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo cargar el modulo de depositos y retiros.'));
      setRows([]);
      setBalance(EMPTY_BALANCE);
      setEventSummary(EMPTY_EVENT_SUMMARY);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTargets().catch(() => {
      setError('No se pudieron cargar los usuarios disponibles.');
    });
  }, []);

  useEffect(() => {
    localStorage.setItem(CASH_MOVEMENTS_RANGE_KEY, selectedRange);
  }, [selectedRange]);

  useEffect(() => {
    localStorage.setItem(CASH_MOVEMENTS_CUSTOM_FROM_KEY, customFromDate);
  }, [customFromDate]);

  useEffect(() => {
    localStorage.setItem(CASH_MOVEMENTS_CUSTOM_TO_KEY, customToDate);
  }, [customToDate]);

  useEffect(() => {
    if (!selectedTargetId) return;

    const isCustomRange = selectedRange === 'custom';
    if (isCustomRange && (!customFromDate || !customToDate || customFromDate > customToDate)) {
      return;
    }

    const { fromDate, toDate } = isCustomRange
      ? { fromDate: customFromDate, toDate: customToDate }
      : getDateRange(selectedRange);

    loadData(selectedTargetId, fromDate, toDate).catch(() => {
      setError('No se pudo cargar la informacion del usuario seleccionado.');
    });
  }, [selectedTargetId, selectedRange, customFromDate, customToDate]);

  const resetForm = () => {
    setMovementType('deposito');
    setAmount('');
    setNote('');
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedTargetId) {
      setError('Selecciona un usuario destino.');
      return;
    }

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('El monto debe ser mayor a cero.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      await cashMovementsApi.create({
        targetUserId: selectedTargetId,
        type: movementType,
        amount: parsedAmount,
        note: note.trim() || undefined,
      });
      setSuccess(`Movimiento de ${movementType} registrado correctamente.`);
      resetForm();
      const isCustomRange = selectedRange === 'custom';
      const { fromDate, toDate } = isCustomRange
        ? { fromDate: customFromDate, toDate: customToDate }
        : getDateRange(selectedRange);
      await loadData(selectedTargetId, fromDate, toDate);
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo registrar el movimiento.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelMovement = async () => {
    if (!cancellingMovementId) return;

    setCanceling(true);
    setError(null);
    setSuccess(null);

    try {
      await cashMovementsApi.cancel(cancellingMovementId, cancelReason.trim() || undefined);
      setSuccess('Movimiento cancelado correctamente.');
      setShowCancelModal(false);
      setCancellingMovementId(null);
      setCancelReason('');

      // Refresh the data
      if (selectedTargetId) {
        const isCustomRange = selectedRange === 'custom';
        const { fromDate, toDate } = isCustomRange
          ? { fromDate: customFromDate, toDate: customToDate }
          : getDateRange(selectedRange);
        await loadData(selectedTargetId, fromDate, toDate);
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo cancelar el movimiento.'));
    } finally {
      setCanceling(false);
    }
  };

  const handlePrintMovement = async (row: CashMovementHistoryItem) => {
    try {
      setError(null);
      setSuccess(null);
      const printText = formatMovementTicketText(row);
      await printBridgeApi.printText(printText);
      setSuccess('Comprobante enviado a imprimir correctamente.');
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'No se pudo conectar al print bridge.'));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Depositos y retiros</h1>
        <p className="text-sm text-slate-500">Gestion de efectivo por asociados y vendedores de la jerarquia.</p>
      </div>

      <DateRangeSegmentedControl
        selectedRange={selectedRange}
        onRangeChange={setSelectedRange}
        customFromDate={customFromDate}
        customToDate={customToDate}
        onCustomFromDateChange={setCustomFromDate}
        onCustomToDateChange={setCustomToDate}
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </div>
      )}

      <Card>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <Select
              label="Usuario destino"
              value={selectedTargetId}
              onChange={(event) => {
                setSelectedTargetId(event.target.value);
                setSuccess(null);
              }}
              options={targets.map((target) => ({
                value: target.id,
                label: `${target.fullName} (${target.username})`,
              }))}
            />
            <div className="text-sm text-slate-600 md:col-span-2">
              {selectedTarget ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="capitalize">{selectedTarget.role}</Badge>
                  {selectedTarget.status && (
                    <Badge variant={selectedTarget.status === 'activo' ? 'success' : 'warning'} className="capitalize">
                      {selectedTarget.status}
                    </Badge>
                  )}
                  <span>@{selectedTarget.username}</span>
                </div>
              ) : (
                <span>Selecciona un usuario para ver su balance e historial.</span>
              )}
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold text-slate-900">Balance operativo</h2>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                if (!selectedTargetId) return;
                const isCustomRange = selectedRange === 'custom';
                if (isCustomRange && (!customFromDate || !customToDate || customFromDate > customToDate)) {
                  return;
                }
                const { fromDate, toDate } = isCustomRange
                  ? { fromDate: customFromDate, toDate: customToDate }
                  : getDateRange(selectedRange);
                loadData(selectedTargetId, fromDate, toDate).catch(() => {
                  setError('No se pudo refrescar la informacion.');
                });
              }}
              disabled={!selectedTargetId || loading}
            >
              <RefreshCcw size={15} />
              Recargar
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 text-white">
            <div className={`rounded-xl border border-slate-800 border-t-4 p-4 shadow-sm bg-slate-900 ${balance.totals.openingBalance >= 0 ? 'border-t-emerald-500' : 'border-t-red-500'}`}>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Saldo anterior</p>
              <p className="mt-2 text-lg font-bold text-white">{formatCurrency(balance.totals.openingBalance)}</p>
            </div>
            <div className="rounded-xl border border-slate-800 border-t-4 border-t-emerald-500 bg-slate-900 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Depositos</p>
              <p className="mt-2 text-lg font-bold text-white">{formatCurrency(balance.totals.totalDeposits)}</p>
            </div>
            <div className="rounded-xl border border-slate-800 border-t-4 border-t-red-500 bg-slate-900 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Retiros</p>
              <p className="mt-2 text-lg font-bold text-white">{formatCurrency(balance.totals.totalWithdrawals)}</p>
            </div>
            <div className="rounded-xl border border-slate-800 border-t-4 border-t-blue-500 bg-slate-900 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Ventas</p>
              <p className="mt-2 text-lg font-bold text-white">{formatCurrency(balance.totals.totalSales)}</p>
            </div>
            <div className="rounded-xl border border-slate-800 border-t-4 border-t-orange-500 bg-slate-900 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Premios</p>
              <p className="mt-2 text-lg font-bold text-white">{formatCurrency(balance.totals.totalPrizes)}</p>
            </div>
            <div className={`rounded-xl border border-slate-800 border-t-4 p-4 shadow-sm bg-slate-900 ${balance.totals.balance >= 0 ? 'border-t-emerald-500' : 'border-t-red-500'}`}>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Balance final</p>
              <p className="mt-2 text-lg font-bold text-white">{formatCurrency(balance.totals.balance)}</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Formula: Saldo + Depositos - Retiros + Ventas - Premios
          </p>
        </CardBody>
      </Card>

      {canCreate && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-slate-900">Registrar movimiento</h2>
          </CardHeader>
          <CardBody>
            <form className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end" onSubmit={handleSubmit}>
              <Select
                label="Tipo"
                value={movementType}
                onChange={(event) => setMovementType(event.target.value as CashMovementType)}
                options={[
                  { value: 'deposito', label: 'Deposito' },
                  { value: 'retiro', label: 'Retiro' },
                ]}
              />
              <Input
                label="Monto"
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0.00"
              />
              <Input
                label="Nota"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Opcional"
                maxLength={300}
              />
              <Button type="submit" variant={movementType === 'deposito' ? 'success' : 'danger'} loading={submitting} disabled={!canOperateTarget}>
                {movementType === 'deposito' ? <ArrowDownCircle size={16} /> : <ArrowUpCircle size={16} />}
                Registrar {movementType}
              </Button>
            </form>
            {!canOperateTarget && selectedTarget && (
              <p className="mt-3 text-xs text-amber-700">
                No puedes registrar movimientos sobre este usuario. Solo admin/asociados pueden operar y nunca sobre si mismos.
              </p>
            )}
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2">
              <CircleDollarSign size={18} className="text-slate-700" />
              <div>
                <h2 className="font-semibold text-slate-900">
                  {activeTab === 'history' ? 'MOVIMIENTOS' : 'POR EVENTO'}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  {activeTab === 'history'
                    ? 'Movimientos manuales y ventas registradas para el usuario seleccionado.'
                    : 'Ventas, premios, comisiones y saldo acumulado por evento.'}
                </p>
              </div>
            </div>

            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1" role="tablist" aria-label="Vistas de movimientos">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'history'}
                onClick={() => setActiveTab('history')}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'history'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
                  }`}
              >
                MOVIMIENTOS
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'by-event'}
                onClick={() => setActiveTab('by-event')}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'by-event'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
                  }`}
              >
                POR EVENTO
              </button>
            </div>
          </div>
        </CardHeader>

        {activeTab === 'history' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-slate-600 font-medium">TIPO</th>
                  <th className="text-left px-4 py-3 text-slate-600 font-medium">DESCRIPCIÓN</th>
                  <th className="text-left px-4 py-3 text-slate-600 font-medium">FECHA</th>
                  <th className="text-right px-4 py-3 text-slate-600 font-medium">MONTO</th>
                  <th className="text-right px-4 py-3 text-slate-600 font-medium">SALDO POST-TRANSACCION</th>
                  <th className="text-left px-4 py-3 text-slate-600 font-medium">REGISTRADO POR</th>
                  <th className="text-left px-4 py-3 text-slate-600 font-medium">ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                      {loading ? 'Cargando movimientos...' : 'No hay movimientos para este usuario.'}
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <Badge variant={getMovementBadgeVariant(row.type)} className="uppercase">
                          {row.type.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{row.note || '-'}</td>
                      <td className="px-4 py-3 text-slate-700">{formatDateTime(row.createdAt)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">
                        {(row.type === 'retiro' || row.amount < 0 ? '-' : '') + formatCurrency(Math.abs(row.amount))}
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold ${(row.balanceAfterTransaction ?? 0) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                        {row.balanceAfterTransaction !== undefined ? formatCurrency(row.balanceAfterTransaction) : '-'}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{row.createdBy.fullName}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {row.source === 'cash-movement' && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handlePrintMovement(row)}
                            >
                              <Printer size={14} />
                              Imprimir
                            </Button>
                          )}
                          {canCancelMovement(row) ? (
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => {
                                setCancellingMovementId(row.id);
                                setCancelReason('');
                                setShowCancelModal(true);
                              }}
                              disabled={canceling}
                            >
                              <Trash2 size={14} />
                              Cancelar
                            </Button>
                          ) : row.source === 'ticket-sale' ? (
                            <Badge variant="info" className="text-xs">Venta</Badge>
                          ) : row.canceledAt ? (
                            <Badge variant="warning" className="text-xs">Cancelado</Badge>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-white">
              <div className="rounded-xl border border-slate-800 border-t-4 border-t-blue-500 bg-slate-900 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Ventas</p>
                <p className="mt-2 text-lg font-bold text-white">{formatCurrency(eventSummary.totals.totalSales)}</p>
              </div>
              <div className="rounded-xl border border-slate-800 border-t-4 border-t-orange-500 bg-slate-900 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Premios</p>
                <p className="mt-2 text-lg font-bold text-white">{formatCurrency(eventSummary.totals.totalPrizes)}</p>
              </div>
              <div className="rounded-xl border border-slate-800 border-t-4 border-t-violet-500 bg-slate-900 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Comision</p>
                <p className="mt-2 text-lg font-bold text-white">{formatCurrency(eventSummary.totals.totalCommissions)}</p>
              </div>
              <div className={`rounded-xl border border-slate-800 border-t-4 p-4 shadow-sm bg-slate-900 ${eventSummary.totals.balance >= 0 ? 'border-t-emerald-500' : 'border-t-red-500'}`}>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Balance</p>
                <p className="mt-2 text-lg font-bold text-white">{formatCurrency(eventSummary.totals.balance)}</p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-slate-600 font-medium">Evento</th>
                    <th className="text-left px-4 py-3 text-slate-600 font-medium">Fecha</th>
                    <th className="text-right px-4 py-3 text-slate-600 font-medium">Vendido</th>
                    <th className="text-right px-4 py-3 text-slate-600 font-medium">Premios</th>
                    <th className="text-right px-4 py-3 text-slate-600 font-medium">Comision</th>
                    <th className="text-right px-4 py-3 text-slate-600 font-medium">Balance</th>
                    <th className="text-right px-4 py-3 text-slate-600 font-medium">Saldo post transaccion</th>
                  </tr>
                </thead>
                <tbody>
                  {eventSummary.rows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                        {loading ? 'Cargando resumen...' : 'No hay eventos para este usuario.'}
                      </td>
                    </tr>
                  ) : (
                    eventSummary.rows.map((row) => (
                      <tr key={row.eventId} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-3 font-semibold text-slate-900">{row.eventName}</td>
                        <td className="px-4 py-3 text-slate-700">{formatDateTime(row.eventDate)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatCurrency(row.totalSales)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatCurrency(row.totalPrizes)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatCurrency(row.totalCommissions)}</td>
                        <td className={`px-4 py-3 text-right font-semibold ${row.balance >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{formatCurrency(row.balance)}</td>
                        <td className={`px-4 py-3 text-right font-semibold ${row.balanceAfterTransaction >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{formatCurrency(row.balanceAfterTransaction)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>

      <Modal
        open={showCancelModal}
        onClose={() => {
          setShowCancelModal(false);
          setCancellingMovementId(null);
          setCancelReason('');
        }}
        title="Cancelar movimiento"
        size="md"
      >
        <div className="space-y-4 px-6 py-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            ¿Estás seguro de que deseas cancelar este movimiento? Esta acción se registrará en el historial de auditoría.
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Razón de cancelación (opcional)</label>
            <Input
              type="text"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Ej: Error de registro, duplicado, etc."
              maxLength={300}
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setShowCancelModal(false);
                setCancellingMovementId(null);
                setCancelReason('');
              }}
              disabled={canceling}
            >
              Cerrar
            </Button>
            <Button
              variant="danger"
              onClick={handleCancelMovement}
              loading={canceling}
            >
              <Trash2 size={16} />
              Cancelar movimiento
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
