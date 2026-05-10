import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../config/jwt.js';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { config } from '../config/index.js';

const router = Router();

// ── Schemas ───────────────────────────────────────────────────────────────────

const loginSchema = z.object({
  username: z.string().min(1, 'Usuario requerido'),
  password: z.string().min(1, 'Contraseña requerida'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function msFromExpiry(expiry: string): number {
  const unit = expiry.slice(-1);
  const val = parseInt(expiry.slice(0, -1), 10);
  const map: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return val * (map[unit] ?? 60_000);
}

// ── POST /api/auth/login ──────────────────────────────────────────────────────

router.post('/login', validate(loginSchema), async (req, res) => {
  const { username, password } = req.body as z.infer<typeof loginSchema>;

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || user.status !== 'activo') {
    res.status(401).json({ message: 'Usuario o contraseña incorrectos.' });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ message: 'Usuario o contraseña incorrectos.' });
    return;
  }

  const accessToken = signAccessToken({
    sub: user.id,
    username: user.username,
    role: user.role,
  });

  const tokenId = crypto.randomUUID();
  const refreshToken = signRefreshToken({ sub: user.id, tokenId });

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
      tokenId,
      expiresAt: new Date(Date.now() + msFromExpiry(config.jwtRefreshExpiry)),
    },
  });

  // Remove passwordHash from response
  const { passwordHash: _pw, ...safeUser } = user;
  res.json({ accessToken, refreshToken, user: safeUser });
});

// ── POST /api/auth/refresh ────────────────────────────────────────────────────

router.post('/refresh', validate(refreshSchema), async (req, res) => {
  const { refreshToken } = req.body as z.infer<typeof refreshSchema>;

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    res.status(401).json({ message: 'Refresh token inválido o expirado.' });
    return;
  }

  const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
  if (!stored || stored.expiresAt < new Date()) {
    res.status(401).json({ message: 'Refresh token revocado o expirado.' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || user.status !== 'activo') {
    res.status(401).json({ message: 'Usuario inactivo.' });
    return;
  }

  // Rotate: delete old token, issue new pair
  await prisma.refreshToken.delete({ where: { token: refreshToken } });

  const newAccessToken = signAccessToken({
    sub: user.id,
    username: user.username,
    role: user.role,
  });

  const newTokenId = crypto.randomUUID();
  const newRefreshToken = signRefreshToken({ sub: user.id, tokenId: newTokenId });

  await prisma.refreshToken.create({
    data: {
      token: newRefreshToken,
      userId: user.id,
      tokenId: newTokenId,
      expiresAt: new Date(Date.now() + msFromExpiry(config.jwtRefreshExpiry)),
    },
  });

  res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────────

router.post('/logout', authenticate, async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.slice(7);
  if (token) {
    // Revoke all refresh tokens for this user on logout
    await prisma.refreshToken.deleteMany({ where: { userId: req.user!.sub } });
  }
  res.json({ message: 'Sesión cerrada.' });
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────

router.get('/me', authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.sub },
    select: {
      id: true, fullName: true, username: true, email: true,
      phone: true, role: true, status: true, planId: true,
      parentId: true, createdAt: true, updatedAt: true,
    },
  });
  if (!user) {
    res.status(404).json({ message: 'Usuario no encontrado.' });
    return;
  }
  res.json(user);
});

export default router;
