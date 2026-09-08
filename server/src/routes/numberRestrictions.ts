import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import {
  deleteGlobalNumberRestriction,
  getAllUserRestrictionLimits,
  getGlobalLimitsConfig,
  getGlobalNumberRestrictionByNumber,
  getUserDrawSaleLimit,
  getUserGlobalNumberLimit,
  getUserRestrictedNumbersLimit,
  GLOBAL_NUMBER_LIMIT_SETTING_KEY,
  listGlobalNumberRestrictions,
  setGlobalLimitsConfig,
  setUserDrawSaleLimit,
  setUserGlobalNumberLimit,
  setUserRestrictedNumbersLimit,
  upsertGlobalNumberRestriction,
} from '../config/numberRestrictions.js';
import { authenticate, authorizeAnyResource, authorizeResource } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { param } from '../middleware/params.js';

const router = Router();
router.use(authenticate);

const globalNumberLimitSchema = z.object({
  globalLimit: z.number().positive().nullable(),
  maxDrawSales: z.number().positive().nullable().optional(),
  drawTypeId: z.string().optional(),
});

const userLimitSchema = z.object({
  limit: z.number().positive().nullable(),
  drawTypeId: z.string().optional(),
});

const globalNumberRestrictionItemSchema = z.object({
  number: z.string().min(1, 'El número es requerido.'),
  limit: z.number().positive('El límite debe ser mayor a 0.'),
  drawTypeId: z.string().optional(),
});

const globalNumberRestrictionUpdateSchema = z.object({
  limit: z.number().positive('El límite debe ser mayor a 0.'),
  drawTypeId: z.string().optional(),
});

router.get('/global', authorizeAnyResource('/number-restrictions', '/restrictions/global', '/sales', '/draws/list'), async (req, res) => {
  const drawTypeId = typeof req.query.drawTypeId === 'string' ? req.query.drawTypeId : undefined;
  const config = await getGlobalLimitsConfig(drawTypeId);
  res.json(config);
});

router.get('/me-limits', authorizeAnyResource('/sales', '/restrictions/user-global', '/restrictions/user-sales-limit'), async (req, res) => {
  const drawTypeId = typeof req.query.drawTypeId === 'string' ? req.query.drawTypeId : undefined;
  const [userGlobalLimit, userDrawSaleLimit, userRestrictedNumbersLimit] = await Promise.all([
    getUserGlobalNumberLimit(req.user!.sub, drawTypeId),
    getUserDrawSaleLimit(req.user!.sub, drawTypeId),
    getUserRestrictedNumbersLimit(req.user!.sub, drawTypeId),
  ]);

  res.json({
    userGlobalLimit,
    userDrawSaleLimit,
    userRestrictedNumbersLimit,
  });
});

router.patch('/global', authorizeAnyResource('/number-restrictions', '/restrictions:update-global'), validate(globalNumberLimitSchema), async (req, res) => {
  const body = req.body as z.infer<typeof globalNumberLimitSchema>;
  const config = await setGlobalLimitsConfig(body.globalLimit, body.maxDrawSales, body.drawTypeId);

  await prisma.auditLog.create({
    data: {
      action: 'UPDATE_GLOBAL_LIMITS_CONFIG',
      entity: body.drawTypeId ? 'DrawType' : 'SystemSetting',
      entityId: body.drawTypeId ? `drawType:${body.drawTypeId}` : GLOBAL_NUMBER_LIMIT_SETTING_KEY,
      userId: req.user!.sub,
      details: { ...config, drawTypeId: body.drawTypeId },
    },
  });

  res.json(config);
});

router.get('/global-numbers', authorizeAnyResource('/restrictions/global-numbers', '/restrictions/global', '/sales', '/draws/list'), async (req, res) => {
  const drawTypeId = typeof req.query.drawTypeId === 'string' ? req.query.drawTypeId : undefined;
  const items = await listGlobalNumberRestrictions(drawTypeId);
  res.json({ items });
});

router.post(
  '/global-numbers',
  authorizeResource('/restrictions:update-global-numbers'),
  validate(globalNumberRestrictionItemSchema),
  async (req, res) => {
    const body = req.body as z.infer<typeof globalNumberRestrictionItemSchema>;

    if (body.drawTypeId) {
      const drawType = await prisma.drawType.findUnique({ where: { id: body.drawTypeId } });
      if (drawType && (body.number.length !== drawType.digits || !/^\d+$/.test(body.number))) {
        res.status(400).json({ message: `El número debe tener exactamente ${drawType.digits} dígitos para este tipo de sorteo.` });
        return;
      }
    }

    const item = await upsertGlobalNumberRestriction(body.number, body.limit, body.drawTypeId);

    await prisma.auditLog.create({
      data: {
        action: 'UPSERT_GLOBAL_NUMBER_RESTRICTION',
        entity: body.drawTypeId ? 'DrawTypeRestrictedNumber' : 'GlobalNumberRestriction',
        entityId: item.number,
        userId: req.user!.sub,
        details: { ...item, drawTypeId: body.drawTypeId },
      },
    });

    res.status(201).json(item);
  }
);

router.patch(
  '/global-numbers/:number',
  authorizeResource('/restrictions:update-global-numbers'),
  validate(globalNumberRestrictionUpdateSchema),
  async (req, res) => {
    const number = param(req, 'number');
    const body = req.body as z.infer<typeof globalNumberRestrictionUpdateSchema>;

    const item = await upsertGlobalNumberRestriction(number, body.limit, body.drawTypeId);

    await prisma.auditLog.create({
      data: {
        action: 'UPDATE_GLOBAL_NUMBER_RESTRICTION',
        entity: body.drawTypeId ? 'DrawTypeRestrictedNumber' : 'GlobalNumberRestriction',
        entityId: item.number,
        userId: req.user!.sub,
        details: { ...item, drawTypeId: body.drawTypeId },
      },
    });

    res.json(item);
  }
);

router.delete('/global-numbers/:number', authorizeResource('/restrictions:update-global-numbers'), async (req, res) => {
  const number = param(req, 'number');
  const drawTypeId = typeof req.query.drawTypeId === 'string' ? req.query.drawTypeId : undefined;

  const existing = await getGlobalNumberRestrictionByNumber(number, drawTypeId);
  if (!existing) {
    res.status(404).json({ message: 'La restricción no existe.' });
    return;
  }

  await deleteGlobalNumberRestriction(number, drawTypeId);

  await prisma.auditLog.create({
    data: {
      action: 'DELETE_GLOBAL_NUMBER_RESTRICTION',
      entity: drawTypeId ? 'DrawTypeRestrictedNumber' : 'GlobalNumberRestriction',
      entityId: number,
      userId: req.user!.sub,
      details: { ...existing, drawTypeId },
    },
  });

  res.status(204).send();
});

router.get('/users-limits', authorizeAnyResource('/restrictions/user-global', '/restrictions/user-sales-limit'), async (req, res) => {
  const search = String(req.query['search'] ?? '').trim();
  const drawTypeId = typeof req.query.drawTypeId === 'string' ? req.query.drawTypeId : undefined;

  const users = await prisma.user.findMany({
    where: search
      ? {
          OR: [
            { fullName: { contains: search, mode: 'insensitive' } },
            { username: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        }
      : undefined,
    select: {
      id: true,
      fullName: true,
      username: true,
      role: true,
      status: true,
    },
    orderBy: [{ fullName: 'asc' }, { username: 'asc' }],
    take: 300,
  });

  const limitsByUser = await getAllUserRestrictionLimits(drawTypeId);

  const items = users.map((user) => {
    const limit = limitsByUser.get(user.id) ?? {
      userGlobalLimit: null,
      userDrawSaleLimit: null,
      userRestrictedNumbersLimit: null,
    };

    return {
      ...user,
      userGlobalLimit: limit.userGlobalLimit,
      userDrawSaleLimit: limit.userDrawSaleLimit,
      userRestrictedNumbersLimit: limit.userRestrictedNumbersLimit,
    };
  });

  res.json({ items });
});

router.patch(
  '/users/:userId/global-limit',
  authorizeResource('/restrictions:update-user-global'),
  validate(userLimitSchema),
  async (req, res) => {
    const userId = param(req, 'userId');
    const body = req.body as z.infer<typeof userLimitSchema>;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, fullName: true, username: true },
    });
    if (!user) {
      res.status(404).json({ message: 'Usuario no encontrado.' });
      return;
    }

    const userGlobalLimit = await setUserGlobalNumberLimit(userId, body.limit, body.drawTypeId);
    const userDrawSaleLimit = await getUserDrawSaleLimit(userId, body.drawTypeId);

    await prisma.auditLog.create({
      data: {
        action: 'UPDATE_USER_GLOBAL_NUMBER_LIMIT',
        entity: body.drawTypeId ? 'UserDrawTypeLimit' : 'UserRestrictionLimit',
        entityId: userId,
        userId: req.user!.sub,
        details: {
          targetUserId: user.id,
          targetUsername: user.username,
          userGlobalLimit,
          drawTypeId: body.drawTypeId,
        },
      },
    });

    res.json({
      userId: user.id,
      userGlobalLimit,
      userDrawSaleLimit,
    });
  }
);

router.patch(
  '/users/:userId/draw-sale-limit',
  authorizeResource('/restrictions:update-user-sales-limit'),
  validate(userLimitSchema),
  async (req, res) => {
    const userId = param(req, 'userId');
    const body = req.body as z.infer<typeof userLimitSchema>;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, fullName: true, username: true },
    });
    if (!user) {
      res.status(404).json({ message: 'Usuario no encontrado.' });
      return;
    }

    const userDrawSaleLimit = await setUserDrawSaleLimit(userId, body.limit, body.drawTypeId);
    const userGlobalLimit = await getUserGlobalNumberLimit(userId, body.drawTypeId);

    await prisma.auditLog.create({
      data: {
        action: 'UPDATE_USER_DRAW_SALE_LIMIT',
        entity: body.drawTypeId ? 'UserDrawTypeLimit' : 'UserRestrictionLimit',
        entityId: userId,
        userId: req.user!.sub,
        details: {
          targetUserId: user.id,
          targetUsername: user.username,
          userDrawSaleLimit,
          drawTypeId: body.drawTypeId,
        },
      },
    });

    res.json({
      userId: user.id,
      userGlobalLimit,
      userDrawSaleLimit,
    });
  }
);

router.patch(
  '/users/:userId/restricted-numbers-limit',
  authorizeResource('/restrictions:update-user-global'),
  validate(userLimitSchema),
  async (req, res) => {
    const userId = param(req, 'userId');
    const body = req.body as z.infer<typeof userLimitSchema>;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, fullName: true, username: true },
    });
    if (!user) {
      res.status(404).json({ message: 'Usuario no encontrado.' });
      return;
    }

    const userRestrictedNumbersLimit = await setUserRestrictedNumbersLimit(userId, body.limit, body.drawTypeId);
    const userGlobalLimit = await getUserGlobalNumberLimit(userId, body.drawTypeId);
    const userDrawSaleLimit = await getUserDrawSaleLimit(userId, body.drawTypeId);

    await prisma.auditLog.create({
      data: {
        action: 'UPDATE_USER_RESTRICTED_NUMBERS_LIMIT',
        entity: body.drawTypeId ? 'UserDrawTypeLimit' : 'UserRestrictionLimit',
        entityId: userId,
        userId: req.user!.sub,
        details: {
          targetUserId: user.id,
          targetUsername: user.username,
          userRestrictedNumbersLimit,
          drawTypeId: body.drawTypeId,
        },
      },
    });

    res.json({
      userId: user.id,
      userGlobalLimit,
      userDrawSaleLimit,
      userRestrictedNumbersLimit,
    });
  }
);

export default router;