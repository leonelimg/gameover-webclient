import { useEffect, useState } from 'react';
import { Plus, Trash2, Printer, ShoppingCart, Award } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { db } from '@/utils/db';
import { generateId, generateTicketCode, formatCurrency, formatDateTime, isDrawOpen } from '@/utils/helpers';
import { Draw, Ticket, TicketLine } from '@/types';
import { useAuth } from '@/context/AuthContext';

interface SaleLine {
  id: string;
  number: string;
  amount: string;
  isNicaEspecial: boolean;
}

function getTopNumbers(tickets: Ticket[], drawId: string) {
  const map: Record<string, number> = {};
  tickets
    .filter((t) => t.drawId === drawId)
    .forEach((t) => t.lines.forEach((l) => {
      map[l.number] = (map[l.number] ?? 0) + l.amount;
    }));
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([number, total]) => ({ number, total }));
}

function getSoldForNumber(tickets: Ticket[], drawId: string, number: string) {
  return tickets
    .filter((t) => t.drawId === drawId)
    .flatMap((t) => t.lines)
    .filter((l) => l.number === number)
    .reduce((sum, l) => sum + l.amount, 0);
}

export default function SalesPage() {
  const { user } = useAuth();

  const [draws, setDraws] = useState<Draw[]>(() => db.getDraws());
  const [tickets, setTickets] = useState<Ticket[]>(() => db.getTickets());

  const openDraws = draws.filter((d) => isDrawOpen(d.openTime, d.closeTime));

  const [selectedDrawId, setSelectedDrawId] = useState(openDraws[0]?.id ?? '');
  const [customerName, setCustomerName] = useState('');
  const [lines, setLines] = useState<SaleLine[]>([
    { id: generateId(), number: '', amount: '', isNicaEspecial: false },
  ]);
  const [error, setError] = useState('');
  const [lastTicket, setLastTicket] = useState<Ticket | null>(null);
  const [printMode, setPrintMode] = useState(false);

  useEffect(() => {
    setDraws(db.getDraws());
    setTickets(db.getTickets());
  }, []);

  const selectedDraw = draws.find((d) => d.id === selectedDrawId);
  const topNumbers = selectedDraw ? getTopNumbers(tickets, selectedDraw.id) : [];

  const total = lines.reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0);

  const addLine = () => {
    setLines([...lines, { id: generateId(), number: '', amount: '', isNicaEspecial: false }]);
  };

  const removeLine = (id: string) => {
    if (lines.length === 1) return;
    setLines(lines.filter((l) => l.id !== id));
  };

  const updateLine = (id: string, patch: Partial<SaleLine>) => {
    setLines(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const handleSell = () => {
    setError('');

    if (!selectedDraw) {
      setError('Selecciona un sorteo abierto.');
      return;
    }
    if (!isDrawOpen(selectedDraw.openTime, selectedDraw.closeTime)) {
      setError('El sorteo seleccionado no está en horario de venta.');
      return;
    }
    if (!customerName.trim()) {
      setError('El nombre del cliente es requerido.');
      return;
    }

    for (const line of lines) {
      if (!line.number.trim() || !line.amount || parseFloat(line.amount) <= 0) {
        setError('Todos los números y montos deben ser válidos.');
        return;
      }

      // Check restricted number limits
      const restricted = selectedDraw.restrictedNumbers.find(
        (rn) => rn.number === line.number.trim()
      );
      if (restricted) {
        const alreadySold = getSoldForNumber(tickets, selectedDraw.id, line.number.trim());
        const thisAmount = parseFloat(line.amount);
        if (alreadySold + thisAmount > restricted.limit) {
          setError(
            `El número ${line.number} ha alcanzado su límite de venta (C$ ${restricted.limit}). Vendido: C$ ${alreadySold}.`
          );
          return;
        }
      }
    }

    // Build ticket
    const ticketLines: TicketLine[] = lines.map((l) => ({
      number: l.number.trim(),
      amount: parseFloat(l.amount),
      isNicaEspecial: l.isNicaEspecial,
    }));

    const ticket: Ticket = {
      id: generateId(),
      code: generateTicketCode(),
      drawId: selectedDraw.id,
      sellerId: user!.id,
      associateId: user!.parentId ?? user!.id,
      customerName: customerName.trim(),
      lines: ticketLines,
      total: ticketLines.reduce((s, l) => s + l.amount, 0),
      createdAt: new Date().toISOString(),
    };

    const nextTickets = [...tickets, ticket];
    setTickets(nextTickets);
    db.saveTickets(nextTickets);

    setLastTicket(ticket);
    setCustomerName('');
    setLines([{ id: generateId(), number: '', amount: '', isNicaEspecial: false }]);
  };

  const handlePrint = () => {
    window.print();
  };

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
        <div className="print:hidden mt-4">
          <Button onClick={handlePrint}>
            <Printer size={16} />
            Imprimir
          </Button>
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
                options={[
                  { value: '', label: 'Selecciona un sorteo...' },
                  ...openDraws.map((d) => ({ value: d.id, label: d.name })),
                  ...(openDraws.length === 0
                    ? [{ value: '', label: 'No hay sorteos abiertos' }]
                    : []),
                ]}
              />
              {openDraws.length === 0 && (
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm rounded-lg px-4 py-3">
                  No hay sorteos abiertos en este momento.
                </div>
              )}

              <Input
                label="Nombre del cliente"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Nombre completo del cliente"
              />
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
              <div className="grid grid-cols-12 gap-2 text-xs font-medium text-slate-500 px-1">
                <div className="col-span-3">Número</div>
                <div className="col-span-3">Monto (C$)</div>
                <div className="col-span-4">Nica Especial</div>
                <div className="col-span-2"></div>
              </div>

              {lines.map((line) => {
                const restricted = selectedDraw?.restrictedNumbers.find(
                  (rn) => rn.number === line.number.trim()
                );
                const sold = restricted && selectedDraw
                  ? getSoldForNumber(tickets, selectedDraw.id, line.number.trim())
                  : 0;
                const remaining = restricted ? restricted.limit - sold : null;

                return (
                  <div key={line.id} className="space-y-1">
                    <div className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-3">
                        <input
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                          placeholder="00"
                          value={line.number}
                          onChange={(e) => updateLine(line.id, { number: e.target.value.slice(0, 4) })}
                          maxLength={4}
                        />
                      </div>
                      <div className="col-span-3">
                        <input
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          type="number"
                          placeholder="0.00"
                          min="1"
                          value={line.amount}
                          onChange={(e) => updateLine(line.id, { amount: e.target.value })}
                        />
                      </div>
                      <div className="col-span-4 flex items-center">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={line.isNicaEspecial}
                            onChange={(e) =>
                              updateLine(line.id, { isNicaEspecial: e.target.checked })
                            }
                            className="rounded border-slate-300 text-blue-600"
                          />
                          <span className="text-sm text-slate-600">Nica Especial</span>
                        </label>
                      </div>
                      <div className="col-span-2 flex justify-end">
                        <button
                          onClick={() => removeLine(line.id)}
                          disabled={lines.length === 1}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg disabled:opacity-30"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    {restricted && (
                      <div className={`text-xs px-1 ${remaining! <= 0 ? 'text-red-600' : 'text-yellow-600'}`}>
                        ⚠ Número restringido — Disponible: C$ {Math.max(0, remaining!)}
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
              disabled={!selectedDrawId}
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
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPrintMode(true)}
                  >
                    <Printer size={14} />
                    Ver / Imprimir
                  </Button>
                </div>
              </CardBody>
            </Card>
          )}
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
                    <span className="font-medium">
                      {tickets.filter((t) => t.drawId === selectedDraw.id).length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total recaudado</span>
                    <span className="font-bold text-green-700">
                      {formatCurrency(
                        tickets
                          .filter((t) => t.drawId === selectedDraw.id)
                          .reduce((s, t) => s + t.total, 0)
                      )}
                    </span>
                  </div>
                </div>
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
    </div>
  );
}

function TicketPrintView({
  ticket,
  draw,
  sellerName,
}: {
  ticket: Ticket;
  draw?: Draw;
  sellerName: string;
}) {
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
          <span>{draw?.name ?? ticket.drawId}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Cliente:</span>
          <span>{ticket.customerName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Fecha:</span>
          <span>{formatDateTime(ticket.createdAt)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Vendedor:</span>
          <span>{sellerName}</span>
        </div>
      </div>

      <div className="border-t border-dashed border-slate-300 pt-3 mb-3">
        <div className="grid grid-cols-3 text-xs font-bold text-slate-500 mb-1">
          <span>Número</span>
          <span className="text-center">Monto</span>
          <span className="text-right">Tipo</span>
        </div>
        {ticket.lines.map((l, i) => (
          <div key={i} className="grid grid-cols-3 text-xs py-0.5">
            <span className="font-bold">{l.number}</span>
            <span className="text-center">{formatCurrency(l.amount)}</span>
            <span className="text-right">{l.isNicaEspecial ? 'NE' : 'STD'}</span>
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
