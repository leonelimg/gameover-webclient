import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { param } from '../middleware/params.js';

type DrawStatusValue = 'pendiente' | 'abierto' | 'cerrado' | 'finalizado';

const router = Router();
router.use(authenticate);

const drawSchema = z.object({
  name: z.string().min(2),
  openTime: z.string().datetime(),
  closeTime: z.string().datetime(),
  winnerNumber: z.string().optional().nullable(),
});

const rnSchema = z.object({
  number: z.string().min(1).max(4),
  limit: z.number().positive(),
});

function resolveStatus(openTime: string, closeTime: string, winner?: string | null): DrawStatusValue {
  if (winner) return 'finalizado';
  const now = Date.now();
  const o = new Date(openTime).getTime();
  const c = new Date(closeTime).getTime();
  if (now < o) return 'pendiente';
  if (now >= o && now <= c) return 'abierto';
  return 'cerrado';
}

const rnInclude = { restrictedNumbers: true };

// GET /api/draws
router.get('/', async (_req, res) => {
  const draws = await prisma.draw.findMany({ include: rnInclude, orderBy: { openTime: 'desc' } });
  res.json(draws);
});

// GET /api/draws/:id
router.get('/:id', async (req, res) => {
  const id = param(req, 'id');
  const draw = await prisma.draw.findUnique({ where: { id }, include: rnInclude });
  if (!draw) { res.status(404).json({ message: 'Sorteo no encontrado.' }); return; }
  res.json(draw);
});

// POST /api/draws
router.post('/', authorize('admin'), validate(drawSchema), async (req, res) => {
  const body = req.body as z.infer<typeof drawSchema>;
  const status = resolveStatus(body.openTime, body.closeTime, body.winnerNumber);
  const draw = await prisma.draw.create({
    data: {
      name: body.name,
      openTime: new Date(body.openTime),
      closeTime: new Date(body.closeTime),
      winnerNumber: body.winnerNumber ?? null,
      status,
    },
    include: rnInclude,
  });
  res.status(201).json(draw);
});

// PATCH /api/draws/:id
router.patch('/:id', authorize('admin'), validate(drawSchema.partial()), async (req, res) => {
  const id = param(req, 'id');
  const body = req.body as Partial<z.infer<typeof drawSchema>>;
  const existing = await prisma.draw.findUnique({ where: { id } });
  if (!existing) { res.status(404).json({ message: 'Sorteo no encontrado.' }); return; }
  const openTime = body.openTime ?? existing.openTime.toISOString();
  const closeTime = body.closeTime ?? existing.closeTime.toISOString();
  const winnerNumber = body.winnerNumber !== undefined ? body.winnerNumber : existing.winnerNumber;
  const draw = await prisma.draw.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.openTime !== undefined && { openTime: new Date(body.openTime) }),
      ...(body.closeTime !== undefined && { closeTime: new Date(body.closeTime) }),
      ...(body.winnerNumber !== undefined && { winnerNumber: body.winnerNumber }),
      status: resolveStatus(openTime, closeTime, winnerNumber),
    },
    include: rnInclude,
  });
  res.json(draw);
});

// DELETE /api/draws/:id
router.delete('/:id', authorize('admin'), async (req, res) => {
  const id = param(req, 'id');
  await prisma.draw.delete({ where: { id } });
  res.status(204).send();
});

// POST /api/draws/:id/restricted-numbers
router.post('/:id/restricted-numbers', authorize('admin'), validate(rnSchema), async (req, res) => {
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
router.delete('/:id/restricted-numbers/:number', authorize('admin'), async (req, res) => {
  const drawId = param(req, 'id');
  const number = param(req, 'number');
  await prisma.restrictedNumber.delete({
    where: { drawId_number: { drawId, number } },
  });
  res.status(204).send();
});

export default router;
