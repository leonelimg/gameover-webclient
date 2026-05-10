import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { param } from '../middleware/params.js';

const router = Router();
router.use(authenticate);

const ticketLineSchema = z.object({
  number: z.string().min(1).max(4),
  amount: z.number().positive(),
  isNicaEspecial: z.boolean().default(false),
});

const createTicketSchema = z.object({
  drawId: z.string(),
  customerName: z.string().min(1),
  lines: z.array(ticketLineSchema).min(1),
});

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
  const { drawId, sellerId, associateId } = req.query as Record<string, string>;
  const where: Record<string, unknown> = {};
  if (drawId) where['drawId'] = drawId;
  if (sellerId) where['sellerId'] = sellerId;
  if (associateId) where['associateId'] = associateId;
  if (req.user!.role === 'vendedor') where['sellerId'] = req.user!.sub;

  const tickets = await prisma.ticket.findMany({
    where,
    include: { lines: true, draw: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(tickets);
});

// GET /api/tickets/:id
router.get('/:id', async (req, res) => {
  const id = param(req, 'id');
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      lines: true,
      draw: { select: { id: true, name: true, openTime: true, closeTime: true } },
      seller: { select: { id: true, fullName: true, username: true } },
      associate: { select: { id: true, fullName: true } },
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
    include: { restrictedNumbers: true },
  });
  if (!draw) { res.status(404).json({ message: 'Sorteo no encontrado.' }); return; }

  const now = new Date();
  if (now < draw.openTime || now > draw.closeTime) {
    res.status(400).json({ message: 'El sorteo no está en horario de venta.' });
    return;
  }

  // Check restricted numbers
  for (const line of body.lines) {
    const restricted = draw.restrictedNumbers.find((rn) => rn.number === line.number);
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
  const total = body.lines.reduce((s, l) => s + l.amount, 0);

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
    include: { lines: true, draw: { select: { id: true, name: true } } },
  });
  res.status(201).json(ticket);
});

// PATCH /api/tickets/:id/print
router.patch('/:id/print', async (req, res) => {
  const id = param(req, 'id');
  const ticket = await prisma.ticket.update({
    where: { id },
    data: { printedAt: new Date() },
    include: { lines: true },
  });
  res.json(ticket);
});

export default router;
