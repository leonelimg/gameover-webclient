import { useCallback, useState } from 'react';
import { Draw, Ticket, User } from '@/types';
import { ticketsApi } from '@/services/api';
import { mapSaleTicketToPrintBridge, printBridgeApi } from '@/services/printBridge';

interface UseTicketActionsOptions {
  draws: Draw[];
  users: User[];
  onRefresh: () => void;
  printTicket: (ticket: Ticket) => Promise<void>;
}

function drawCancellationLocked(draw?: Draw): boolean {
  if (!draw) {
    return false;
  }

  if (draw.winnerNumber?.trim()) {
    return true;
  }

  const closeTime = new Date(draw.closeTime).getTime();
  const cutoff = closeTime - draw.minutosPreviosCierre * 60 * 1000;
  return Date.now() >= cutoff;
}

export function useTicketActions({ draws, users, onRefresh, printTicket }: UseTicketActionsOptions) {
  const [actionError, setActionError] = useState('');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  const handleViewTicket = useCallback(async (ticketId: string) => {
    setActionError('');
    try {
      const ticket = await ticketsApi.get(ticketId);
      setSelectedTicket(ticket);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setActionError(msg ?? 'No fue posible cargar el ticket.');
    }
  }, []);

  const handlePrintTicket = useCallback(async (ticketId: string) => {
    setActionError('');
    try {
      const ticket = await ticketsApi.get(ticketId);
      if (ticket.canceledAt) {
        setActionError('No se puede imprimir un ticket anulado.');
        return;
      }

      await ticketsApi.markPrinted(ticketId);
      await printTicket(ticket);
      onRefresh();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setActionError(msg ?? 'No fue posible imprimir el ticket.');
    }
  }, [onRefresh, printTicket]);

  const handlePrintTicketBridge = useCallback(async (ticketId: string) => {
    setActionError('');
    try {
      const ticket = await ticketsApi.get(ticketId);
      if (ticket.canceledAt) {
        setActionError('No se puede imprimir un ticket anulado.');
        return;
      }

      const draw = draws.find((item) => item.id === ticket.drawId);
      const seller = users.find((item) => item.id === ticket.sellerId);
      const payload = await mapSaleTicketToPrintBridge({
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
  }, [draws, users]);

  const handleCancelTicket = useCallback(async (ticket: Ticket) => {
    setActionError('');
    if (ticket.canceledAt) {
      return;
    }

    const draw = draws.find((item) => item.id === ticket.drawId);
    if (drawCancellationLocked(draw)) {
      setActionError('No se pueden anular tickets de sorteos cerrados o con número ganador ya establecido.');
      return;
    }

    const confirmed = window.confirm(`Deseas anular el ticket ${ticket.code}?`);
    if (!confirmed) {
      return;
    }

    const reason = window.prompt('Motivo de anulacion (opcional):') ?? undefined;

    try {
      await ticketsApi.cancel(ticket.id, reason?.trim() ? reason.trim() : undefined);
      if (selectedTicket?.id === ticket.id) {
        const updated = await ticketsApi.get(ticket.id);
        setSelectedTicket(updated);
      }
      onRefresh();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setActionError(msg ?? 'No fue posible anular el ticket.');
    }
  }, [draws, onRefresh, selectedTicket?.id]);

  return {
    actionError,
    selectedTicket,
    setSelectedTicket,
    handleViewTicket,
    handlePrintTicket,
    handlePrintTicketBridge,
    handleCancelTicket,
  };
}
