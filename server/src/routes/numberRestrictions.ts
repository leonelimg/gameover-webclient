import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { getGlobalNumberLimit, GLOBAL_NUMBER_LIMIT_SETTING_KEY, setGlobalNumberLimit } from '../config/numberRestrictions.js';
import { authenticate, authorizeAnyResource, authorizeResource } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();
router.use(authenticate);

const globalNumberLimitSchema = z.object({
  globalLimit: z.number().positive().nullable(),
});

router.get('/global', authorizeAnyResource('/number-restrictions', '/sales', '/draws/list'), async (_req, res) => {
  const globalLimit = await getGlobalNumberLimit();
  res.json({ globalLimit });
});

router.patch('/global', authorizeResource('/number-restrictions'), validate(globalNumberLimitSchema), async (req, res) => {
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

export default router;