import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { authenticate, authorizeResource } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { param } from '../middleware/params.js';

type AuthUser = { sub: string; role: 'admin' | 'asociado' | 'vendedor' };

interface PaymentTicket {
  id: string;
  code: string;
  customerName: string;
  createdAt: Date;
  canceledAt: Date | null;
  paymentStatus: 'pendiente' | 'pagado';
  paidAt: Date | null;
  draw: {
    id: string;
    name: string;
    winnerNumber: string | null;
    specialMultiplier: { id: string; name: string; value: number } | null;
  };
  lines: Array<{
    number: string;
    amount: number;
    specialAmount: number | null;
  }>;
  seller: {
    id: string;
    fullName: string;
    username: string;
    plan: {
      id: string;
      name: string;
      multiplier: number;
      commission: number;
    } | null;
  };
  associate: {
    id: string;
    fullName: string;
    plan: {
      id: string;
      name: string;
      multiplier: number;
      commission: number;
    } | null;
  };
  paidBy: {
    id: string;
    fullName: string;
    username: string;
  } | null;
}

const router = Router();
router.use(authenticate);
router.use(authorizeResource('/ticket-payments'));

const listWinningTicketsQuery = z.object({
  drawId: z.string().min(1),
  status: z.enum(['all', 'pendiente', 'pagado']).optional().default('all'),
  code: z.string().trim().optional(),
});

const markPaidSchema = z
  .object({
    ticketId: z.string().trim().optional(),
    code: z.string().trim().optional(),
  })
  .refine((value) => Boolean(value.ticketId || value.code), {
    message: 'Debe enviar ticketId o code.',
    path: ['ticketId'],
  });

async function getAllowedSellerIds(userId: string): Promise<string[]> {
  const allUsers = await prisma.user.findMany({
    select: { id: true, parentId: true },
  });
  const ids = new Set<string>([userId]);
  const walk = (parentId: string) => {
    for (const u of allUsers) {
      if (u.parentId === parentId && !ids.has(u.id)) {
        ids.add(u.id);
        walk(u.id);
      }
    }
  };
  walk(userId);
  return Array.from(ids);
}

async function canAccessTicket(ticketId: string, user: AuthUser): Promise<boolean> {
  if (user.role === 'admin') return true;

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { sellerId: true, associateId: true },
  });

  if (!ticket) return false;

  if (user.role === 'vendedor') {
    return ticket.sellerId === user.sub;
  }

  if (user.role === 'asociado') {
    if (ticket.associateId === user.sub) return true;
    const allowedSellerIds = await getAllowedSellerIds(user.sub);
    return allowedSellerIds.includes(ticket.sellerId);
  }

  return false;
}

async function buildTicketScopeWhere(user: AuthUser): Promise<Record<string, unknown>> {
  if (user.role === 'admin') {
    return {};
  }

  if (user.role === 'vendedor') {
    return { sellerId: user.sub };
  }

  const allowedSellerIds = await getAllowedSellerIds(user.sub);
  return {
    OR: [{ associateId: user.sub }, { sellerId: { in: allowedSellerIds } }],
  };
}

function normalizeNumber(value: string): string {
  const trimmed = value.trim();
  return trimmed.replace(/^0+(?=\d)/, '');
}

function normalizeTicketCodeInput(value: string): string {
  const upper = value.toUpperCase().trim();
  const compact = upper.replace(/[^A-Z0-9]/g, '');

  if (compact.length >= 10) {
    const candidate = compact.slice(0, 10);
    return `${candidate.slice(0, 5)}-${candidate.slice(5, 10)}`;
  }

  return upper;
}

function extractTicketCodeCandidates(value: string): string[] {
  const normalized = normalizeTicketCodeInput(value);
  const matches = normalized.match(/[A-Z0-9]{5}-[A-Z0-9]{5}|[A-Z0-9]{10}/g) ?? [];
  const candidateFromMatch = matches[0]
    ? normalizeTicketCodeInput(matches[0])
    : normalized;

  const candidates = new Set<string>();
  if (candidateFromMatch) candidates.add(candidateFromMatch);
  if (normalized) candidates.add(normalized);

  return Array.from(candidates);
}

function calculatePrize(ticket: PaymentTicket, defaultPlanMultiplier: number): number {
  const winnerNumber = ticket.draw.winnerNumber;
  if (!winnerNumber) return 0;

  const effectiveMultiplier =
    ticket.seller.plan?.multiplier ?? ticket.associate.plan?.multiplier ?? defaultPlanMultiplier;
  const specialMultiplierValue = ticket.draw.specialMultiplier?.value ?? null;
  const normalizedWinner = normalizeNumber(winnerNumber);

  return ticket.lines.reduce((sum, line) => {
    if (normalizeNumber(line.number) !== normalizedWinner) {
      return sum;
    }

    if (specialMultiplierValue !== null && (line.specialAmount ?? 0) > 0) {
      return sum + (line.amount + (line.specialAmount ?? 0)) * effectiveMultiplier * specialMultiplierValue;
    }

    return sum + line.amount * effectiveMultiplier;
  }, 0);
}

async function getTicketForPayment(where: { id?: string; code?: string }): Promise<PaymentTicket | null> {
  const codeCandidates = where.code ? extractTicketCodeCandidates(where.code) : [];
  const ticketWhere = where.id
    ? { id: where.id }
    : {
        OR: codeCandidates.map((code) => ({
          code: { equals: code, mode: 'insensitive' as const },
        })),
      };

  return (await prisma.ticket.findFirst({
    where: ticketWhere,
    include: {
      draw: {
        select: {
          id: true,
          name: true,
          winnerNumber: true,
          specialMultiplier: { select: { id: true, name: true, value: true } },
        },
      },
      lines: { select: { number: true, amount: true, specialAmount: true } },
      seller: {
        select: {
          id: true,
          fullName: true,
          username: true,
          plan: { select: { id: true, name: true, multiplier: true, commission: true } },
        },
      },
      associate: {
        select: {
          id: true,
          fullName: true,
          plan: { select: { id: true, name: true, multiplier: true, commission: true } },
        },
      },
      paidBy: { select: { id: true, fullName: true, username: true } },
    },
  })) as PaymentTicket | null;
}

// GET /api/payments/winning-tickets?drawId=...&status=all|pendiente|pagado&code=...
router.get('/winning-tickets', async (req, res) => {
  const parsed = listWinningTicketsQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Parámetros inválidos.' });
    return;
  }

  const { drawId, status, code } = parsed.data;

  const draw = await prisma.draw.findUnique({
    where: { id: drawId },
    select: {
      id: true,
      name: true,
      winnerNumber: true,
      specialMultiplier: { select: { id: true, name: true, value: true } },
    },
  });

  if (!draw) {
    res.status(404).json({ message: 'Sorteo no encontrado.' });
    return;
  }

  const hasWinnerNumber = Boolean(draw.winnerNumber && draw.winnerNumber.trim().length > 0);
  if (!hasWinnerNumber) {
    res.json({
      draw: {
        id: draw.id,
        name: draw.name,
        winnerNumber: draw.winnerNumber,
        hasWinnerNumber,
      },
      tickets: [],
      paidTickets: [],
      totals: {
        totalToPay: 0,
        totalPaid: 0,
        totalPending: 0,
        winnersCount: 0,
        paidCount: 0,
        pendingCount: 0,
      },
    });
    return;
  }

  const scopeWhere = await buildTicketScopeWhere(req.user as AuthUser);
  const where: Record<string, unknown> = {
    ...scopeWhere,
    drawId,
    canceledAt: null,
  };

  if (code) {
    where['code'] = { contains: code, mode: 'insensitive' };
  }

  const defaultPlan = await prisma.plan.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { multiplier: true },
  });
  const defaultPlanMultiplier = defaultPlan?.multiplier ?? 0;

  const tickets = (await prisma.ticket.findMany({
    where: {
      ...where,
      lines: {
        some: {
          number: draw.winnerNumber!,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    include: {
      draw: {
        select: {
          id: true,
          name: true,
          winnerNumber: true,
          specialMultiplier: { select: { id: true, name: true, value: true } },
        },
      },
      lines: { select: { number: true, amount: true, specialAmount: true } },
      seller: {
        select: {
          id: true,
          fullName: true,
          username: true,
          plan: { select: { id: true, name: true, multiplier: true, commission: true } },
        },
      },
      associate: {
        select: {
          id: true,
          fullName: true,
          plan: { select: { id: true, name: true, multiplier: true, commission: true } },
        },
      },
      paidBy: { select: { id: true, fullName: true, username: true } },
    },
  })) as PaymentTicket[];

  const winnerTickets = tickets
    .map((ticket) => {
      const prizeAmount = calculatePrize(ticket, defaultPlanMultiplier);
      const normalizedWinner = ticket.draw.winnerNumber ? normalizeNumber(ticket.draw.winnerNumber) : null;
      const winningNumbers = normalizedWinner
        ? ticket.lines
            .filter((line) => normalizeNumber(line.number) === normalizedWinner)
            .map((line) => line.number)
        : [];
      return {
        ticketId: ticket.id,
        code: ticket.code,
        customerName: ticket.customerName,
        seller: ticket.seller,
        createdAt: ticket.createdAt,
        paymentStatus: ticket.paymentStatus,
        paidAt: ticket.paidAt,
        paidBy: ticket.paidBy,
        winningNumbers,
        prizeAmount,
      };
    })
    .filter((ticket) => ticket.prizeAmount > 0);

  const filtered =
    status === 'all'
      ? winnerTickets
      : winnerTickets.filter((ticket) => ticket.paymentStatus === status);

  const paidTickets = winnerTickets.filter((ticket) => ticket.paymentStatus === 'pagado');

  const totalToPay = winnerTickets.reduce((sum, ticket) => sum + ticket.prizeAmount, 0);
  const totalPaid = paidTickets.reduce((sum, ticket) => sum + ticket.prizeAmount, 0);
  const totalPending = totalToPay - totalPaid;

  res.json({
    draw: {
      id: draw.id,
      name: draw.name,
      winnerNumber: draw.winnerNumber,
      hasWinnerNumber,
    },
    tickets: filtered,
    paidTickets,
    totals: {
      totalToPay,
      totalPaid,
      totalPending,
      winnersCount: winnerTickets.length,
      paidCount: paidTickets.length,
      pendingCount: winnerTickets.length - paidTickets.length,
    },
  });
});

// PATCH /api/payments/mark-paid
router.patch('/mark-paid', authorizeResource('/ticket-payments:mark-paid'), validate(markPaidSchema), async (req, res) => {
  const body = req.body as z.infer<typeof markPaidSchema>;

  const ticket = await getTicketForPayment(
    body.ticketId ? { id: body.ticketId } : { code: body.code }
  );

  if (!ticket) {
    res.status(404).json({ message: 'Ticket no encontrado.' });
    return;
  }

  const allowed = await canAccessTicket(ticket.id, req.user as AuthUser);
  if (!allowed) {
    res.status(403).json({ message: 'No tienes permisos para pagar este ticket.' });
    return;
  }

  if (ticket.canceledAt) {
    res.status(400).json({ message: 'No se puede pagar un ticket anulado.' });
    return;
  }

  if (!ticket.draw.winnerNumber) {
    res.status(400).json({ message: 'El sorteo seleccionado no tiene número ganador.' });
    return;
  }

  if (ticket.paymentStatus === 'pagado') {
    res.status(400).json({ message: 'El ticket ya fue pagado.' });
    return;
  }

  const defaultPlan = await prisma.plan.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { multiplier: true },
  });
  const prizeAmount = calculatePrize(ticket, defaultPlan?.multiplier ?? 0);
  if (prizeAmount <= 0) {
    res.status(400).json({ message: 'El ticket no contiene número ganador para pagar.' });
    return;
  }

  const updated = await prisma.ticket.update({
    where: { id: ticket.id },
    data: {
      paymentStatus: 'pagado',
      paidAt: new Date(),
      paidById: req.user!.sub,
    },
    include: {
      lines: true,
      draw: { select: { id: true, name: true, winnerNumber: true } },
      seller: { select: { id: true, fullName: true, username: true } },
      associate: { select: { id: true, fullName: true } },
      paidBy: { select: { id: true, fullName: true, username: true } },
    },
  });

  await prisma.auditLog.create({
    data: {
      action: 'MARK_TICKET_PAID',
      entity: 'Ticket',
      entityId: ticket.id,
      userId: req.user!.sub,
      details: {
        code: ticket.code,
        drawId: ticket.draw.id,
        prizeAmount,
      },
    },
  });

  res.json({
    ticket: updated,
    prizeAmount,
  });
});

// PATCH /api/payments/:id/revert
router.patch('/:id/revert', authorizeResource('/ticket-payments:revert'), async (req, res) => {
  const id = param(req, 'id');

  const ticket = await getTicketForPayment({ id });
  if (!ticket) {
    res.status(404).json({ message: 'Ticket no encontrado.' });
    return;
  }

  const allowed = await canAccessTicket(ticket.id, req.user as AuthUser);
  if (!allowed) {
    res.status(403).json({ message: 'No tienes permisos para revertir este pago.' });
    return;
  }

  if (ticket.paymentStatus !== 'pagado') {
    res.status(400).json({ message: 'Solo se puede revertir un ticket pagado.' });
    return;
  }

  const reverted = await prisma.ticket.update({
    where: { id },
    data: {
      paymentStatus: 'pendiente',
      paidAt: null,
      paidById: null,
    },
    include: {
      lines: true,
      draw: { select: { id: true, name: true, winnerNumber: true } },
      seller: { select: { id: true, fullName: true, username: true } },
      associate: { select: { id: true, fullName: true } },
      paidBy: { select: { id: true, fullName: true, username: true } },
    },
  });

  await prisma.auditLog.create({
    data: {
      action: 'REVERT_TICKET_PAYMENT',
      entity: 'Ticket',
      entityId: ticket.id,
      userId: req.user!.sub,
      details: {
        code: ticket.code,
        drawId: ticket.draw.id,
      },
    },
  });

  res.json(reverted);
});

export default router;
