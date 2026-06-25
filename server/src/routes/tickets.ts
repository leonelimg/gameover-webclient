import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { getGlobalNumberLimit, getUserDrawSaleLimit, getUserGlobalNumberLimit, getUserRestrictedNumbersLimit, listGlobalNumberRestrictions } from '../config/numberRestrictions.js';
import { authenticate, authorizeAnyResource, authorizeResource } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { param } from '../middleware/params.js';

const router = Router();
router.use(authenticate);

type AuthUser = { sub: string; role: 'admin' | 'asociado' | 'vendedor' };

const TICKETS_TIMEZONE_OFFSET = '-06:00';

function parseDateYmdToUtc(dateValue: string, endOfDay: boolean): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const overflowCheck = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
  if (
    overflowCheck.getUTCFullYear() !== year ||
    overflowCheck.getUTCMonth() !== month - 1 ||
    overflowCheck.getUTCDate() !== day
  ) {
    return null;
  }

  const boundaryTime = endOfDay ? '23:59:59.999' : '00:00:00.000';
  const parsed = new Date(`${dateValue}T${boundaryTime}${TICKETS_TIMEZONE_OFFSET}`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function drawCancellationLocked(draw: { closeTime: Date; minutosPreviosCierre: number; winnerNumber: string | null }): boolean {
  if (draw.winnerNumber?.trim()) {
    return true;
  }

  const closeTime = new Date(draw.closeTime).getTime();
  const cutoff = closeTime - draw.minutosPreviosCierre * 60 * 1000;
  return Date.now() >= cutoff;
}

const ticketLineSchema = z.object({
  number: z.string().regex(/^\d{2}$/, 'El número debe tener exactamente 2 dígitos.'),
  amount: z.number().positive(),
  isNicaEspecial: z.boolean().default(false),
});

const createTicketSchema = z.object({
  drawId: z.string(),
  customerName: z.string(),
  lines: z.array(ticketLineSchema).min(1),
});

const cancelTicketSchema = z.object({
  reason: z.string().trim().max(300).optional(),
});

async function getAllowedSellerIds(userId: string): Promise<string[]> {
  const users = await prisma.user.findMany({
    select: { id: true, parentId: true },
  });

  const allowed = new Set<string>();
  const visit = (parentId: string) => {
    if (allowed.has(parentId)) return;
    allowed.add(parentId);
    users
      .filter((u) => u.parentId === parentId)
      .forEach((child) => visit(child.id));
  };

  visit(userId);
  return Array.from(allowed);
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

  if (ticket.associateId === user.sub) {
    return true;
  }

  const allowedSellerIds = await getAllowedSellerIds(user.sub);
  return allowedSellerIds.includes(ticket.sellerId);
}

function generateCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 10; i++) {
    if (i === 5) code += '-';
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// GET /api/tickets
router.get('/', authorizeAnyResource('/sales', '/reports/sales-by-user'), async (req, res) => {
  const {
    drawId,
    sellerId,
    associateId,
    code,
    includeCanceled,
   } = req.query as Record<string, string | undefined>;
   const {
     fromDate,
     toDate,
   } = req.query as Record<string, string | undefined>;
  const scopeWhere = await buildTicketScopeWhere(req.user as AuthUser);
  const where: Record<string, unknown> = { ...scopeWhere };
  if (drawId) where['drawId'] = drawId;
  if (sellerId) where['sellerId'] = sellerId;
  if (associateId) where['associateId'] = associateId;
  if (code) where['code'] = code.trim().toUpperCase();
  if (includeCanceled === 'false') where['canceledAt'] = null;

   // Optional date filtering
   if (fromDate || toDate) {
     if (fromDate && toDate && fromDate > toDate) {
       res.status(400).json({ message: 'El rango de fechas es inválido.' });
       return;
     }

     where['createdAt'] = {};

     if (fromDate) {
       const parsed = parseDateYmdToUtc(fromDate, false);
       if (!parsed) {
         res.status(400).json({ message: 'fromDate inválida. Use formato YYYY-MM-DD.' });
         return;
       }
       (where['createdAt'] as Record<string, Date>)['gte'] = parsed;
     }

     if (toDate) {
       const parsed = parseDateYmdToUtc(toDate, true);
       if (!parsed) {
         res.status(400).json({ message: 'toDate inválida. Use formato YYYY-MM-DD.' });
         return;
       }
       (where['createdAt'] as Record<string, Date>)['lte'] = parsed;
     }
   }

  const tickets = await prisma.ticket.findMany({
    where,
    include: { lines: true, draw: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(tickets);
});

// GET /api/tickets/:id
router.get('/:id', authorizeAnyResource('/sales', '/ticket-payments', '/reports/sales-by-user'), async (req, res) => {
  const id = param(req, 'id');
  const allowed = await canAccessTicket(id, req.user as AuthUser);
  if (!allowed) {
    res.status(403).json({ message: 'No tienes permisos para ver este ticket.' });
    return;
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      lines: true,
      draw: {
        select: {
          id: true,
          name: true,
          closeTime: true,
          minutosPreviosCierre: true,
          specialMultiplier: {
            select: {
              id: true,
              name: true,
              value: true,
            },
          },
        },
      },
      seller: {
        select: {
          id: true,
          fullName: true,
          username: true,
          plan: {
            select: {
              id: true,
              name: true,
              multiplier: true,
            },
          },
        },
      },
      associate: { select: { id: true, fullName: true } },
    },
  });
  if (!ticket) { res.status(404).json({ message: 'Ticket no encontrado.' }); return; }
  res.json(ticket);
});

// POST /api/tickets
router.post('/', authorizeResource('/sales:create'), validate(createTicketSchema), async (req, res) => {
  const body = req.body as z.infer<typeof createTicketSchema>;

  const [draw, globalNumberLimit, userGlobalNumberLimit, userDrawSaleLimit, userRestrictedNumbersLimit] = await Promise.all([
    prisma.draw.findUnique({
      where: { id: body.drawId },
    }),
    getGlobalNumberLimit(),
    getUserGlobalNumberLimit(req.user!.sub),
    getUserDrawSaleLimit(req.user!.sub),
    getUserRestrictedNumbersLimit(req.user!.sub),
  ]);
  if (!draw) { res.status(404).json({ message: 'Sorteo no encontrado.' }); return; }

  if (draw.winnerNumber?.trim()) {
    res.status(400).json({ message: 'No se puede vender en un sorteo con ganador establecido.' });
    return;
  }

  const now = Date.now();
  const closeTime = new Date(draw.closeTime).getTime();
  const cutoff = closeTime - draw.minutosPreviosCierre * 60 * 1000;
  if (now >= cutoff) {
    res.status(400).json({ message: 'El sorteo no está en horario de venta.' });
    return;
  }

  const requestedByNumber = new Map<string, number>();
  for (const line of body.lines) {
    requestedByNumber.set(line.number, (requestedByNumber.get(line.number) ?? 0) + line.amount);
  }

  const total = body.lines.reduce((s, l) => s + l.amount, 0);

  if (userDrawSaleLimit !== null) {
    const aggUserDrawSales = await prisma.ticket.aggregate({
      where: {
        drawId: body.drawId,
        sellerId: req.user!.sub,
        canceledAt: null,
      },
      _sum: { total: true },
    });

    const soldByUserInDraw = aggUserDrawSales._sum.total ?? 0;
    if (soldByUserInDraw + total > userDrawSaleLimit) {
      const available = Math.max(0, userDrawSaleLimit - soldByUserInDraw).toFixed(2);
      res.status(400).json({
        message: `Límite de venta por usuario por sorteo alcanzado. Disponible: C$ ${available}.`,
      });
      return;
    }
  }

  const globalRestrictions = await listGlobalNumberRestrictions();
  const globalRestrictionByNumber = new Map(globalRestrictions.map((item) => [item.number, item.limit]));

  const soldByUserNumber = new Map<string, number>();
  await Promise.all(
    Array.from(requestedByNumber.keys()).map(async (number) => {
      const userAgg = await prisma.ticketLine.aggregate({
        where: {
          number,
          ticket: {
            drawId: body.drawId,
            sellerId: req.user!.sub,
            canceledAt: null,
          },
        },
        _sum: { amount: true },
      });

      soldByUserNumber.set(number, userAgg._sum.amount ?? 0);
    })
  );

  for (const [number, requestedAmount] of requestedByNumber.entries()) {
    const globalByNumberLimit = globalRestrictionByNumber.get(number) ?? null;
    const effectiveLimit = globalByNumberLimit !== null
      ? (userRestrictedNumbersLimit !== null ? userRestrictedNumbersLimit : globalByNumberLimit)
      : (userGlobalNumberLimit ?? globalNumberLimit);
    const restrictionType = globalByNumberLimit !== null
      ? (userRestrictedNumbersLimit !== null ? 'restringido-usuario' : 'global-numero')
      : userGlobalNumberLimit !== null
        ? 'global-usuario'
        : 'global';
    if (effectiveLimit === null) {
      continue;
    }

    const sold = soldByUserNumber.get(number) ?? 0;

    if (sold + requestedAmount > effectiveLimit) {
      const available = Math.max(0, effectiveLimit - sold).toFixed(2);
      res.status(400).json({
        message: `Límite de restricción de venta (${restrictionType}) alcanzado para el número ${number}. Disponible: C$ ${available}.`,
      });
      return;
    }
  }

  const seller = await prisma.user.findUnique({ where: { id: req.user!.sub } });
  const associateId = seller?.parentId ?? req.user!.sub;

  let code = generateCode();
  for (let i = 0; i < 5; i++) {
    const exists = await prisma.ticket.findUnique({ where: { code } });
    if (!exists) break;
    code = generateCode();
  }

  const ticket = await prisma.ticket.create({
    data: {
      code,
      customerName: body.customerName,
      total,
      drawId: body.drawId,
      sellerId: req.user!.sub,
      associateId,
      lines: { create: body.lines.map((l) => ({ number: l.number, amount: l.amount, isNicaEspecial: l.isNicaEspecial })) },
    },
    include: {
      lines: true,
      draw: {
        select: {
          id: true,
          name: true,
          closeTime: true,
          minutosPreviosCierre: true,
          specialMultiplier: {
            select: {
              id: true,
              name: true,
              value: true,
            },
          },
        },
      },
      seller: {
        select: {
          id: true,
          fullName: true,
          username: true,
          plan: {
            select: {
              id: true,
              name: true,
              multiplier: true,
            },
          },
        },
      },
    },
  });
  res.status(201).json(ticket);
});

// PATCH /api/tickets/:id/print
router.patch('/:id/print', authorizeAnyResource('/sales', '/reports/sales-by-user'), async (req, res) => {
  const id = param(req, 'id');
  const allowed = await canAccessTicket(id, req.user as AuthUser);
  if (!allowed) {
    res.status(403).json({ message: 'No tienes permisos para marcar este ticket.' });
    return;
  }

  const ticket = await prisma.ticket.update({
    where: { id },
    data: { printedAt: new Date() },
    include: { lines: true },
  });
  res.json(ticket);
});

// PATCH /api/tickets/:id/cancel
router.patch('/:id/cancel', authorizeResource('/sales:cancel'), validate(cancelTicketSchema), async (req, res) => {
  const id = param(req, 'id');
  const body = req.body as z.infer<typeof cancelTicketSchema>;

  const existing = await prisma.ticket.findUnique({
    where: { id },
    select: {
      id: true,
      canceledAt: true,
      draw: {
        select: {
          closeTime: true,
          minutosPreviosCierre: true,
          winnerNumber: true,
        },
      },
    },
  });

  if (!existing) {
    res.status(404).json({ message: 'Ticket no encontrado.' });
    return;
  }

  const allowed = await canAccessTicket(id, req.user as AuthUser);
  if (!allowed) {
    res.status(403).json({ message: 'No tienes permisos para anular este ticket.' });
    return;
  }

  if (existing.canceledAt) {
    res.status(400).json({ message: 'El ticket ya fue anulado.' });
    return;
  }

  if (drawCancellationLocked(existing.draw)) {
    res.status(400).json({
      message: 'No se pueden anular tickets de sorteos cerrados o con número ganador ya establecido.',
    });
    return;
  }

  const ticket = await prisma.ticket.update({
    where: { id },
    data: {
      canceledAt: new Date(),
      canceledById: req.user!.sub,
      cancelReason: body.reason?.trim() || null,
    },
    include: {
      lines: true,
      draw: { select: { id: true, name: true } },
      seller: { select: { id: true, fullName: true, username: true } },
      associate: { select: { id: true, fullName: true } },
      canceledBy: { select: { id: true, fullName: true, username: true } },
    },
  });

  res.json(ticket);
});

export default router;
