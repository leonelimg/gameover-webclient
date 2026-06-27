import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma.js';
import { authenticate, authorizeAnyResource, authorizeResource } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { param } from '../middleware/params.js';

const USER_ROLES = ['admin', 'asociado', 'vendedor'] as const;
const USER_STATUSES = ['activo', 'bloqueado', 'archivado'] as const;

const router = Router();
router.use(authenticate);

const createUserSchema = z.object({
  fullName: z.string().min(2),
  username: z.string().min(3).max(30),
  email: z.string().email(),
  phone: z.string().optional(),
  role: z.enum(USER_ROLES),
  password: z.string().min(6),
  planId: z.string().optional(),
  parentId: z.string().optional(),
});

const updateUserSchema = z.object({
  fullName: z.string().min(2).optional(),
  username: z.string().min(3).max(30).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  role: z.enum(USER_ROLES).optional(),
  planId: z.string().nullable().optional(),
  parentId: z.string().nullable().optional(),
});

const changePasswordSchema = z.object({
  password: z.string().min(6),
});

const changeStatusSchema = z.object({
  status: z.enum(USER_STATUSES),
});

const safeSelect = {
  id: true, fullName: true, username: true, email: true,
  phone: true, role: true, status: true, planId: true,
  parentId: true, createdAt: true, updatedAt: true,
};

// GET /api/users
router.get('/', authorizeAnyResource('/users', '/plans', '/reports/balance-breakdown', '/reports/draw-lists', '/reports/sales-by-user', '/reports/commissions'), async (req, res) => {
  const { role, status, search } = req.query as Record<string, string>;
  const where: Record<string, unknown> = {};
  if (role) where['role'] = role;
  if (status) where['status'] = status;

  if (req.user!.role !== 'admin') {
    // Non-admin roles (e.g. asociado) can only query themselves and their descendants recursively.
    const allUserRelations = await prisma.user.findMany({
      select: { id: true, parentId: true }
    });
    const allowedIds = new Set<string>([req.user!.sub]);
    const walk = (parentId: string) => {
      for (const u of allUserRelations) {
        if (u.parentId === parentId && !allowedIds.has(u.id)) {
          allowedIds.add(u.id);
          walk(u.id);
        }
      }
    };
    walk(req.user!.sub);

    where['id'] = { in: Array.from(allowedIds) };
  }

  if (search) {
    where['OR'] = [
      { fullName: { contains: search, mode: 'insensitive' } },
      { username: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }
  const users = await prisma.user.findMany({ where, select: safeSelect, orderBy: { createdAt: 'desc' } });
  res.json(users);
});

// GET /api/users/:id
router.get('/:id', authorizeResource('/users'), async (req, res) => {
  const id = param(req, 'id');
  const user = await prisma.user.findUnique({ where: { id }, select: safeSelect });
  if (!user) { res.status(404).json({ message: 'Usuario no encontrado.' }); return; }
  res.json(user);
});

// POST /api/users
router.post('/', authorizeResource('/users:create'), validate(createUserSchema), async (req, res) => {
  const body = req.body as z.infer<typeof createUserSchema>;
  if (req.user!.role === 'asociado' && body.role === 'admin') {
    res.status(403).json({ message: 'Los asociados no pueden crear administradores.' });
    return;
  }
  const passwordHash = await bcrypt.hash(body.password, 12);
  const user = await prisma.user.create({
    data: {
      fullName: body.fullName,
      username: body.username,
      email: body.email,
      phone: body.phone,
      role: body.role,
      passwordHash,
      planId: body.planId ?? null,
      parentId: body.parentId ?? null,
    },
    select: safeSelect,
  });
  await prisma.auditLog.create({
    data: { action: 'CREATE_USER', entity: 'User', entityId: user.id, userId: req.user!.sub },
  });
  res.status(201).json(user);
});

// PATCH /api/users/:id
router.patch('/:id', authorizeResource('/users:update'), validate(updateUserSchema), async (req, res) => {
  const id = param(req, 'id');
  const body = req.body as z.infer<typeof updateUserSchema>;
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) { res.status(404).json({ message: 'Usuario no encontrado.' }); return; }
  if (req.user!.role !== 'admin' && (existing.role === 'admin' || body.role === 'admin')) {
    res.status(403).json({ message: 'Solo un administrador puede modificar usuarios administradores.' });
    return;
  }
  if (body.username && body.username !== existing.username) {
    const duplicate = await prisma.user.findUnique({ where: { username: body.username } });
    if (duplicate) {
      res.status(400).json({ message: 'El nombre de usuario ya está en uso.' });
      return;
    }
  }
  if (body.email && body.email !== existing.email) {
    const duplicate = await prisma.user.findUnique({ where: { email: body.email } });
    if (duplicate) {
      res.status(400).json({ message: 'El correo electrónico ya está en uso.' });
      return;
    }
  }
  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(body.fullName !== undefined && { fullName: body.fullName }),
      ...(body.username !== undefined && { username: body.username }),
      ...(body.email !== undefined && { email: body.email }),
      ...(body.phone !== undefined && { phone: body.phone }),
      ...(body.role !== undefined && { role: body.role }),
      ...(body.planId !== undefined && { planId: body.planId }),
      ...(body.parentId !== undefined && { parentId: body.parentId }),
    },
    select: safeSelect,
  });
  await prisma.auditLog.create({
    data: { action: 'UPDATE_USER', entity: 'User', entityId: user.id, userId: req.user!.sub, details: body },
  });
  res.json(user);
});

// PATCH /api/users/:id/password
router.patch('/:id/password', authorizeResource('/users:password'), validate(changePasswordSchema), async (req, res) => {
  const id = param(req, 'id');
  const { password } = req.body as z.infer<typeof changePasswordSchema>;
  const existing = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  if (!existing) { res.status(404).json({ message: 'Usuario no encontrado.' }); return; }
  if (req.user!.role !== 'admin' && existing.role === 'admin') {
    res.status(403).json({ message: 'Solo un administrador puede cambiar la contrasena de otro administrador.' });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.update({ where: { id }, data: { passwordHash } });
  await prisma.auditLog.create({
    data: { action: 'CHANGE_PASSWORD', entity: 'User', entityId: id, userId: req.user!.sub },
  });
  res.json({ message: 'Contraseña actualizada.' });
});

// PATCH /api/users/:id/status
router.patch('/:id/status', authorizeResource('/users:status'), validate(changeStatusSchema), async (req, res) => {
  const id = param(req, 'id');
  const { status } = req.body as z.infer<typeof changeStatusSchema>;
  if (id === req.user!.sub) {
    res.status(400).json({ message: 'No puedes cambiar tu propio estado.' });
    return;
  }
  const existing = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  if (!existing) { res.status(404).json({ message: 'Usuario no encontrado.' }); return; }
  if (req.user!.role !== 'admin' && existing.role === 'admin') {
    res.status(403).json({ message: 'Solo un administrador puede cambiar el estado de otro administrador.' });
    return;
  }
  const user = await prisma.user.update({ where: { id }, data: { status }, select: safeSelect });
  await prisma.auditLog.create({
    data: { action: 'CHANGE_STATUS', entity: 'User', entityId: user.id, userId: req.user!.sub, details: { status } },
  });
  res.json(user);
});

export default router;
