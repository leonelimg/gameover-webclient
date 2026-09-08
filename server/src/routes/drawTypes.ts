import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { authenticate, authorizeAnyResource, authorizeResource } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { param } from '../middleware/params.js';

const router = Router();
router.use(authenticate);

const drawTypeSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres.'),
  description: z.string().optional().nullable(),
  digits: z.number().int().refine((val) => [2, 3, 4].includes(val), {
    message: 'La cantidad de dígitos debe ser 2, 3 o 4.',
  }),
  multiplier: z.number().positive('El multiplicador debe ser mayor a 0.'),
  maxDrawSales: z.number().positive('El límite de venta debe ser positivo.').optional().nullable(),
  globalNumberLimit: z.number().positive('El límite global por número debe ser positivo.').optional().nullable(),
});

const restrictedNumberSchema = z.object({
  number: z.string().min(1, 'El número es requerido.'),
  limit: z.number().positive('El límite debe ser mayor a 0.'),
});

// GET /api/draw-types
router.get(
  '/',
  authorizeAnyResource(
    '/draws',
    '/draws/list',
    '/sales',
    '/ticket-payments',
    '/restrictions',
    '/restrictions/global',
    '/restrictions/global-numbers',
    '/restrictions/user-global',
    '/restrictions/user-sales-limit'
  ),
  async (_req, res) => {
    const drawTypes = await prisma.drawType.findMany({
      include: {
        restrictedNumbers: { orderBy: { number: 'asc' } },
        _count: { select: { draws: true } },
      },
      orderBy: { name: 'asc' },
    });
    res.json(drawTypes);
  }
);

// GET /api/draw-types/:id
router.get(
  '/:id',
  authorizeAnyResource(
    '/draws',
    '/sales',
    '/ticket-payments',
    '/restrictions'
  ),
  async (req, res) => {
    const id = param(req, 'id');
    const drawType = await prisma.drawType.findUnique({
      where: { id },
      include: {
        restrictedNumbers: { orderBy: { number: 'asc' } },
        _count: { select: { draws: true } },
      },
    });

    if (!drawType) {
      res.status(404).json({ message: 'Tipo de sorteo no encontrado.' });
      return;
    }

    res.json(drawType);
  }
);

// POST /api/draw-types
router.post(
  '/',
  authorizeResource('/draws:create'),
  validate(drawTypeSchema),
  async (req, res) => {
    const body = req.body as z.infer<typeof drawTypeSchema>;

    const existing = await prisma.drawType.findUnique({
      where: { name: body.name.trim() },
    });

    if (existing) {
      res.status(400).json({ message: `Ya existe un tipo de sorteo con el nombre "${body.name}".` });
      return;
    }

    const drawType = await prisma.drawType.create({
      data: {
        name: body.name.trim(),
        description: body.description?.trim() || null,
        digits: body.digits,
        multiplier: body.multiplier,
        maxDrawSales: body.maxDrawSales ?? null,
        globalNumberLimit: body.globalNumberLimit ?? null,
      },
      include: {
        restrictedNumbers: true,
        _count: { select: { draws: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        action: 'CREATE_DRAW_TYPE',
        entity: 'DrawType',
        entityId: drawType.id,
        userId: req.user!.sub,
        details: drawType,
      },
    });

    res.status(201).json(drawType);
  }
);

// PATCH /api/draw-types/:id
router.patch(
  '/:id',
  authorizeResource('/draws:update'),
  validate(drawTypeSchema.partial()),
  async (req, res) => {
    const id = param(req, 'id');
    const body = req.body as Partial<z.infer<typeof drawTypeSchema>>;

    const existing = await prisma.drawType.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ message: 'Tipo de sorteo no encontrado.' });
      return;
    }

    if (body.name && body.name.trim() !== existing.name) {
      const nameConflict = await prisma.drawType.findUnique({
        where: { name: body.name.trim() },
      });
      if (nameConflict) {
        res.status(400).json({ message: `Ya existe un tipo de sorteo con el nombre "${body.name}".` });
        return;
      }
    }

    const updated = await prisma.drawType.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name.trim() }),
        ...(body.description !== undefined && { description: body.description?.trim() || null }),
        ...(body.digits !== undefined && { digits: body.digits }),
        ...(body.multiplier !== undefined && { multiplier: body.multiplier }),
        ...(body.maxDrawSales !== undefined && { maxDrawSales: body.maxDrawSales }),
        ...(body.globalNumberLimit !== undefined && { globalNumberLimit: body.globalNumberLimit }),
      },
      include: {
        restrictedNumbers: { orderBy: { number: 'asc' } },
        _count: { select: { draws: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        action: 'UPDATE_DRAW_TYPE',
        entity: 'DrawType',
        entityId: updated.id,
        userId: req.user!.sub,
        details: updated,
      },
    });

    res.json(updated);
  }
);

// DELETE /api/draw-types/:id
router.delete(
  '/:id',
  authorizeResource('/draws:delete'),
  async (req, res) => {
    const id = param(req, 'id');

    const existing = await prisma.drawType.findUnique({
      where: { id },
      include: { _count: { select: { draws: true } } },
    });

    if (!existing) {
      res.status(404).json({ message: 'Tipo de sorteo no encontrado.' });
      return;
    }

    if (existing._count.draws > 0) {
      res.status(400).json({
        message: `No se puede eliminar el tipo de sorteo "${existing.name}" porque tiene ${existing._count.draws} sorteos asociados.`,
      });
      return;
    }

    await prisma.drawType.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        action: 'DELETE_DRAW_TYPE',
        entity: 'DrawType',
        entityId: id,
        userId: req.user!.sub,
        details: existing,
      },
    });

    res.json({ message: 'Tipo de sorteo eliminado correctamente.' });
  }
);

// POST /api/draw-types/:id/restricted-numbers
router.post(
  '/:id/restricted-numbers',
  authorizeResource('/draws:restricted-numbers'),
  validate(restrictedNumberSchema),
  async (req, res) => {
    const id = param(req, 'id');
    const { number, limit } = req.body as z.infer<typeof restrictedNumberSchema>;

    const drawType = await prisma.drawType.findUnique({ where: { id } });
    if (!drawType) {
      res.status(404).json({ message: 'Tipo de sorteo no encontrado.' });
      return;
    }

    const cleanNum = number.trim();

    // Validate digits length
    if (cleanNum.length !== drawType.digits || !/^\d+$/.test(cleanNum)) {
      res.status(400).json({
        message: `El número debe ser numérico y tener exactamente ${drawType.digits} dígitos para el tipo de sorteo "${drawType.name}".`,
      });
      return;
    }

    const item = await prisma.drawTypeRestrictedNumber.upsert({
      where: {
        drawTypeId_number: {
          drawTypeId: id,
          number: cleanNum,
        },
      },
      create: {
        drawTypeId: id,
        number: cleanNum,
        limit,
      },
      update: {
        limit,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: 'UPSERT_DRAW_TYPE_RESTRICTED_NUMBER',
        entity: 'DrawTypeRestrictedNumber',
        entityId: item.id,
        userId: req.user!.sub,
        details: item,
      },
    });

    res.json(item);
  }
);

// DELETE /api/draw-types/:id/restricted-numbers/:number
router.delete(
  '/:id/restricted-numbers/:number',
  authorizeResource('/draws:restricted-numbers'),
  async (req, res) => {
    const id = param(req, 'id');
    const number = param(req, 'number');

    const existing = await prisma.drawTypeRestrictedNumber.findUnique({
      where: {
        drawTypeId_number: {
          drawTypeId: id,
          number,
        },
      },
    });

    if (!existing) {
      res.status(404).json({ message: 'Número restringido no encontrado.' });
      return;
    }

    await prisma.drawTypeRestrictedNumber.delete({
      where: { id: existing.id },
    });

    await prisma.auditLog.create({
      data: {
        action: 'DELETE_DRAW_TYPE_RESTRICTED_NUMBER',
        entity: 'DrawTypeRestrictedNumber',
        entityId: existing.id,
        userId: req.user!.sub,
        details: existing,
      },
    });

    res.json({ message: 'Número restringido eliminado del tipo de sorteo.' });
  }
);

export default router;
