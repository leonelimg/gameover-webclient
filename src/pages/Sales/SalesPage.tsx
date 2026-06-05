import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Printer, ShoppingCart, Award, CheckCircle, Clock, Loader, RotateCcw, XCircle, List } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { FilteredTicketsCard } from '@/components/tickets/FilteredTicketsCard';
import { generateId, formatCurrency, formatDateTime, formatDrawLabel, isDrawOpen } from '@/utils/helpers';
import { Draw, PrintJob, PrintJobStatus, Ticket, User } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { drawsApi, ticketsApi, reportsApi, numberRestrictionsApi, CreateTicketPayload, TopNumber, usersApi } from '@/services/api';
import { mapSaleTicketToPrintBridge, printBridgeApi } from '@/services/printBridge';
import { useTicketActions } from '@/hooks/useTicketActions';
import { printSaleTicket } from '@/utils/ticketPrint';

interface SaleLine {
  id: string;
  number: string;
  amount: string;
  specialAmount: string;
}

type SaleLineField = 'number' | 'amount' | 'specialAmount';

const NATIVE_PRINT_STATUS_LABEL: Record<PrintJobStatus, string> = {
  pending: 'Pendiente',
  processing: 'Procesando',
  retrying: 'Reintentando',
  completed: 'Completado',
  failed: 'Fallido',
};

const NATIVE_PRINT_STATUS_BADGE: Record<PrintJobStatus, 'secondary' | 'success' | 'warning' | 'danger' | 'info'> = {
  pending: 'secondary',
  processing: 'info',
  retrying: 'warning',
  completed: 'success',
  failed: 'danger',
};

function NativePrintStatusIcon({ status }: { status: PrintJobStatus }) {
  switch (status) {
    case 'completed':
      return <CheckCircle size={14} className="text-green-600" />;
    case 'failed':
      return <XCircle size={14} className="text-red-600" />;
    case 'processing':
      return <Loader size={14} className="animate-spin text-blue-600" />;
    case 'retrying':
      return <RotateCcw size={14} className="text-yellow-600" />;
    default:
      return <Clock size={14} className="text-slate-400" />;
  }
}

export default function SalesPage() {
  const { user, hasPermission } = useAuth();
  const canCreateSale = hasPermission('/sales:create');
  const canCancelTickets = hasPermission('/sales:cancel');

  const readSessionString = (key: string, fallback = '') => {
    const value = sessionStorage.getItem(key);
    return value ?? fallback;
  };

  const readSessionLines = (): SaleLine[] => {
    try {
      const raw = sessionStorage.getItem('go_sales_lines');
      if (!raw) {
        return [{ id: generateId(), number: '', amount: '', specialAmount: '' }];
      }
      const parsed = JSON.parse(raw) as Array<Partial<SaleLine> & { isNicaEspecial?: boolean }>;
      if (!Array.isArray(parsed) || parsed.length === 0) {
        return [{ id: generateId(), number: '', amount: '', specialAmount: '' }];
      }
      return parsed.map((line) => ({
        id: line.id ?? generateId(),
        number: line.number ?? '',
        amount: line.amount ?? '',
        specialAmount: line.specialAmount ?? '',
      }));
    } catch {
      return [{ id: generateId(), number: '', amount: '', specialAmount: '' }];
    }
  };

  const readSessionTicket = (): Ticket | null => {
    try {
      const raw = sessionStorage.getItem('go_last_ticket');
      if (!raw) {
        return null;
      }
      const ticket = JSON.parse(raw) as Ticket;
      if (!user || ticket.sellerId !== user.id) {
        return null;
      }
      return ticket;
    } catch {
      return null;
    }
  };

  const readSessionPrintMode = (): boolean => {
    return sessionStorage.getItem('go_sales_print_mode') === '1';
  };

  const [draws, setDraws] = useState<Draw[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [topNumbers, setTopNumbers] = useState<TopNumber[]>([]);
  const [drawTickets, setDrawTickets] = useState<Ticket[]>([]);
  const [globalNumberLimit, setGlobalNumberLimit] = useState<number | null>(null);

  const openDraws = useMemo(
    () => draws.filter((d) => d.status !== 'finalizado' && isDrawOpen(d.closeTime, d.minutosPreviosCierre)),
    [draws],
  );
  const drawOptions = useMemo(
    () => [
      { value: '', label: 'Selecciona un sorteo...' },
      ...openDraws.map((d) => ({ value: d.id, label: formatDrawLabel(d) })),
    ],
    [openDraws],
  );

  const [selectedDrawId, setSelectedDrawId] = useState(() => readSessionString('go_sales_selected_draw'));
  const [customerName, setCustomerName] = useState(() => readSessionString('go_sales_customer_name'));
  const [pullTicketCode, setPullTicketCode] = useState('');
  const [lines, setLines] = useState<SaleLine[]>(readSessionLines);
  const [error, setError] = useState(() => readSessionString('go_sales_error'));
  const [lastTicket, setLastTicket] = useState<Ticket | null>(readSessionTicket);
  const [printMode, setPrintMode] = useState(readSessionPrintMode);
  const [nativePrintMsg, setNativePrintMsg] = useState(() => readSessionString('go_sales_native_print_msg'));
  const [nativePrintJobId, setNativePrintJobId] = useState(() => readSessionString('go_sales_native_print_job_id'));
  const [nativePrintJob, setNativePrintJob] = useState<PrintJob | null>(null);
  const [nativePrintStatusError, setNativePrintStatusError] = useState('');
  const [retryingPrintJob, setRetryingPrintJob] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showNumbersSoldModal, setShowNumbersSoldModal] = useState(false);

  const refreshDrawData = useCallback((drawId: string) => {
    if (!drawId) {
      setTopNumbers([]);
      setDrawTickets([]);
      return;
    }

    reportsApi.topNumbers(drawId, 10).then(setTopNumbers).catch(() => {});
    ticketsApi.list({ drawId }).then(setDrawTickets).catch(() => {});
  }, []);

  useEffect(() => {
    drawsApi.list().then((list) => {
      setDraws(list);
      const firstOpen = list.find((d) => d.status !== 'finalizado' && isDrawOpen(d.closeTime, d.minutosPreviosCierre));
      setSelectedDrawId((current) => {
        if (current && list.some((d) => d.id === current)) {
          return current;
        }
        return firstOpen?.id ?? '';
      });
    }).catch(() => {});
    usersApi.list().then(setUsers).catch(() => {});

    numberRestrictionsApi.getGlobal().then((settings) => {
      setGlobalNumberLimit(settings.globalLimit);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    refreshDrawData(selectedDrawId);
  }, [selectedDrawId, refreshDrawData]);

  useEffect(() => {
    sessionStorage.setItem('go_sales_selected_draw', selectedDrawId);
  }, [selectedDrawId]);

  useEffect(() => {
    sessionStorage.setItem('go_sales_customer_name', customerName);
  }, [customerName]);

  useEffect(() => {
    sessionStorage.setItem('go_sales_lines', JSON.stringify(lines));
  }, [lines]);

  useEffect(() => {
    sessionStorage.setItem('go_sales_error', error);
  }, [error]);

  useEffect(() => {
    if (!lastTicket) {
      sessionStorage.removeItem('go_last_ticket');
      return;
    }
    sessionStorage.setItem('go_last_ticket', JSON.stringify(lastTicket));
  }, [lastTicket]);

  useEffect(() => {
    if (!lastTicket || !user) {
      return;
    }
    if (lastTicket.sellerId !== user.id) {
      setLastTicket(null);
      sessionStorage.removeItem('go_last_ticket');
    }
  }, [lastTicket, user]);

  useEffect(() => {
    sessionStorage.setItem('go_sales_print_mode', printMode ? '1' : '0');
  }, [printMode]);

  useEffect(() => {
    sessionStorage.setItem('go_sales_native_print_msg', nativePrintMsg);
  }, [nativePrintMsg]);

  useEffect(() => {
    sessionStorage.setItem('go_sales_native_print_job_id', nativePrintJobId);
  }, [nativePrintJobId]);

  useEffect(() => {
    if (!nativePrintJobId) {
      setNativePrintJob(null);
      setNativePrintStatusError('');
      return;
    }

    let active = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    const loadJob = async () => {
      try {
        setNativePrintStatusError('');
        const job = await printBridgeApi.getJob(nativePrintJobId);
        if (!active) {
          return;
        }
        setNativePrintJob(job);
        if (!job) {
          setNativePrintStatusError('No se encontro el trabajo en la cola de impresion.');
        }
      } catch (err: unknown) {
        if (!active) {
          return;
        }
        const message = err instanceof Error ? err.message : 'No se pudo consultar el estado de impresion';
        setNativePrintStatusError(message);
      }
    };

    void loadJob();
    timer = setInterval(() => {
      void loadJob();
    }, 5000);

    return () => {
      active = false;
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [nativePrintJobId]);

  const selectedDraw = useMemo(
    () => draws.find((d) => d.id === selectedDrawId),
    [draws, selectedDrawId],
  );

  const usersById = useMemo(
    () => new Map(users.map((u) => [u.id, u])),
    [users],
  );

  const getSellerDisplayName = useCallback((ticket: Ticket) => {
    const seller = ticket.seller ?? usersById.get(ticket.sellerId);
    if (!seller) {
      return 'Usuario no disponible';
    }
    return seller.fullName ? `${seller.fullName} (${seller.username})` : seller.username;
  }, [usersById]);

  const activeSpecialMultiplier = useMemo(
    () => selectedDraw?.specialMultiplier ?? null,
    [selectedDraw],
  );

  const soldByNumber = useMemo(() => {
    const soldMap = new Map<string, number>();
    for (const ticket of drawTickets) {
      for (const line of ticket.lines) {
        soldMap.set(line.number, (soldMap.get(line.number) ?? 0) + line.amount);
      }
    }
    return soldMap;
  }, [drawTickets]);

  const numbersSoldSummary = useMemo(() => {
    const individualByNumber = new Map(
      (selectedDraw?.restrictedNumbers ?? []).map((rn) => [rn.number, rn.limit])
    );
    const entries: {
      number: string;
      sold: number;
      limit: number | null;
      limitType: 'individual' | 'global' | null;
      remaining: number | null;
    }[] = [];
    for (const [number, sold] of soldByNumber.entries()) {
      const individualLimit = individualByNumber.get(number) ?? null;
      const effectiveLimit = individualLimit ?? globalNumberLimit;
      const limitType = individualLimit !== null ? 'individual' : globalNumberLimit !== null ? 'global' : null;
      entries.push({
        number,
        sold,
        limit: effectiveLimit,
        limitType,
        remaining: effectiveLimit !== null ? Math.max(0, effectiveLimit - sold) : null,
      });
    }
    return entries.sort((a, b) => b.sold - a.sold);
  }, [soldByNumber, selectedDraw, globalNumberLimit]);

  const restrictedSummary = useMemo(() => {
    const restrictedNumbers = selectedDraw?.restrictedNumbers ?? [];
    if (restrictedNumbers.length === 0) return [];

    return restrictedNumbers
      .map((rn) => {
        const sold = soldByNumber.get(rn.number) ?? 0;
        const remaining = Math.max(0, rn.limit - sold);
        return { ...rn, sold, remaining };
      })
      .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
  }, [selectedDraw, soldByNumber]);

  const total = useMemo(
    () => lines.reduce((sum, l) => {
      const base = parseFloat(l.amount) || 0;
      const special = activeSpecialMultiplier ? (parseFloat(l.specialAmount) || 0) : 0;
      return sum + base + special;
    }, 0),
    [lines, activeSpecialMultiplier],
  );

  const refreshCurrentDraw = useCallback(() => {
    refreshDrawData(selectedDrawId);
  }, [refreshDrawData, selectedDrawId]);

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
    onRefresh: refreshCurrentDraw,
    printTicket: printSaleTicket,
  });

  const addLine = () => {
    const lastAmount = [...lines]
      .reverse()
      .find((l) => l.amount.trim() !== '')?.amount ?? '';

    setLines([
      ...lines,
      { id: generateId(), number: '', amount: lastAmount, specialAmount: '' },
    ]);
  };

  const removeLine = (id: string) => {
    if (lines.length === 1) return;
    setLines(lines.filter((l) => l.id !== id));
  };

  const updateLine = (id: string, patch: Partial<SaleLine>) => {
    setLines(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const focusLineField = (lineId: string, field: SaleLineField) => {
    requestAnimationFrame(() => {
      const target = document.querySelector<HTMLInputElement>(`input[data-line-id="${lineId}"][data-field="${field}"]`);
      if (target) {
        target.focus();
        target.select();
      }
    });
  };

  const isLineReadyForNext = (line: SaleLine, requireSpecial: boolean) => {
    const numberOk = /^\d{2}$/.test(line.number.trim());
    const amount = parseFloat(line.amount);
    const amountOk = Number.isFinite(amount) && amount > 0;
    if (!numberOk || !amountOk) {
      return false;
    }
    if (!requireSpecial) {
      return true;
    }
    const specialAmount = parseFloat(line.specialAmount || '0');
    return Number.isFinite(specialAmount) && specialAmount >= 0 && specialAmount <= amount;
  };

  const handleLineEnter = (lineId: string, field: SaleLineField) => {
    const index = lines.findIndex((line) => line.id === lineId);
    if (index === -1) {
      return;
    }

    if (field === 'number') {
      focusLineField(lineId, 'amount');
      return;
    }

    if (field === 'amount' && activeSpecialMultiplier) {
      focusLineField(lineId, 'specialAmount');
      return;
    }

    const currentLine = lines[index];
    if (!isLineReadyForNext(currentLine, !!activeSpecialMultiplier)) {
      return;
    }

    const nextLine = lines[index + 1];
    if (nextLine) {
      focusLineField(nextLine.id, 'number');
      return;
    }

    const lastAmount = [...lines].reverse().find((line) => line.amount.trim() !== '')?.amount ?? '';
    const newLine: SaleLine = { id: generateId(), number: '', amount: lastAmount, specialAmount: '' };
    setLines((prev) => [...prev, newLine]);
    focusLineField(newLine.id, 'number');
  };

  const handleSell = async () => {
    setError('');

    if (!selectedDraw) {
      setError('Selecciona un sorteo abierto.');
      return;
    }
    if (selectedDraw.status === 'finalizado') {
      setError('El sorteo seleccionado está finalizado y no permite ventas.');
      return;
    }
    if (!isDrawOpen(selectedDraw.closeTime, selectedDraw.minutosPreviosCierre)) {
      setError('El sorteo seleccionado no está en horario de venta.');
      return;
    }
    const linesToSell = lines.filter((line, index) => {
      const isLastLine = index === lines.length - 1;
      if (!isLastLine) {
        return true;
      }
      return isLineReadyForNext(line, !!activeSpecialMultiplier);
    });

    if (linesToSell.length === 0) {
      setError('Ingresa al menos una línea válida antes de registrar la venta.');
      return;
    }

    for (const line of linesToSell) {
      if (!/^\d{2}$/.test(line.number.trim()) || !line.amount || parseFloat(line.amount) <= 0) {
        setError('Todos los números deben tener exactamente 2 dígitos y montos válidos.');
        return;
      }
      if (activeSpecialMultiplier) {
        const specAmt = parseFloat(line.specialAmount) || 0;
        const regAmt = parseFloat(line.amount) || 0;
        if (specAmt < 0) {
          setError('El monto especial no puede ser negativo.');
          return;
        }
        if (specAmt > regAmt) {
          setError(`El monto especial del número ${line.number} no puede superar el monto regular (C$ ${regAmt.toFixed(2)}).`);
          return;
        }
      }
    }

    const payload: CreateTicketPayload = {
      drawId: selectedDraw.id,
      customerName: customerName.trim() || '',
      lines: linesToSell.map((l) => ({
        number: l.number.trim(),
        amount: parseFloat(l.amount),
        specialAmount: activeSpecialMultiplier ? (parseFloat(l.specialAmount) || 0) : undefined,
        isNicaEspecial: false,
      })),
    };

    setSubmitting(true);
    try {
      const ticket = await ticketsApi.create(payload);
      if (user && ticket.sellerId === user.id) {
        setLastTicket(ticket);
      } else {
        setLastTicket(null);
      }
      setNativePrintMsg('');
      setNativePrintJobId('');
      setNativePrintJob(null);
      setNativePrintStatusError('');
      setCustomerName('');
      setLines([{ id: generateId(), number: '', amount: '', specialAmount: '' }]);
      refreshDrawData(selectedDrawId);
    } catch (err: unknown) {
      const responseData = (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data;
      const msg = responseData?.message ?? responseData?.error;
      setError(msg ?? 'Error al registrar la venta. Intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePullPreviousTicket = async () => {
    setError('');

    if (!selectedDraw) {
      setError('Selecciona un sorteo abierto antes de jalar un ticket.');
      return;
    }

    const code = pullTicketCode.trim();
    if (!code) {
      setError('Ingresa el código del ticket que deseas cargar.');
      return;
    }

    setSubmitting(true);
    try {
      const results = await ticketsApi.list({ code, includeCanceled: false });
      const sourceTicket = results[0];
      if (!sourceTicket) {
        setError('No se encontró un ticket con ese código.');
        return;
      }

      const includeSpecial = !!selectedDraw.specialMultiplier;
      const copiedLines: SaleLine[] = sourceTicket.lines.map((line) => ({
        id: generateId(),
        number: line.number,
        amount: line.amount.toString(),
        specialAmount: includeSpecial ? (line.specialAmount ?? 0).toString() : '',
      }));

      setCustomerName(sourceTicket.customerName ?? '');
      setLines(copiedLines.length > 0 ? copiedLines : [{ id: generateId(), number: '', amount: '', specialAmount: '' }]);
      setPullTicketCode(sourceTicket.code);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'No se pudo cargar el ticket indicado.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleRetryNativePrint = useCallback(async () => {
    if (!nativePrintJobId) {
      return;
    }

    setRetryingPrintJob(true);
    setNativePrintStatusError('');

    try {
      await printBridgeApi.retryJob(nativePrintJobId);
      const refreshedJob = await printBridgeApi.getJob(nativePrintJobId);
      setNativePrintJob(refreshedJob ?? null);
      setNativePrintMsg(`Reintento solicitado (Job: ${nativePrintJobId})`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'No se pudo reintentar la impresion';
      setNativePrintStatusError(message);
    } finally {
      setRetryingPrintJob(false);
    }
  }, [nativePrintJobId]);

  if (printMode && lastTicket) {
    const draw = draws.find((d) => d.id === lastTicket.drawId);
    return (
      <div>
        <div className="print:hidden mb-4">
          <Button variant="secondary" onClick={() => setPrintMode(false)}>
            ← Volver
          </Button>
        </div>
        <TicketPrintView ticket={lastTicket} draw={draw} sellerName={user?.fullName ?? ''} />
        <div className="print:hidden mt-4 flex flex-wrap gap-3">
          <NativePrintControls
            ticket={lastTicket}
            draw={draw}
            user={user}
            showBrowserButton
            onBrowserPrint={handlePrint}
            buttonVariant="secondary"
            messageClassName="print:hidden mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Ventas</h1>
        <p className="text-sm text-slate-500">Registro de apuestas de lotería</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Sales form */}
        <div className="xl:col-span-2 space-y-4">
          <Card>
            <CardBody className="space-y-4">
              <Select
                label="Sorteo"
                value={selectedDrawId}
                onChange={(e) => setSelectedDrawId(e.target.value)}
                options={drawOptions}
              />
              {openDraws.length === 0 && (
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm rounded-lg px-4 py-3">
                  No hay sorteos abiertos en este momento.
                </div>
              )}

              <Input
                label="Nombre del cliente (opcional)"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Ej: Juan Perez (opcional)"
              />

              <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-2 items-end">
                <Input
                  label="Jalar ticket previo por código"
                  value={pullTicketCode}
                  onChange={(e) => setPullTicketCode(e.target.value.toUpperCase())}
                  placeholder="Ej: ABC12-3DEF4"
                />
                <Button
                  variant="secondary"
                  onClick={handlePullPreviousTicket}
                  disabled={!selectedDrawId || submitting}
                >
                  Cargar ticket
                </Button>
              </div>

              {selectedDraw && !selectedDraw.specialMultiplier && (
                <p className="text-xs text-slate-500">
                  Al cargar un ticket en este sorteo, los montos especiales se omiten porque este sorteo no tiene especial activo.
                </p>
              )}
            </CardBody>
          </Card>

          {/* Bet lines */}
          <Card>
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">Apuestas</h2>
              <Button variant="secondary" size="sm" onClick={addLine}>
                <Plus size={14} />
                Agregar línea
              </Button>
            </div>
            <CardBody className="space-y-3">
              {activeSpecialMultiplier && (
                <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 text-purple-800 text-xs rounded-lg px-3 py-2">
                  <span className="font-semibold">Multiplicador especial activo:</span>
                  <span>{activeSpecialMultiplier.name} (×{activeSpecialMultiplier.value})</span>
                  <span className="text-purple-500">— ingresa el monto especial por línea</span>
                </div>
              )}
              <div className="grid gap-2 text-xs font-medium text-slate-500 px-1" style={{ gridTemplateColumns: activeSpecialMultiplier ? '1fr 1fr 1fr auto' : '1fr 1fr auto' }}>
                <div>Número</div>
                <div>Monto (C$)</div>
                {activeSpecialMultiplier && <div>Especial (C$)</div>}
                <div></div>
              </div>

              {lines.map((line) => {
                const normalizedNumber = line.number.trim();
                const summaryEntry = restrictedSummary.find((rn) => rn.number === normalizedNumber);
                const sold = soldByNumber.get(normalizedNumber) ?? 0;
                const effectiveLimit = summaryEntry?.limit ?? globalNumberLimit;
                const remaining = effectiveLimit !== null && /^\d{2}$/.test(normalizedNumber)
                  ? Math.max(0, effectiveLimit - sold)
                  : null;
                const restrictionScope = summaryEntry ? 'individual' : (effectiveLimit !== null ? 'global' : null);

                return (
                  <div key={line.id} className="space-y-1">
                    <div className="grid gap-2 items-center" style={{ gridTemplateColumns: activeSpecialMultiplier ? '1fr 1fr 1fr auto' : '1fr 1fr auto' }}>
                      <div>
                        <input
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                          placeholder="00"
                          data-line-id={line.id}
                          data-field="number"
                          value={line.number}
                          onChange={(e) => updateLine(line.id, { number: e.target.value.replace(/\D/g, '').slice(0, 2) })}
                          onKeyDown={(e) => {
                            if (e.key !== 'Enter') return;
                            e.preventDefault();
                            handleLineEnter(line.id, 'number');
                          }}
                          maxLength={2}
                        />
                      </div>
                      <div>
                        <input
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          type="number"
                          placeholder="0.00"
                          min="1"
                          data-line-id={line.id}
                          data-field="amount"
                          value={line.amount}
                          onChange={(e) => updateLine(line.id, { amount: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key !== 'Enter') return;
                            e.preventDefault();
                            handleLineEnter(line.id, 'amount');
                          }}
                        />
                      </div>
                      {activeSpecialMultiplier && (
                        <div>
                          <input
                            className="w-full px-3 py-2 rounded-lg border border-purple-300 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-purple-50"
                            type="number"
                            placeholder="0.00"
                            min="0"
                            data-line-id={line.id}
                            data-field="specialAmount"
                            value={line.specialAmount}
                            onChange={(e) => updateLine(line.id, { specialAmount: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key !== 'Enter') return;
                              e.preventDefault();
                              handleLineEnter(line.id, 'specialAmount');
                            }}
                          />
                        </div>
                      )}
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => removeLine(line.id)}
                          disabled={lines.length === 1}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg disabled:opacity-30"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    {restrictionScope && remaining !== null && (
                      <div className={`text-xs px-1 ${remaining <= 0 ? 'text-red-600' : 'text-yellow-600'}`}>
                        ⚠ Restricción {restrictionScope === 'individual' ? 'individual' : 'global'} — Disponible: C$ {Math.max(0, remaining)}
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-sm text-slate-600 font-medium">Total</span>
                <span className="text-xl font-bold text-slate-900">{formatCurrency(total)}</span>
              </div>
            </CardBody>
          </Card>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <Button
              className="flex-1"
              size="lg"
              onClick={handleSell}
              disabled={!canCreateSale || !selectedDrawId || submitting}
            >
              <ShoppingCart size={18} />
              Registrar Venta
            </Button>
          </div>

          {/* Last ticket confirmation */}
          {lastTicket && (
            <Card className="border-green-200 bg-green-50">
              <CardBody>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-800 font-semibold">✓ Ticket registrado</p>
                    <p className="text-green-700 text-sm font-mono mt-1">{lastTicket.code}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setPrintMode(true)}
                    >
                      <Printer size={14} />
                      Ver / Imprimir
                    </Button>
                    <NativePrintControls
                      ticket={lastTicket}
                      draw={draws.find((d) => d.id === lastTicket.drawId)}
                      user={user}
                      buttonVariant="secondary"
                      buttonSize="sm"
                      showMessage={false}
                      onMessageChange={setNativePrintMsg}
                      onJobIdChange={setNativePrintJobId}
                    />
                  </div>
                </div>
              </CardBody>
            </Card>
          )}

          {lastTicket && nativePrintMsg && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {nativePrintMsg}
            </div>
          )}

          {lastTicket && nativePrintJobId && (
            <Card>
              <CardBody className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Estado de la ultima impresion nativa</p>
                    <p className="mt-1 font-mono text-xs text-slate-500">Job: {nativePrintJobId}</p>
                  </div>
                  {nativePrintJob ? (
                    <Badge variant={NATIVE_PRINT_STATUS_BADGE[nativePrintJob.status]} className="gap-1.5">
                      <NativePrintStatusIcon status={nativePrintJob.status} />
                      {NATIVE_PRINT_STATUS_LABEL[nativePrintJob.status]}
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Consultando...</Badge>
                  )}
                </div>

                {nativePrintJob && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span>Intentos: {nativePrintJob.attempts}/{nativePrintJob.maxAttempts}</span>
                    <span>Actualizado: {formatDateTime(nativePrintJob.updatedAt)}</span>
                    {nativePrintJob.finishedAt && <span>Finalizado: {formatDateTime(nativePrintJob.finishedAt)}</span>}
                  </div>
                )}

                {nativePrintJob?.lastError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {nativePrintJob.lastError}
                  </div>
                )}

                {nativePrintStatusError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {nativePrintStatusError}
                  </div>
                )}

                {nativePrintJob?.status === 'failed' && (
                  <div className="flex justify-end">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleRetryNativePrint}
                      disabled={retryingPrintJob}
                      loading={retryingPrintJob}
                    >
                      <RotateCcw size={14} />
                      Reintentar impresion
                    </Button>
                  </div>
                )}
              </CardBody>
            </Card>
          )}

          <FilteredTicketsCard
            title="Tickets filtrados"
            subtitle="Historial del sorteo seleccionado para reimpresion y anulacion"
            loading={false}
            tickets={selectedDrawId ? drawTickets : []}
            emptyMessage={selectedDrawId ? 'No hay tickets' : 'Selecciona un sorteo para ver su historial'}
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

        {/* Right panel */}
        <div className="space-y-4">
          {/* Totals for draw */}
          {selectedDraw && (
            <Card>
              <div className="px-4 py-3 border-b border-slate-200">
                <h3 className="font-semibold text-slate-800 text-sm">Acumulado del sorteo</h3>
              </div>
              <CardBody>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Tickets vendidos</span>
                    <span className="font-medium">{drawTickets.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total recaudado</span>
                    <span className="font-bold text-green-700">
                      {formatCurrency(drawTickets.reduce((s, t) => s + t.total, 0))}
                    </span>
                  </div>
                </div>
              </CardBody>
            </Card>
          )}

          {/* Restricted numbers */}
          {selectedDraw && (
            <Card>
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <h3 className="font-semibold text-slate-800 text-sm">Restricción global</h3>
                {soldByNumber.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowNumbersSoldModal(true)}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
                    title="Ver números jugados en este sorteo"
                  >
                    <List size={13} />
                    Ver números
                  </button>
                )}
              </div>
              <CardBody>
                {globalNumberLimit === null ? (
                  <p className="text-slate-400 text-xs text-center py-2">
                    No hay restricción global activa para este sorteo.
                  </p>
                ) : (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Límite base por número</span>
                      <span className="font-bold text-amber-700">{formatCurrency(globalNumberLimit)}</span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Aplica a cualquier número del sorteo salvo que exista una restricción individual, la cual predomina.
                    </p>
                  </div>
                )}
              </CardBody>
            </Card>
          )}

          {selectedDraw && (
            <Card>
              <div className="px-4 py-3 border-b border-slate-200">
                <h3 className="font-semibold text-slate-800 text-sm">Restricciones individuales</h3>
              </div>
              <CardBody className="p-0">
                {restrictedSummary.length === 0 ? (
                  <p className="text-slate-400 text-xs text-center py-4 px-4">
                    Este sorteo no tiene restricciones individuales
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {restrictedSummary.map((rn) => (
                      <div key={rn.number} className="px-4 py-2 space-y-1">
                        <div className="flex items-center justify-between">
                          <Badge variant="warning">{rn.number}</Badge>
                          <span className={`text-xs font-semibold ${rn.remaining <= 0 ? 'text-red-600' : 'text-yellow-700'}`}>
                            Disponible: {formatCurrency(rn.remaining)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500">Vendido: {formatCurrency(rn.sold)}</span>
                          <span className="text-slate-500">Límite: {formatCurrency(rn.limit)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          )}

          {/* Top 10 numbers */}
          <Card>
            <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2">
              <Award size={16} className="text-yellow-600" />
              <h3 className="font-semibold text-slate-800 text-sm">Top 10 números</h3>
            </div>
            <CardBody className="p-0">
              {topNumbers.length === 0 ? (
                <p className="text-slate-400 text-xs text-center py-4 px-4">
                  Sin datos para este sorteo
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {topNumbers.map((n, i) => (
                    <div key={n.number} className="flex items-center gap-3 px-4 py-2">
                      <span className="text-xs text-slate-400 w-4">{i + 1}</span>
                      <Badge variant="info">{n.number}</Badge>
                      <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-blue-500 h-1.5 rounded-full"
                          style={{
                            width: `${Math.round((n.total / topNumbers[0].total) * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs font-medium text-slate-600 whitespace-nowrap">
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

      {/* Numbers sold modal */}
      <Modal
        open={showNumbersSoldModal}
        onClose={() => setShowNumbersSoldModal(false)}
        title={`Números jugados — ${selectedDraw?.name ?? ''}`}
        size="md"
      >
        <div className="p-4">
          {numbersSoldSummary.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-6">No hay números jugados en este sorteo.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                    <th className="pb-2 pr-4 font-medium">Número</th>
                    <th className="pb-2 pr-4 font-medium text-right">Vendido</th>
                    <th className="pb-2 pr-4 font-medium text-right">Límite</th>
                    <th className="pb-2 font-medium text-right">Disponible</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {numbersSoldSummary.map((row) => {
                    const isAtLimit = row.remaining !== null && row.remaining <= 0;
                    const isNearLimit = row.remaining !== null && row.remaining > 0 && row.limit !== null && row.sold / row.limit >= 0.8;
                    return (
                      <tr key={row.number} className="hover:bg-slate-50">
                        <td className="py-2 pr-4">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-800">{row.number}</span>
                            {row.limitType && (
                              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                                row.limitType === 'individual'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-blue-50 text-blue-600'
                              }`}>
                                {row.limitType === 'individual' ? 'ind.' : 'global'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 pr-4 text-right font-medium text-slate-700">
                          {formatCurrency(row.sold)}
                        </td>
                        <td className="py-2 pr-4 text-right text-slate-500">
                          {row.limit !== null ? formatCurrency(row.limit) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="py-2 text-right font-semibold">
                          {row.remaining !== null ? (
                            <span className={isAtLimit ? 'text-red-600' : isNearLimit ? 'text-yellow-600' : 'text-green-700'}>
                              {formatCurrency(row.remaining)}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="mt-3 text-xs text-slate-400">
                {numbersSoldSummary.length} número{numbersSoldSummary.length !== 1 ? 's' : ''} jugado{numbersSoldSummary.length !== 1 ? 's' : ''}.
                {' '}ind. = restricción individual por sorteo · global = restricción global.
              </p>
            </div>
          )}
        </div>
      </Modal>

    </div>
  );
}

const NativePrintControls = React.memo(function NativePrintControls({
  ticket,
  draw,
  user,
  showBrowserButton = false,
  onBrowserPrint,
  buttonVariant = 'secondary',
  buttonSize = 'md',
  showMessage = true,
  onMessageChange,
  onJobIdChange,
  messageClassName = 'mt-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700',
}: {
  ticket: Ticket;
  draw?: Draw;
  user?: User | null;
  showBrowserButton?: boolean;
  onBrowserPrint?: () => void;
  buttonVariant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
  buttonSize?: 'sm' | 'md' | 'lg';
  showMessage?: boolean;
  onMessageChange?: (message: string) => void;
  onJobIdChange?: (jobId: string) => void;
  messageClassName?: string;
}) {
  const [nativePrinting, setNativePrinting] = useState(false);
  const [nativePrintMsg, setNativePrintMsg] = useState(() => sessionStorage.getItem('go_sales_native_print_msg') ?? '');

  useEffect(() => {
    sessionStorage.setItem('go_sales_native_print_msg', nativePrintMsg);
    onMessageChange?.(nativePrintMsg);
  }, [nativePrintMsg, onMessageChange]);

  const onNativePrintClick = useCallback(async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    setNativePrintMsg('');
    onJobIdChange?.('');
    setNativePrinting(true);

    try {
      const payload = mapSaleTicketToPrintBridge({ ticket, draw, user });
      const result = await printBridgeApi.printTicket(payload);
      onJobIdChange?.(result.jobId);
      setNativePrintMsg(`En cola para imprimir (Job: ${result.jobId})`);
    } catch (err: unknown) {
      onJobIdChange?.('');
      const message = err instanceof Error ? err.message : 'No se pudo imprimir en bridge local';
      setNativePrintMsg(message);
    } finally {
      setNativePrinting(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket, draw, user]);


  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {showBrowserButton && onBrowserPrint && (
          <Button onClick={onBrowserPrint}>
            <Printer size={16} />
            Imprimir navegador
          </Button>
        )}
        <Button variant={buttonVariant} size={buttonSize} onClick={onNativePrintClick} disabled={nativePrinting}>
          <Printer size={16} />
          {nativePrinting ? 'Enviando...' : 'Imprimir nativo'}
        </Button>
      </div>

      {showMessage && nativePrintMsg && <div className={messageClassName}>{nativePrintMsg}</div>}
    </>
  );
});

function TicketPrintView({
  ticket,
  draw,
  sellerName,
}: {
  ticket: Ticket;
  draw?: Draw;
  sellerName: string;
}) {
  const regularMultiplier = ticket.seller?.plan?.multiplier;
  const specialMultiplier = draw?.specialMultiplier?.value ?? ticket.draw?.specialMultiplier?.value;

  return (
    <div
      className="max-w-xs mx-auto bg-white border border-slate-200 rounded-xl p-6 shadow-md font-mono text-sm"
      style={{ minWidth: 280 }}
    >
      <div className="text-center mb-4">
        <div className="font-bold text-xl">GameOver Lotería</div>
        <div className="text-xs text-slate-500">Sistema de Tickets</div>
        <div className="border-t-2 border-dashed border-slate-300 mt-3 pt-3 font-bold text-lg tracking-widest">
          {ticket.code}
        </div>
      </div>

      <div className="space-y-1 text-xs mb-4">
        <div className="flex justify-between">
          <span className="text-slate-500">Sorteo:</span>
          <span>{draw ? formatDrawLabel(draw) : ticket.drawId}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Cliente:</span>
          <span>{ticket.customerName || 'Consumidor final'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Fecha:</span>
          <span>{formatDateTime(ticket.createdAt)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Vendedor:</span>
          <span>{sellerName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Mult. regular:</span>
          <span>{typeof regularMultiplier === 'number' ? `x${regularMultiplier}` : 'N/A'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Mult. especial:</span>
          <span>{typeof specialMultiplier === 'number' ? `x${specialMultiplier}` : 'No aplica'}</span>
        </div>
      </div>

      <div className="border-t border-dashed border-slate-300 pt-3 mb-3">
        <div className="grid grid-cols-4 text-xs font-bold text-slate-500 mb-1">
          <span>Número</span>
          <span className="text-center">Regular</span>
          <span className="text-center text-purple-600">Especial</span>
          <span className="text-right">Total</span>
        </div>
        {ticket.lines.map((l, i) => (
          <div key={i} className="grid grid-cols-4 text-xs py-0.5">
            <span className="font-bold">{l.number}</span>
            <span className="text-center">{formatCurrency(l.amount)}</span>
            <span className="text-center text-purple-700">{formatCurrency(l.specialAmount ?? 0)}</span>
            <span className="text-right">{formatCurrency(l.amount + (l.specialAmount ?? 0))}</span>
          </div>
        ))}
      </div>

      <div className="border-t-2 border-dashed border-slate-300 pt-3">
        <div className="flex justify-between font-bold">
          <span>TOTAL</span>
          <span>{formatCurrency(ticket.total)}</span>
        </div>
      </div>

      <div className="text-center text-xs text-slate-400 mt-4 border-t border-slate-200 pt-3">
        Gracias por su compra
      </div>
    </div>
  );
}
