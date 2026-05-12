import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { param } from '../middleware/params.js';

const router = Router();
router.use(authenticate);

const ticketLineSchema = z.object({
  number: z.string().regex(/^\d{2}$/, 'El número debe tener exactamente 2 dígitos.'),
  amount: z.number().positive(),
  specialAmount: z.number().min(0).optional().default(0),
  isNicaEspecial: z.boolean().default(false),
});

const createTicketSchema = z.object({
  drawId: z.string(),
  customerName: z.string().trim().max(120).optional().default(''),
  lines: z.array(ticketLineSchema).min(1),
});

const cancelTicketSchema = z.object({
  reason: z.string().trim().min(3).max(200).optional(),
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

async function canAccessTicket(ticketId: string, user: { sub: string; role: string }): Promise<boolean> {
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
router.get('/', async (req, res) => {
  const { drawId, sellerId, associateId, includeCanceled } = req.query as Record<string, string>;
  const where: Record<string, unknown> = {};
  if (drawId) where['drawId'] = drawId;
  if (sellerId) where['sellerId'] = sellerId;
  if (associateId) where['associateId'] = associateId;
  if (req.user!.role === 'vendedor') where['sellerId'] = req.user!.sub;
  if (req.user!.role === 'asociado') {
    const allowedSellerIds = await getAllowedSellerIds(req.user!.sub);
    where['OR'] = [
      { associateId: req.user!.sub },
      { sellerId: { in: allowedSellerIds } },
    ];
  }
  if (includeCanceled !== 'true') {
    where['canceledAt'] = null;
  }

  const tickets = await prisma.ticket.findMany({
    where,
    include: {
      lines: true,
      draw: { select: { id: true, name: true, specialMultiplier: { select: { id: true, name: true, value: true } } } },
      seller: {
        select: {
          id: true,
          fullName: true,
          username: true,
          plan: { select: { id: true, name: true, multiplier: true } },
        },
      },
      associate: { select: { id: true, fullName: true } },
      canceledBy: { select: { id: true, fullName: true, username: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(tickets);
});

// GET /api/tickets/:id
router.get('/:id', async (req, res) => {
  const id = param(req, 'id');

  const allowed = await canAccessTicket(id, req.user!);
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
          specialMultiplier: { select: { id: true, name: true, value: true } },
        },
      },
      seller: {
        select: {
          id: true,
          fullName: true,
          username: true,
          plan: { select: { id: true, name: true, multiplier: true } },
        },
      },
      associate: { select: { id: true, fullName: true } },
      canceledBy: { select: { id: true, fullName: true, username: true } },
    },
  });
  if (!ticket) { res.status(404).json({ message: 'Ticket no encontrado.' }); return; }
  res.json(ticket);
});

// POST /api/tickets
router.post('/', validate(createTicketSchema), async (req, res) => {
  const body = req.body as z.infer<typeof createTicketSchema>;

  const draw = await prisma.draw.findUnique({
    where: { id: body.drawId },
    include: {
      restrictedNumbers: true,
      specialMultiplier: true,
    },
  });
  if (!draw) { res.status(404).json({ message: 'Sorteo no encontrado.' }); return; }

  if (draw.status === 'finalizado') {
    res.status(400).json({ message: 'No se puede vender en un sorteo finalizado.' });
    return;
  }

  const now = new Date();
  const cutoff = new Date(draw.closeTime.getTime() - draw.minutosPreviosCierre * 60 * 1000);
  if (now >= cutoff || now > draw.closeTime) {
    res.status(400).json({ message: 'El sorteo no está en horario de venta.' });
    return;
  }

  // Validate: specialAmount per line cannot exceed regular amount
  if (draw.specialMultiplier) {
    for (const line of body.lines) {
      const special = line.specialAmount ?? 0;
      if (special > line.amount) {
        res.status(400).json({
          message: `El monto especial del número ${line.number} no puede superar el monto regular (C$ ${line.amount.toFixed(2)}).`,
        });
        return;
      }
    }
  }

  // Check restricted numbers
  for (const line of body.lines) {
    const restricted = draw.restrictedNumbers.find((rn: { number: string; limit: number }) => rn.number === line.number);
    if (restricted) {
      const agg = await prisma.ticketLine.aggregate({
        where: { number: line.number, ticket: { drawId: body.drawId } },
        _sum: { amount: true },
      });
      const sold = agg._sum.amount ?? 0;
      if (sold + line.amount > restricted.limit) {
        res.status(400).json({
          message: `Número ${line.number} alcanzó su límite. Disponible: C$ ${(restricted.limit - sold).toFixed(2)}.`,
        });
        return;
      }
    }
  }

  const seller = await prisma.user.findUnique({ where: { id: req.user!.sub } });
  const associateId = seller?.parentId ?? req.user!.sub;
  const total = body.lines.reduce((s, l) => s + l.amount + (draw.specialMultiplier ? (l.specialAmount ?? 0) : 0), 0);

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
      lines: { create: body.lines.map((l) => ({
        number: l.number,
        amount: l.amount,
        specialAmount: draw.specialMultiplier ? (l.specialAmount ?? 0) : null,
        isNicaEspecial: l.isNicaEspecial,
      })) },
    },
    include: {
      lines: true,
      draw: { select: { id: true, name: true, specialMultiplier: { select: { id: true, name: true, value: true } } } },
      seller: {
        select: {
          id: true,
          fullName: true,
          username: true,
          plan: { select: { id: true, name: true, multiplier: true } },
        },
      },
    },
  });
  res.status(201).json(ticket);
});

// PATCH /api/tickets/:id/print
router.patch('/:id/print', async (req, res) => {
  const id = param(req, 'id');

  const allowed = await canAccessTicket(id, req.user!);
  if (!allowed) {
    res.status(403).json({ message: 'No tienes permisos para marcar este ticket como impreso.' });
    return;
  }

  const existing = await prisma.ticket.findUnique({
    where: { id },
    select: { id: true, canceledAt: true },
  });

  if (!existing) {
    res.status(404).json({ message: 'Ticket no encontrado.' });
    return;
  }

  if (existing.canceledAt) {
    res.status(400).json({ message: 'No se puede imprimir un ticket anulado.' });
    return;
  }

  const ticket = await prisma.ticket.update({
    where: { id },
    data: { printedAt: new Date() },
    include: {
      lines: true,
      canceledBy: { select: { id: true, fullName: true, username: true } },
    },
  });
  res.json(ticket);
});

// PATCH /api/tickets/:id/cancel
router.patch('/:id/cancel', validate(cancelTicketSchema), async (req, res) => {
  const id = param(req, 'id');
  const body = req.body as z.infer<typeof cancelTicketSchema>;

  if (!['admin', 'asociado'].includes(req.user!.role)) {
    res.status(403).json({ message: 'No tienes permisos para anular tickets.' });
    return;
  }

  const allowed = await canAccessTicket(id, req.user!);
  if (!allowed) {
    res.status(403).json({ message: 'No tienes permisos para anular este ticket.' });
    return;
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    select: { id: true, canceledAt: true },
  });

  if (!ticket) {
    res.status(404).json({ message: 'Ticket no encontrado.' });
    return;
  }

  if (ticket.canceledAt) {
    res.status(400).json({ message: 'El ticket ya fue anulado.' });
    return;
  }

  const canceled = await prisma.ticket.update({
    where: { id },
    data: {
      canceledAt: new Date(),
      canceledById: req.user!.sub,
      cancelReason: body.reason ?? null,
    },
    include: {
      lines: true,
      draw: { select: { id: true, name: true } },
      seller: { select: { id: true, fullName: true, username: true } },
      associate: { select: { id: true, fullName: true } },
      canceledBy: { select: { id: true, fullName: true, username: true } },
    },
  });

  await prisma.auditLog.create({
    data: {
      action: 'CANCEL_TICKET',
      entity: 'Ticket',
      entityId: id,
      userId: req.user!.sub,
      details: { reason: body.reason ?? null },
    },
  });

  res.json(canceled);
});

export default router;
