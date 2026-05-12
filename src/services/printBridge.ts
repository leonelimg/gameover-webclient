import { Draw, PrintJob, PrintQueueStats, Ticket, User } from '@/types';

export interface PrintBridgeTicket {
  title?: string;
  businessName?: string;
  terminal?: string;
  cashier?: string;
  ticketNumber?: string;
  dateIso?: string;
  items: {
    label: string;
    qty?: number;
    unitPrice?: number;
    total?: number;
  }[];
  detailLines?: {
    number: string;
    regular: number;
    special: number;
    total: number;
  }[];
  multipliers?: {
    regular?: number;
    special?: number;
  };
  totals: {
    subtotal?: number;
    discount?: number;
    total: number;
    paid?: number;
    change?: number;
  };
  notes?: string[];
  qrText?: string;
  footer?: string[];
}

const bridgeUrl = (import.meta.env['VITE_PRINTBRIDGE_URL'] as string | undefined) ?? 'http://127.0.0.1:17890';
const bridgeToken = import.meta.env['VITE_PRINTBRIDGE_TOKEN'] as string | undefined;

const withAuthHeaders = () => {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (bridgeToken) {
    headers.Authorization = `Bearer ${bridgeToken}`;
  }

  return headers;
};

const parseResponse = async <T>(res: Response): Promise<T> => {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Print bridge error (${res.status})`);
  }

  return (await res.json()) as T;
};

export const printBridgeApi = {
  health: async () => {
    const res = await fetch(`${bridgeUrl}/health`, {
      headers: withAuthHeaders(),
    });
    return parseResponse<{ ok: boolean; queue: PrintQueueStats }>(res);
  },

  printTicket: async (ticket: PrintBridgeTicket) => {
    const res = await fetch(`${bridgeUrl}/print-ticket`, {
      method: 'POST',
      headers: withAuthHeaders(),
      body: JSON.stringify({ ticket }),
    });

    return parseResponse<{ jobId: string; status: string }>(res);
  },

  testPrint: async (message: string) => {
    const res = await fetch(`${bridgeUrl}/test-print`, {
      method: 'POST',
      headers: withAuthHeaders(),
      body: JSON.stringify({ message }),
    });

    return parseResponse<{ jobId: string; status: string }>(res);
  },

  getJobs: async (limit = 50) => {
    const res = await fetch(`${bridgeUrl}/jobs?limit=${limit}`, {
      headers: withAuthHeaders(),
    });
    return parseResponse<{ jobs: PrintJob[] }>(res);
  },

  getJob: async (id: string) => {
    const res = await fetch(`${bridgeUrl}/jobs/${encodeURIComponent(id)}`, {
      headers: withAuthHeaders(),
    });
    return parseResponse<PrintJob>(res);
  },

  retryJob: async (id: string) => {
    const res = await fetch(`${bridgeUrl}/jobs/${encodeURIComponent(id)}/retry`, {
      method: 'POST',
      headers: withAuthHeaders(),
    });
    return parseResponse<{ id: string; status: string; attempts: number }>(res);
  },
};

export const mapSaleTicketToPrintBridge = ({
  ticket,
  draw,
  user,
}: {
  ticket: Ticket;
  draw?: Draw;
  user?: User | null;
}): PrintBridgeTicket => {
  const regularTotal = ticket.lines.reduce((sum, line) => sum + line.amount, 0);
  const specialTotal = ticket.lines.reduce((sum, line) => sum + (line.specialAmount ?? 0), 0);
  const hasSpecialAmounts = specialTotal > 0;
  const regularMultiplier = ticket.seller?.plan?.multiplier;
  const specialMultiplier = draw?.specialMultiplier?.value ?? ticket.draw?.specialMultiplier?.value;

  const notes = ticket.lines.map((line) => {
    const tag = line.isNicaEspecial ? 'NE' : 'STD';
    const special = line.specialAmount ?? 0;
    if (hasSpecialAmounts) {
      return `${line.number} ${tag} R:${line.amount.toFixed(2)} E:${special.toFixed(2)} T:${(line.amount + special).toFixed(2)}`;
    }
    return `${line.number} ${tag} ${line.amount.toFixed(2)}`;
  });

  return {
    title: 'Ticket de Venta',
    businessName: 'GameOver Loteria',
    terminal: 'WEB',
    cashier: user?.fullName,
    ticketNumber: ticket.code,
    dateIso: ticket.createdAt,
    items: [
      {
        label: draw?.name ?? ticket.draw?.name ?? ticket.drawId,
        qty: ticket.lines.length,
        unitPrice: ticket.total,
        total: ticket.total,
      },
    ],
    detailLines: ticket.lines.map((line) => {
      const special = line.specialAmount ?? 0;
      return {
        number: line.number,
        regular: line.amount,
        special,
        total: line.amount + special,
      };
    }),
    multipliers: {
      regular: regularMultiplier,
      special: specialMultiplier,
    },
    totals: {
      subtotal: regularTotal,
      total: ticket.total,
    },
    notes: [
      `Sorteo: ${draw?.name ?? ticket.drawId}`,
      ...(typeof regularMultiplier === 'number' ? [`Multiplicador regular: x${regularMultiplier}`] : []),
      ...(typeof specialMultiplier === 'number' ? [`Multiplicador especial: x${specialMultiplier}`] : []),
      ...(hasSpecialAmounts ? [`Subtotal especial: ${specialTotal.toFixed(2)}`] : []),
      ...notes,
    ],
    qrText: ticket.code,
    footer: ['Gracias por su compra'],
  };
};
