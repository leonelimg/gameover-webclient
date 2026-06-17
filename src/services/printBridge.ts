import { Draw, PrintJob, PrintQueueStats, Ticket, User } from '@/types';
import { formatDrawLabel } from '@/utils/helpers';
import { getFrontendTicketFooterLines, loadFrontendTicketSettings } from '@/utils/ticketAppearance';

export interface PrintBridgeTicket {
  width?: 58 | 80;
  title?: string;
  businessName?: string;
  drawLabel?: string;
  drawDateIso?: string;
  customerName?: string;
  sellerName?: string;
  showSpecialColumn?: boolean;
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

interface GroupedTicketLine {
  number: string;
  regular: number;
  special: number;
  total: number;
}

const groupTicketLinesByAmount = (
  lines: Array<{ number: string; amount: number; specialAmount?: number | null }>,
  includeSpecial: boolean
): GroupedTicketLine[] => {
  const groups = new Map<string, { numbers: string[]; regular: number; special: number }>();

  for (const line of lines) {
    const special = includeSpecial ? (line.specialAmount ?? 0) : 0;
    const key = includeSpecial
      ? `${line.amount.toFixed(2)}|${special.toFixed(2)}`
      : line.amount.toFixed(2);

    const current = groups.get(key);
    if (current) {
      current.numbers.push(line.number);
      continue;
    }

    groups.set(key, {
      numbers: [line.number],
      regular: line.amount,
      special,
    });
  }

  return Array.from(groups.values()).map((group) => ({
    number: group.numbers.join(', '),
    regular: group.regular,
    special: group.special,
    total: group.regular + group.special,
  }));
};

const bridgeUrl = (import.meta.env['VITE_PRINTBRIDGE_URL'] as string | undefined) ?? 'http://127.0.0.1:17890';
const bridgeToken = import.meta.env['VITE_PRINTBRIDGE_TOKEN'] as string | undefined;

type LoopbackRequestInit = RequestInit & {
  targetAddressSpace?: 'loopback';
};

const withBridgeHeaders = (includeJsonContentType = false) => {
  const headers: HeadersInit = {};

  if (includeJsonContentType) {
    headers['Content-Type'] = 'application/json';
  }

  if (bridgeToken) {
    headers.Authorization = `Bearer ${bridgeToken}`;
  }

  return headers;
};

const bridgeFetchInit = (init: RequestInit = {}): LoopbackRequestInit => ({
  ...init,
  targetAddressSpace: 'loopback',
});

const isLoopbackBridgeUrl = /^http:\/\/(127\.|localhost|\[::1\])/i.test(bridgeUrl);

const buildLoopbackPermissionMessage = () => {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'este sitio';
  return [
    'El navegador bloqueo el acceso al Print Bridge local (loopback).',
    `Permite "Local Network Access" para ${origin} en la configuracion del navegador y vuelve a cargar la pagina.`,
    'En Chrome/Edge abre: chrome://settings/content/localNetworkAccess'
  ].join(' ');
};

const bridgeFetch = async (url: string, init: RequestInit = {}) => {
  try {
    return await fetch(url, bridgeFetchInit(init));
  } catch (error) {
    const isSecure = typeof window !== 'undefined' && window.isSecureContext;
    if (isSecure && isLoopbackBridgeUrl) {
      throw new Error(buildLoopbackPermissionMessage());
    }

    const message = error instanceof Error ? error.message : 'No se pudo conectar al Print Bridge';
    throw new Error(message);
  }
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
    const res = await bridgeFetch(`${bridgeUrl}/health`, {
      headers: withBridgeHeaders(),
    });
    return parseResponse<{ ok: boolean; queue: PrintQueueStats }>(res);
  },

  printTicket: async (ticket: PrintBridgeTicket) => {
    const res = await bridgeFetch(`${bridgeUrl}/print-ticket`, {
      method: 'POST',
      headers: withBridgeHeaders(true),
      body: JSON.stringify({ ticket }),
    });

    return parseResponse<{ jobId: string; status: string }>(res);
  },

  testPrint: async (message: string) => {
    const res = await bridgeFetch(`${bridgeUrl}/test-print`, {
      method: 'POST',
      headers: withBridgeHeaders(true),
      body: JSON.stringify({ message }),
    });

    return parseResponse<{ jobId: string; status: string }>(res);
  },

  getJobs: async (limit = 50) => {
    const res = await bridgeFetch(`${bridgeUrl}/jobs?limit=${limit}`, {
      headers: withBridgeHeaders(),
    });
    return parseResponse<{ jobs: PrintJob[] }>(res);
  },

  getJob: async (id: string) => {
    const res = await bridgeFetch(`${bridgeUrl}/jobs/${encodeURIComponent(id)}`, {
      headers: withBridgeHeaders(),
    });
    return parseResponse<PrintJob>(res);
  },

  retryJob: async (id: string) => {
    const res = await bridgeFetch(`${bridgeUrl}/jobs/${encodeURIComponent(id)}/retry`, {
      method: 'POST',
      headers: withBridgeHeaders(true),
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
}): Promise<PrintBridgeTicket> => {
  return loadFrontendTicketSettings().then((ticketSettings) => {
    const regularTotal = ticket.lines.reduce((sum, line) => sum + line.amount, 0);
    const specialTotal = ticket.lines.reduce((sum, line) => sum + (line.specialAmount ?? 0), 0);
    const hasSpecialAmounts = ticket.lines.some((line) => (line.specialAmount ?? 0) > 0);
    const regularMultiplier = ticket.seller?.plan?.multiplier;
    const effectiveDraw = draw ?? ticket.draw;
    const specialMultiplier = effectiveDraw?.specialMultiplier?.value;
    const drawUsesSpecial = typeof specialMultiplier === 'number' ? specialMultiplier > 0 : hasSpecialAmounts;
    const showSpecialColumn = drawUsesSpecial && hasSpecialAmounts;
    const effectiveMultiplier = showSpecialColumn && typeof specialMultiplier === 'number'
      ? specialMultiplier
      : regularMultiplier;
    const footerLines = getFrontendTicketFooterLines(effectiveMultiplier);
    const resolvedDrawLabel = effectiveDraw
      ? formatDrawLabel({
          name: effectiveDraw.name,
          closeTime: 'closeTime' in effectiveDraw ? effectiveDraw.closeTime : undefined,
        })
      : ticket.drawId;
    const groupedLines = groupTicketLinesByAmount(ticket.lines, showSpecialColumn);

    const notes = groupedLines.map((line) => {
      if (showSpecialColumn) {
        return `${line.number} R:${line.regular.toFixed(2)} E:${line.special.toFixed(2)} T:${line.total.toFixed(2)}`;
      }
      return `${line.number} ${line.regular.toFixed(2)}`;
    });

    const sellerId = user?.id ?? ticket.seller?.id ?? ticket.sellerId;
    const ticketWidth = ticketSettings.sellerTicketWidths[sellerId] ?? ticketSettings.defaultTicketWidth;
    const customerName = (ticket.customerName ?? '').trim() || 'Anonimo';
    const puesto = user?.fullName ?? ticket.seller?.fullName ?? ticket.sellerId;

    return {
      width: ticketWidth,
      title: resolvedDrawLabel,
      businessName: ticketSettings.ticketTitle,
      drawLabel: resolvedDrawLabel,
      drawDateIso: effectiveDraw && 'closeTime' in effectiveDraw ? effectiveDraw.closeTime : ticket.draw?.closeTime,
      customerName,
      sellerName: puesto,
      showSpecialColumn,
      terminal: 'WEB',
      cashier: puesto,
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
      multipliers: {
        regular: regularMultiplier,
        special: drawUsesSpecial ? specialMultiplier : undefined,
      },
      totals: {
        subtotal: regularTotal,
        total: ticket.total,
      },
      notes: [
        `Nombre del sorteo: ${resolvedDrawLabel}`,
        `Fecha/hora: ${new Date(ticket.createdAt).toLocaleString('es-NI')}`,
        ...(typeof regularMultiplier === 'number' ? [`Multiplicador regular: x${regularMultiplier}`] : []),
        ...(showSpecialColumn ? [`Multiplicador especial: x${specialMultiplier}`] : []),
        ...(showSpecialColumn ? [`Subtotal especial: ${specialTotal.toFixed(2)}`] : []),
        ...notes,
      ],
      detailLines: groupedLines,
      footer: footerLines,
    };
  });
};
