import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Ticket } from '@/types';
import { formatCurrency, formatDateTime, formatDrawLabel } from '@/utils/helpers';

interface FilteredTicketsCardProps {
  loading: boolean;
  tickets: Ticket[];
  canCancelTickets: boolean;
  actionError?: string;
  emptyMessage?: string;
  title?: string;
  subtitle?: string;
  selectedTicket: Ticket | null;
  onCloseTicket: () => void;
  onViewTicket: (ticketId: string) => void | Promise<void>;
  onPrintTicket: (ticketId: string) => void | Promise<void>;
  onPrintTicketBridge: (ticketId: string) => void | Promise<void>;
  onCancelTicket: (ticket: Ticket) => void | Promise<void>;
  getSellerDisplayName?: (ticket: Ticket) => string;
}

const defaultSellerDisplayName = (ticket: Ticket) => ticket.seller?.fullName ?? ticket.sellerId;

export function FilteredTicketsCard({
  loading,
  tickets,
  canCancelTickets,
  actionError,
  emptyMessage = 'No hay tickets',
  title = 'Tickets filtrados',
  subtitle,
  selectedTicket,
  onCloseTicket,
  onViewTicket,
  onPrintTicket,
  onPrintTicketBridge,
  onCancelTicket,
  getSellerDisplayName = defaultSellerDisplayName,
}: FilteredTicketsCardProps) {
  return (
    <>
      <Card>
        <CardHeader>
          <div>
            <h2 className="font-semibold text-slate-800">{title}</h2>
            {subtitle ? <p className="text-xs text-slate-500 mt-1">{subtitle}</p> : null}
          </div>
        </CardHeader>

        {actionError ? <p className="px-6 pb-3 text-sm text-red-600">{actionError}</p> : null}

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
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">{emptyMessage}</td>
                </tr>
              ) : (
                tickets.map((ticket) => (
                  <tr key={ticket.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs text-slate-800">{ticket.code}</p>
                      <p className="text-xs text-slate-500">{formatDateTime(ticket.createdAt)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-900">{getSellerDisplayName(ticket)}</p>
                      <p className="text-xs text-slate-500">{ticket.customerName}</p>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{formatCurrency(ticket.total)}</td>
                    <td className="px-4 py-3 text-center">
                      {ticket.canceledAt ? <Badge variant="danger">Anulado</Badge> : <Badge variant="success">Activo</Badge>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Button size="sm" variant="secondary" onClick={() => onViewTicket(ticket.id)}>
                          Ver
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onPrintTicket(ticket.id)}
                          disabled={!!ticket.canceledAt}
                        >
                          Imprimir
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onPrintTicketBridge(ticket.id)}
                          disabled={!!ticket.canceledAt}
                        >
                          Nativo
                        </Button>
                        {canCancelTickets ? (
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => onCancelTicket(ticket)}
                            disabled={!!ticket.canceledAt}
                          >
                            Anular
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={!!selectedTicket}
        onClose={onCloseTicket}
        title={selectedTicket ? `Ticket ${selectedTicket.code}` : 'Ticket'}
        size="lg"
      >
        {selectedTicket ? (
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
                <p className="font-medium">{getSellerDisplayName(selectedTicket)}</p>
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

            {selectedTicket.canceledAt ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <p className="font-semibold">Ticket anulado</p>
                <p>Anulado el {formatDateTime(selectedTicket.canceledAt)}</p>
                {selectedTicket.cancelReason ? <p>Motivo: {selectedTicket.cancelReason}</p> : null}
              </div>
            ) : null}

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
                {selectedTicket.lines.some((line) => (line.specialAmount ?? 0) > 0) ? (
                  <p className="text-xs text-slate-500">
                    Regular: {formatCurrency(selectedTicket.lines.reduce((sum, line) => sum + line.amount, 0))} | Especial:{' '}
                    {formatCurrency(selectedTicket.lines.reduce((sum, line) => sum + (line.specialAmount ?? 0), 0))}
                  </p>
                ) : null}
              </div>
              <p className="font-bold text-lg text-slate-900">{formatCurrency(selectedTicket.total)}</p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={onCloseTicket}>
                Cerrar
              </Button>
              <Button
                variant="ghost"
                onClick={() => onPrintTicket(selectedTicket.id)}
                disabled={!!selectedTicket.canceledAt}
              >
                Imprimir
              </Button>
              <Button
                variant="ghost"
                onClick={() => onPrintTicketBridge(selectedTicket.id)}
                disabled={!!selectedTicket.canceledAt}
              >
                Nativo
              </Button>
              {canCancelTickets ? (
                <Button
                  variant="danger"
                  onClick={() => onCancelTicket(selectedTicket)}
                  disabled={!!selectedTicket.canceledAt}
                >
                  Anular
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
