import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import {
  APP_RESOURCES,
  APP_RESOURCE_KEYS,
  getDefaultPermissionsRow,
  isDefaultAllowed,
  type AppRole,
} from '../config/permissions.js';
import { authenticate, authorizeResource } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

type RolePermission = {
  resourceKey: string;
  role: AppRole;
  allowed: boolean;
};

const updatePermissionsSchema = z.object({
  permissions: z.array(
    z.object({
      resourceKey: z.string(),
      asociado: z.boolean(),
      vendedor: z.boolean(),
    })
  ).min(1),
});

async function ensurePermissionsSeeded(): Promise<void> {
  await prisma.$transaction(
    APP_RESOURCES.flatMap((resource) =>
      (['admin', 'asociado', 'vendedor'] as const).map((role) =>
        prisma.rolePermission.upsert({
          where: {
            resourceKey_role: {
              resourceKey: resource.key,
              role,
            },
          },
          create: {
            resourceKey: resource.key,
            role,
            allowed: isDefaultAllowed(resource.key, role),
          },
          update: {},
        })
      )
    )
  );
}

function matrixFromRows(rows: RolePermission[]) {
  const map = new Map<string, { admin: boolean; asociado: boolean; vendedor: boolean }>();

  for (const resource of APP_RESOURCES) {
    map.set(resource.key, getDefaultPermissionsRow(resource.key));
  }

  for (const row of rows) {
    const current = map.get(row.resourceKey);
    if (!current) continue;
    current[row.role] = row.allowed;
  }

  return APP_RESOURCES.map((resource) => {
    const row = map.get(resource.key) ?? getDefaultPermissionsRow(resource.key);
    return {
      resourceKey: resource.key,
      label: resource.label,
      admin: true,
      asociado: row.asociado,
      vendedor: row.vendedor,
    };
  });
}

// GET /api/roles/my-permissions
router.get('/my-permissions', async (req, res) => {
  const role = req.user!.role as AppRole;
  await ensurePermissionsSeeded();

  const rows = await prisma.rolePermission.findMany({
    where: { role },
    select: { resourceKey: true, allowed: true },
  });

  const rowsByResource = new Map(rows.map((row) => [row.resourceKey, row.allowed]));

  const permissions = APP_RESOURCES
    .filter((resource) => rowsByResource.get(resource.key) ?? isDefaultAllowed(resource.key, role))
    .map((resource) => resource.key);

  res.json({ permissions });
});

router.use(authorizeResource('/roles'));

// GET /api/roles/permissions
router.get('/permissions', async (_req, res) => {
  await ensurePermissionsSeeded();
  const rows = (await prisma.rolePermission.findMany({
    where: {
      resourceKey: { in: APP_RESOURCES.map((resource) => resource.key) },
      role: { in: ['admin', 'asociado', 'vendedor'] },
    },
    select: { resourceKey: true, role: true, allowed: true },
  })) as RolePermission[];

  res.json({ permissions: matrixFromRows(rows) });
});

// PATCH /api/roles/permissions
router.patch('/permissions', authorizeResource('/roles:update'), async (req, res) => {
  const parsed = updatePermissionsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Payload invalido.' });
    return;
  }

  const updates = parsed.data.permissions;
  for (const update of updates) {
    if (!APP_RESOURCE_KEYS.has(update.resourceKey)) {
      res.status(400).json({ message: `Recurso invalido: ${update.resourceKey}` });
      return;
    }
  }

  await prisma.$transaction(
    updates.flatMap((update) => [
      prisma.rolePermission.upsert({
        where: {
          resourceKey_role: {
            resourceKey: update.resourceKey,
            role: 'admin',
          },
        },
        create: {
          resourceKey: update.resourceKey,
          role: 'admin',
          allowed: true,
        },
        update: { allowed: true },
      }),
      prisma.rolePermission.upsert({
        where: {
          resourceKey_role: {
            resourceKey: update.resourceKey,
            role: 'asociado',
          },
        },
        create: {
          resourceKey: update.resourceKey,
          role: 'asociado',
          allowed: update.asociado,
        },
        update: { allowed: update.asociado },
      }),
      prisma.rolePermission.upsert({
        where: {
          resourceKey_role: {
            resourceKey: update.resourceKey,
            role: 'vendedor',
          },
        },
        create: {
          resourceKey: update.resourceKey,
          role: 'vendedor',
          allowed: update.vendedor,
        },
        update: { allowed: update.vendedor },
      }),
    ])
  );

  await prisma.auditLog.create({
    data: {
      action: 'UPDATE_ROLE_PERMISSIONS',
      entity: 'RolePermission',
      userId: req.user!.sub,
      details: { updatedCount: updates.length },
    },
  });

  const rows = (await prisma.rolePermission.findMany({
    where: {
      resourceKey: { in: APP_RESOURCES.map((resource) => resource.key) },
      role: { in: ['admin', 'asociado', 'vendedor'] },
    },
    select: { resourceKey: true, role: true, allowed: true },
  })) as RolePermission[];

  res.json({ permissions: matrixFromRows(rows) });
});

export default router;
