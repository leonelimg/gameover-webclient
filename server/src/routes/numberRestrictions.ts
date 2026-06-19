import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import {
  deleteGlobalNumberRestriction,
  getAllUserRestrictionLimits,
  getGlobalNumberLimit,
  getGlobalNumberRestrictionByNumber,
  getUserDrawSaleLimit,
  getUserGlobalNumberLimit,
  GLOBAL_NUMBER_LIMIT_SETTING_KEY,
  listGlobalNumberRestrictions,
  setGlobalNumberLimit,
  setUserDrawSaleLimit,
  setUserGlobalNumberLimit,
  upsertGlobalNumberRestriction,
} from '../config/numberRestrictions.js';
import { authenticate, authorizeAnyResource, authorizeResource } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { param } from '../middleware/params.js';

const router = Router();
router.use(authenticate);

const globalNumberLimitSchema = z.object({
  globalLimit: z.number().positive().nullable(),
});

const userLimitSchema = z.object({
  limit: z.number().positive().nullable(),
});

const globalNumberRestrictionItemSchema = z.object({
  number: z.string().regex(/^\d{2}$/, 'El número debe tener exactamente 2 dígitos.'),
  limit: z.number().positive(),
});

const globalNumberRestrictionUpdateSchema = z.object({
  limit: z.number().positive(),
});

router.get('/global', authorizeAnyResource('/number-restrictions', '/restrictions/global', '/sales', '/draws/list'), async (_req, res) => {
  const globalLimit = await getGlobalNumberLimit();
  res.json({ globalLimit });
});

router.get('/me-limits', authorizeAnyResource('/sales', '/restrictions/user-global', '/restrictions/user-sales-limit'), async (req, res) => {
  const [userGlobalLimit, userDrawSaleLimit] = await Promise.all([
    getUserGlobalNumberLimit(req.user!.sub),
    getUserDrawSaleLimit(req.user!.sub),
  ]);

  res.json({
    userGlobalLimit,
    userDrawSaleLimit,
  });
});

router.patch('/global', authorizeAnyResource('/number-restrictions', '/restrictions:update-global'), validate(globalNumberLimitSchema), async (req, res) => {
  const body = req.body as z.infer<typeof globalNumberLimitSchema>;
  const globalLimit = await setGlobalNumberLimit(body.globalLimit);

  await prisma.auditLog.create({
    data: {
      action: 'UPDATE_GLOBAL_NUMBER_LIMIT',
      entity: 'SystemSetting',
      entityId: GLOBAL_NUMBER_LIMIT_SETTING_KEY,
      userId: req.user!.sub,
      details: { globalLimit },
    },
  });

  res.json({ globalLimit });
});

router.get('/global-numbers', authorizeAnyResource('/restrictions/global-numbers', '/restrictions/global', '/sales', '/draws/list'), async (_req, res) => {
  const items = await listGlobalNumberRestrictions();
  res.json({ items });
});

router.post(
  '/global-numbers',
  authorizeResource('/restrictions:update-global-numbers'),
  validate(globalNumberRestrictionItemSchema),
  async (req, res) => {
    const body = req.body as z.infer<typeof globalNumberRestrictionItemSchema>;
    const item = await upsertGlobalNumberRestriction(body.number, body.limit);

    await prisma.auditLog.create({
      data: {
        action: 'UPSERT_GLOBAL_NUMBER_RESTRICTION',
        entity: 'GlobalNumberRestriction',
        entityId: item.number,
        userId: req.user!.sub,
        details: item,
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
    if (!/^\d{2}$/.test(number)) {
      res.status(400).json({ message: 'El número debe tener exactamente 2 dígitos.' });
      return;
    }

    const body = req.body as z.infer<typeof globalNumberRestrictionUpdateSchema>;
    const item = await upsertGlobalNumberRestriction(number, body.limit);

    await prisma.auditLog.create({
      data: {
        action: 'UPDATE_GLOBAL_NUMBER_RESTRICTION',
        entity: 'GlobalNumberRestriction',
        entityId: item.number,
        userId: req.user!.sub,
        details: item,
      },
    });

    res.json(item);
  }
);

router.delete('/global-numbers/:number', authorizeResource('/restrictions:update-global-numbers'), async (req, res) => {
  const number = param(req, 'number');
  if (!/^\d{2}$/.test(number)) {
    res.status(400).json({ message: 'El número debe tener exactamente 2 dígitos.' });
    return;
  }

  const existing = await getGlobalNumberRestrictionByNumber(number);
  if (!existing) {
    res.status(404).json({ message: 'La restricción no existe.' });
    return;
  }

  await deleteGlobalNumberRestriction(number);

  await prisma.auditLog.create({
    data: {
      action: 'DELETE_GLOBAL_NUMBER_RESTRICTION',
      entity: 'GlobalNumberRestriction',
      entityId: number,
      userId: req.user!.sub,
      details: existing,
    },
  });

  res.status(204).send();
});

router.get('/users-limits', authorizeAnyResource('/restrictions/user-global', '/restrictions/user-sales-limit'), async (req, res) => {
  const search = String(req.query['search'] ?? '').trim();

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

  const limitsByUser = await getAllUserRestrictionLimits();

  const items = users.map((user) => {
    const limit = limitsByUser.get(user.id) ?? {
      userGlobalLimit: null,
      userDrawSaleLimit: null,
    };

    return {
      ...user,
      userGlobalLimit: limit.userGlobalLimit,
      userDrawSaleLimit: limit.userDrawSaleLimit,
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

    const userGlobalLimit = await setUserGlobalNumberLimit(userId, body.limit);
    const userDrawSaleLimit = await getUserDrawSaleLimit(userId);

    await prisma.auditLog.create({
      data: {
        action: 'UPDATE_USER_GLOBAL_NUMBER_LIMIT',
        entity: 'UserRestrictionLimit',
        entityId: userId,
        userId: req.user!.sub,
        details: {
          targetUserId: user.id,
          targetUsername: user.username,
          userGlobalLimit,
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

    const userDrawSaleLimit = await setUserDrawSaleLimit(userId, body.limit);
    const userGlobalLimit = await getUserGlobalNumberLimit(userId);

    await prisma.auditLog.create({
      data: {
        action: 'UPDATE_USER_DRAW_SALE_LIMIT',
        entity: 'UserRestrictionLimit',
        entityId: userId,
        userId: req.user!.sub,
        details: {
          targetUserId: user.id,
          targetUsername: user.username,
          userDrawSaleLimit,
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

export default router;