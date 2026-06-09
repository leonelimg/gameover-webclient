import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { authenticate, authorizeAnyResource, authorizeResource } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { param } from '../middleware/params.js';

type DrawStatusValue = 'pendiente' | 'abierto' | 'cerrado' | 'finalizado';

const router = Router();
router.use(authenticate);

const drawSchema = z.object({
  name: z.string().min(2),
  closeTime: z.string().datetime(),
  minutosPreviosCierre: z.coerce.number().int().min(0).max(1440).default(10),
  winnerNumber: z.string().regex(/^\d{2}$/, 'El número ganador debe tener exactamente 2 dígitos.').optional().nullable(),
  specialMultiplierId: z.string().optional().nullable(),
});

const rnSchema = z.object({
  number: z.string().regex(/^\d{2}$/, 'El número restringido debe tener exactamente 2 dígitos.'),
  limit: z.number().positive(),
});

const drawSearchQuerySchema = z.object({
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(12),
});

function resolveStatus(closeTime: string | Date, minutosPreviosCierre: number, winner?: string | null): DrawStatusValue {
  if (winner) return 'finalizado';
  const now = Date.now();
  const c = new Date(closeTime).getTime();
  const cutoff = c - minutosPreviosCierre * 60 * 1000;
  if (now < cutoff) return 'abierto';
  return 'cerrado';
}

function withResolvedStatus<T extends { closeTime: Date; minutosPreviosCierre: number; winnerNumber: string | null }>(draw: T): T {
  return {
    ...draw,
    status: resolveStatus(draw.closeTime, draw.minutosPreviosCierre, draw.winnerNumber),
  };
}

const rnInclude = {
  restrictedNumbers: true,
  specialMultiplier: { select: { id: true, name: true, value: true } },
};

// GET /api/draws
router.get('/', authorizeAnyResource('/draws/list', '/draws', '/sales', '/ticket-payments', '/reports/sales-stats', '/reports/balance-breakdown', '/reports/sales-by-user', '/reports/draw-lists', '/reports/commissions'), async (_req, res) => {
  const draws = await prisma.draw.findMany({ include: rnInclude, orderBy: { closeTime: 'desc' } });
  res.json(draws.map((draw) => withResolvedStatus(draw)));
});

// GET /api/draws/search
router.get('/search', authorizeAnyResource('/draws/list', '/draws', '/sales', '/ticket-payments', '/reports/sales-stats', '/reports/balance-breakdown', '/reports/sales-by-user', '/reports/draw-lists', '/reports/commissions'), async (req, res) => {
  const parsed = drawSearchQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ message: 'Parámetros inválidos para búsqueda de sorteos.' });
    return;
  }

  const { fromDate, toDate, page, pageSize } = parsed.data;

  if (fromDate && toDate && fromDate > toDate) {
    res.status(400).json({ message: 'El rango de fechas es inválido.' });
    return;
  }

  const where: {
    closeTime?: {
      gte?: Date;
      lte?: Date;
    };
  } = {};

  if (fromDate || toDate) {
    where.closeTime = {};
  }

  if (fromDate) {
    where.closeTime!.gte = new Date(`${fromDate}T00:00:00.000`);
  }

  if (toDate) {
    where.closeTime!.lte = new Date(`${toDate}T23:59:59.999`);
  }

  const total = await prisma.draw.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const skip = (currentPage - 1) * pageSize;

  const items = await prisma.draw.findMany({
    where,
    include: rnInclude,
    orderBy: { closeTime: 'desc' },
    skip,
    take: pageSize,
  });

  res.json({
    items: items.map((draw) => withResolvedStatus(draw)),
    total,
    page: currentPage,
    pageSize,
    totalPages,
  });
});

// GET /api/draws/:id
router.get('/:id', authorizeAnyResource('/draws/list', '/draws', '/sales', '/ticket-payments', '/reports/sales-stats', '/reports/balance-breakdown', '/reports/sales-by-user', '/reports/draw-lists', '/reports/commissions'), async (req, res) => {
  const id = param(req, 'id');
  const draw = await prisma.draw.findUnique({ where: { id }, include: rnInclude });
  if (!draw) { res.status(404).json({ message: 'Sorteo no encontrado.' }); return; }
  res.json(withResolvedStatus(draw));
});

// POST /api/draws
router.post('/', authorizeResource('/draws:create'), validate(drawSchema), async (req, res) => {
  const body = req.body as z.infer<typeof drawSchema>;
  const status = resolveStatus(body.closeTime, body.minutosPreviosCierre, body.winnerNumber);
  const draw = await prisma.draw.create({
    data: {
      name: body.name,
      closeTime: new Date(body.closeTime),
      minutosPreviosCierre: body.minutosPreviosCierre,
      winnerNumber: body.winnerNumber ?? null,
      status,
      specialMultiplierId: body.specialMultiplierId ?? null,
    },
    include: rnInclude,
  });
  res.status(201).json(draw);
});

// PATCH /api/draws/:id
router.patch('/:id', authorizeResource('/draws:update'), validate(drawSchema.partial()), async (req, res) => {
  const id = param(req, 'id');
  const body = req.body as Partial<z.infer<typeof drawSchema>>;
  const existing = await prisma.draw.findUnique({ where: { id } });
  if (!existing) { res.status(404).json({ message: 'Sorteo no encontrado.' }); return; }
  const closeTime = body.closeTime ?? existing.closeTime.toISOString();
  const minutosPreviosCierre = body.minutosPreviosCierre ?? existing.minutosPreviosCierre;
  const winnerNumber = body.winnerNumber !== undefined ? body.winnerNumber : existing.winnerNumber;
  const draw = await prisma.draw.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.closeTime !== undefined && { closeTime: new Date(body.closeTime) }),
      ...(body.minutosPreviosCierre !== undefined && { minutosPreviosCierre: body.minutosPreviosCierre }),
      ...(body.winnerNumber !== undefined && { winnerNumber: body.winnerNumber }),
      ...(body.specialMultiplierId !== undefined && { specialMultiplierId: body.specialMultiplierId }),
      status: resolveStatus(closeTime, minutosPreviosCierre, winnerNumber),
    },
    include: rnInclude,
  });
  res.json(draw);
});

// DELETE /api/draws/:id
router.delete('/:id', authorizeResource('/draws:delete'), async (req, res) => {
  const id = param(req, 'id');
  await prisma.draw.delete({ where: { id } });
  res.status(204).send();
});

// POST /api/draws/:id/restricted-numbers
router.post('/:id/restricted-numbers', authorizeResource('/draws:restricted-numbers'), validate(rnSchema), async (req, res) => {
  const drawId = param(req, 'id');
  const body = req.body as z.infer<typeof rnSchema>;
  const rn = await prisma.restrictedNumber.upsert({
    where: { drawId_number: { drawId, number: body.number } },
    update: { limit: body.limit },
    create: { drawId, number: body.number, limit: body.limit },
  });
  res.status(201).json(rn);
});

// DELETE /api/draws/:id/restricted-numbers/:number
router.delete('/:id/restricted-numbers/:number', authorizeResource('/draws:restricted-numbers'), async (req, res) => {
  const drawId = param(req, 'id');
  const number = param(req, 'number');
  await prisma.restrictedNumber.delete({
    where: { drawId_number: { drawId, number } },
  });
  res.status(204).send();
});

export default router;
