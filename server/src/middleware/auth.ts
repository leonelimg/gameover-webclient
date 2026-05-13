import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, AccessTokenPayload } from '../config/jwt.js';
import { prisma } from '../config/prisma.js';
import { APP_RESOURCE_KEYS, isDefaultAllowed, type AppRole } from '../config/permissions.js';

// Augment Express Request with authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Token requerido.' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    res.status(401).json({ message: 'Token inválido o expirado.' });
  }
}

type RoleParam = 'admin' | 'asociado' | 'vendedor';

export function authorize(...roles: RoleParam[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: 'No autenticado.' });
      return;
    }
    if (!roles.includes(req.user.role as RoleParam)) {
      res.status(403).json({ message: 'No tienes permisos para esta acción.' });
      return;
    }
    next();
  };
}

export function authorizeResource(resourceKey: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ message: 'No autenticado.' });
      return;
    }

    if (!APP_RESOURCE_KEYS.has(resourceKey)) {
      res.status(500).json({ message: `Recurso no configurado: ${resourceKey}` });
      return;
    }

    const role = req.user.role as AppRole;
    const permission = await prisma.rolePermission.findUnique({
      where: {
        resourceKey_role: {
          resourceKey,
          role,
        },
      },
      select: { allowed: true },
    });

    const allowed = permission ? permission.allowed : isDefaultAllowed(resourceKey, role);
    if (!allowed) {
      res.status(403).json({ message: 'No tienes permisos para esta ruta.' });
      return;
    }

    next();
  };
}
