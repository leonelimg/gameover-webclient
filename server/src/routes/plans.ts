import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { param } from '../middleware/params.js';

const router = Router();
router.use(authenticate);

const planSchema = z.object({
  name: z.string().min(2),
  multiplier: z.number().positive(),
  commission: z.number().min(0).max(100),
  masterId: z.string().optional().nullable(),
});

const masterInclude = { master: { select: { id: true, fullName: true } } };

// GET /api/plans
router.get('/', async (_req, res) => {
  const plans = await prisma.plan.findMany({ include: masterInclude, orderBy: { createdAt: 'desc' } });
  res.json(plans);
});

// GET /api/plans/:id
router.get('/:id', async (req, res) => {
  const id = param(req, 'id');
  const plan = await prisma.plan.findUnique({ where: { id }, include: masterInclude });
  if (!plan) { res.status(404).json({ message: 'Plan no encontrado.' }); return; }
  res.json(plan);
});

// POST /api/plans
router.post('/', authorize('admin'), validate(planSchema), async (req, res) => {
  const body = req.body as z.infer<typeof planSchema>;
  const plan = await prisma.plan.create({
    data: {
      name: body.name,
      multiplier: body.multiplier,
      commission: body.commission,
      masterId: body.masterId ?? null,
    },
    include: masterInclude,
  });
  res.status(201).json(plan);
});

// PATCH /api/plans/:id
router.patch('/:id', authorize('admin'), validate(planSchema.partial()), async (req, res) => {
  const id = param(req, 'id');
  const body = req.body as Partial<z.infer<typeof planSchema>>;
  const plan = await prisma.plan.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.multiplier !== undefined && { multiplier: body.multiplier }),
      ...(body.commission !== undefined && { commission: body.commission }),
      ...(body.masterId !== undefined && { masterId: body.masterId }),
    },
    include: masterInclude,
  });
  res.json(plan);
});

// DELETE /api/plans/:id
router.delete('/:id', authorize('admin'), async (req, res) => {
  const id = param(req, 'id');
  await prisma.plan.delete({ where: { id } });
  res.status(204).send();
});

export default router;
