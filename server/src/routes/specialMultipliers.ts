import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { param } from '../middleware/params.js';

const router = Router();
router.use(authenticate);

const specialMultiplierSchema = z.object({
  name: z.string().min(2),
  value: z.number().int().min(1).max(10),
});

// GET /api/special-multipliers
router.get('/', async (_req, res) => {
  const items = await prisma.specialMultiplier.findMany({
    orderBy: { createdAt: 'desc' },
  });
  res.json(items);
});

// GET /api/special-multipliers/:id
router.get('/:id', async (req, res) => {
  const id = param(req, 'id');
  const item = await prisma.specialMultiplier.findUnique({ where: { id } });
  if (!item) { res.status(404).json({ message: 'Multiplicador especial no encontrado.' }); return; }
  res.json(item);
});

// POST /api/special-multipliers
router.post('/', authorize('admin'), validate(specialMultiplierSchema), async (req, res) => {
  const body = req.body as z.infer<typeof specialMultiplierSchema>;
  const item = await prisma.specialMultiplier.create({
    data: { name: body.name, value: body.value },
  });
  res.status(201).json(item);
});

// PATCH /api/special-multipliers/:id
router.patch('/:id', authorize('admin'), validate(specialMultiplierSchema.partial()), async (req, res) => {
  const id = param(req, 'id');
  const body = req.body as Partial<z.infer<typeof specialMultiplierSchema>>;
  const item = await prisma.specialMultiplier.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.value !== undefined && { value: body.value }),
    },
  });
  res.json(item);
});

// DELETE /api/special-multipliers/:id
router.delete('/:id', authorize('admin'), async (req, res) => {
  const id = param(req, 'id');
  await prisma.specialMultiplier.delete({ where: { id } });
  res.status(204).send();
});

export default router;
