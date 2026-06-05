import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { authenticate, authorizeResource, isResourceAllowedForRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

type AuthUser = { sub: string; role: 'admin' | 'asociado' | 'vendedor' };

type HierarchyUser = {
  id: string;
  fullName: string;
  username: string;
  role: 'admin' | 'asociado' | 'vendedor';
  status: 'activo' | 'bloqueado' | 'archivado';
  parentId: string | null;
};

interface PrizeTicket {
  total: number;
  lines: Array<{
    number: string;
    amount: number;
    specialAmount: number | null;
  }>;
  draw: {
    winnerNumber: string | null;
    specialMultiplier: { value: number } | null;
  };
  seller: {
    plan: {
      multiplier: number;
      commission: number;
    } | null;
  };
  associate: {
    plan: {
      multiplier: number;
      commission: number;
    } | null;
  };
}

type HistoryActor = {
  id: string;
  fullName: string;
  username: string;
  role: 'admin' | 'asociado' | 'vendedor';
};

type CashMovementHistoryRow = {
  id: string;
  targetUserId: string;
  createdById: string;
  type: 'deposito' | 'retiro' | 'venta';
  amount: number;
  note: string | null;
  createdAt: Date;
  canceledAt: Date | null;
  canceledById: string | null;
  createdBy: HistoryActor;
  targetUser: HistoryActor;
  source: 'cash-movement' | 'ticket-sale';
  referenceCode?: string;
};

const router = Router();
router.use(authenticate);
router.use(authorizeResource('/cash-movements'));

const movementTypeSchema = z.enum(['deposito', 'retiro']);

const createMovementSchema = z.object({
  targetUserId: z.string().min(1),
  type: movementTypeSchema,
  amount: z.coerce.number().positive('El monto debe ser mayor a 0.'),
  note: z.string().trim().max(300).optional(),
});

const listMovementsQuerySchema = z.object({
  targetUserId: z.string().min(1).optional(),
  type: movementTypeSchema.optional(),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

const balanceQuerySchema = z.object({
  targetUserId: z.string().min(1).optional(),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const cancelMovementSchema = z.object({
  reason: z.string().trim().max(300).optional(),
});

async function getHierarchyUsers(): Promise<HierarchyUser[]> {
  return prisma.user.findMany({
    select: {
      id: true,
      fullName: true,
      username: true,
      role: true,
      status: true,
      parentId: true,
    },
  }) as Promise<HierarchyUser[]>;
}

function getDescendantUserIds(users: HierarchyUser[], rootId: string): Set<string> {
  const ids = new Set<string>();

  const walk = (parentId: string) => {
    if (ids.has(parentId)) return;
    ids.add(parentId);
    users
      .filter((u) => u.parentId === parentId)
      .forEach((child) => walk(child.id));
  };

  walk(rootId);
  return ids;
}

function getScopedUserIds(user: AuthUser, users: HierarchyUser[]): Set<string> {
  if (user.role === 'admin') {
    return new Set(users.map((u) => u.id));
  }
  if (user.role === 'vendedor') {
    return new Set([user.sub]);
  }
  return getDescendantUserIds(users, user.sub);
}

function parseCreatedAtFilter(
  fromDate?: string,
  toDate?: string
): { filter: Record<string, Date>; error?: string } {
  const filter: Record<string, Date> = {};

  if (fromDate) {
    const parsed = new Date(`${fromDate}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      return { filter: {}, error: 'fromDate invalida. Use formato YYYY-MM-DD.' };
    }
    filter['gte'] = parsed;
  }

  if (toDate) {
    const parsed = new Date(`${toDate}T23:59:59.999`);
    if (Number.isNaN(parsed.getTime())) {
      return { filter: {}, error: 'toDate invalida. Use formato YYYY-MM-DD.' };
    }
    filter['lte'] = parsed;
  }

  if (filter['gte'] && filter['lte'] && filter['gte'] > filter['lte']) {
    return { filter: {}, error: 'Rango de fechas invalido.' };
  }

  return { filter };
}

function normalizeNumber(value: string): string {
  const trimmed = value.trim();
  return trimmed.replace(/^0+(?=\d)/, '');
}

function calculatePrizeForTicket(
  ticket: PrizeTicket,
  defaultPlan: { multiplier: number; commission: number } | null
): number {
  const winnerNumber = ticket.draw.winnerNumber;
  if (!winnerNumber) return 0;

  const effectivePlan = ticket.seller.plan ?? ticket.associate.plan ?? defaultPlan;
  const regularMultiplier = effectivePlan?.multiplier ?? 0;
  const specialMultiplierValue = ticket.draw.specialMultiplier?.value ?? null;
  const normalizedWinner = normalizeNumber(winnerNumber);

  return ticket.lines.reduce((sum, line) => {
    if (normalizeNumber(line.number) !== normalizedWinner) {
      return sum;
    }

    if (specialMultiplierValue !== null && (line.specialAmount ?? 0) > 0) {
      return sum + (line.amount + (line.specialAmount ?? 0)) * regularMultiplier * specialMultiplierValue;
    }

    return sum + line.amount * regularMultiplier;
  }, 0);
}

// GET /api/cash-movements/targets
router.get('/targets', async (req, res) => {
  const authUser = req.user as AuthUser;
  const users = await getHierarchyUsers();
  const scoped = getScopedUserIds(authUser, users);
  const canCreateMovements = await isResourceAllowedForRole('/cash-movements:create', authUser.role);

  const targets = users
    .filter((u) => scoped.has(u.id))
    .filter((u) => u.role !== 'admin')
    .map((u) => ({
      id: u.id,
      fullName: u.fullName,
      username: u.username,
      role: u.role,
      status: u.status,
      canOperate: canCreateMovements && authUser.sub !== u.id,
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));

  res.json(targets);
});

// GET /api/cash-movements
router.get('/', async (req, res) => {
  const parsed = listMovementsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Parametros invalidos.' });
    return;
  }

  const { targetUserId, type, fromDate, toDate, limit } = parsed.data;
  const authUser = req.user as AuthUser;
  const users = await getHierarchyUsers();
  const scoped = getScopedUserIds(authUser, users);
  const finalTargetUserId = targetUserId ?? (authUser.role === 'vendedor' ? authUser.sub : undefined);

  if (finalTargetUserId && !scoped.has(finalTargetUserId)) {
    res.status(403).json({ message: 'No tienes permisos para ver este usuario.' });
    return;
  }

  const { filter: createdAt, error } = parseCreatedAtFilter(fromDate, toDate);
  if (error) {
    res.status(400).json({ message: error });
    return;
  }

  const where: Record<string, unknown> = {};
  if (type) where['type'] = type;
  if (Object.keys(createdAt).length > 0) where['createdAt'] = createdAt;

  if (finalTargetUserId) {
    where['targetUserId'] = finalTargetUserId;
  } else {
    where['targetUserId'] = { in: Array.from(scoped) };
  }

  const movementRows = await prisma.cashMovement.findMany({
    where: { ...where, canceledAt: null },
    include: {
      createdBy: { select: { id: true, fullName: true, username: true, role: true } },
      targetUser: { select: { id: true, fullName: true, username: true, role: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  const ticketWhere: Record<string, unknown> = { canceledAt: null };
  if (Object.keys(createdAt).length > 0) ticketWhere['createdAt'] = createdAt;

  if (finalTargetUserId) {
    ticketWhere['sellerId'] = finalTargetUserId;
  } else {
    ticketWhere['sellerId'] = { in: Array.from(scoped) };
  }

  const ticketRows = await prisma.ticket.findMany({
    where: ticketWhere,
    include: {
      seller: { select: { id: true, fullName: true, username: true, role: true } },
      draw: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  const rows: CashMovementHistoryRow[] = [
    ...movementRows.map((row) => ({
      id: row.id,
      targetUserId: row.targetUserId,
      createdById: row.createdById,
      type: row.type,
      amount: row.amount,
      note: row.note ?? null,
      createdAt: row.createdAt,
      canceledAt: row.canceledAt,
      canceledById: row.canceledById,
      createdBy: row.createdBy,
      targetUser: row.targetUser,
      source: 'cash-movement' as const,
    })),
    ...ticketRows.map((ticket) => ({
      id: ticket.id,
      targetUserId: ticket.sellerId,
      createdById: ticket.sellerId,
      type: 'venta' as const,
      amount: ticket.total,
      note: `Ticket ${ticket.code}${ticket.draw?.name ? ` - ${ticket.draw.name}` : ''}`,
      createdAt: ticket.createdAt,
      canceledAt: ticket.canceledAt,
      canceledById: ticket.canceledById,
      createdBy: ticket.seller,
      targetUser: ticket.seller,
      source: 'ticket-sale' as const,
      referenceCode: ticket.code,
    })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);

  res.json(rows);
});

// GET /api/cash-movements/balance
router.get('/balance', async (req, res) => {
  const parsed = balanceQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Parametros invalidos.' });
    return;
  }

  const authUser = req.user as AuthUser;
  const users = await getHierarchyUsers();
  const scoped = getScopedUserIds(authUser, users);
  const targetUserId = parsed.data.targetUserId ?? authUser.sub;

  if (!scoped.has(targetUserId)) {
    res.status(403).json({ message: 'No tienes permisos para consultar este balance.' });
    return;
  }

  const target = users.find((u) => u.id === targetUserId);
  if (!target) {
    res.status(404).json({ message: 'Usuario objetivo no encontrado.' });
    return;
  }

  const { filter: createdAt, error } = parseCreatedAtFilter(parsed.data.fromDate, parsed.data.toDate);
  if (error) {
    res.status(400).json({ message: error });
    return;
  }

  const openingBalanceCutoff = parsed.data.fromDate ? new Date(`${parsed.data.fromDate}T00:00:00`) : null;

  const movementWhere: Record<string, unknown> = { targetUserId, canceledAt: null };
  if (Object.keys(createdAt).length > 0) {
    movementWhere['createdAt'] = createdAt;
  }

  const [depositsAgg, withdrawalsAgg] = await Promise.all([
    prisma.cashMovement.aggregate({
      where: { ...movementWhere, type: 'deposito' },
      _sum: { amount: true },
    }),
    prisma.cashMovement.aggregate({
      where: { ...movementWhere, type: 'retiro' },
      _sum: { amount: true },
    }),
  ]);

  const ticketWhere: Record<string, unknown> = {
    sellerId: targetUserId,
    canceledAt: null,
  };
  if (Object.keys(createdAt).length > 0) {
    ticketWhere['createdAt'] = createdAt;
  }

  const [ticketAgg, defaultPlan, tickets] = await Promise.all([
    prisma.ticket.aggregate({ where: ticketWhere, _sum: { total: true }, _count: { id: true } }),
    prisma.plan.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { multiplier: true, commission: true },
    }),
    prisma.ticket.findMany({
      where: ticketWhere,
      include: {
        lines: { select: { number: true, amount: true, specialAmount: true } },
        draw: {
          select: {
            winnerNumber: true,
            specialMultiplier: { select: { value: true } },
          },
        },
        seller: {
          select: {
            plan: { select: { multiplier: true, commission: true } },
          },
        },
        associate: {
          select: {
            plan: { select: { multiplier: true, commission: true } },
          },
        },
      },
    }),
  ]);

  let openingBalance = 0;
  if (openingBalanceCutoff) {
    const openingMovementWhere = {
      targetUserId,
      canceledAt: null,
      createdAt: { lt: openingBalanceCutoff },
    };
    const openingTicketWhere = {
      sellerId: targetUserId,
      canceledAt: null,
      createdAt: { lt: openingBalanceCutoff },
    };

    const [openingDepositsAgg, openingWithdrawalsAgg, openingTicketAgg, openingTickets] = await Promise.all([
      prisma.cashMovement.aggregate({
        where: { ...openingMovementWhere, type: 'deposito' },
        _sum: { amount: true },
      }),
      prisma.cashMovement.aggregate({
        where: { ...openingMovementWhere, type: 'retiro' },
        _sum: { amount: true },
      }),
      prisma.ticket.aggregate({ where: openingTicketWhere, _sum: { total: true } }),
      prisma.ticket.findMany({
        where: openingTicketWhere,
        include: {
          lines: { select: { number: true, amount: true, specialAmount: true } },
          draw: {
            select: {
              winnerNumber: true,
              specialMultiplier: { select: { value: true } },
            },
          },
          seller: {
            select: {
              plan: { select: { multiplier: true, commission: true } },
            },
          },
          associate: {
            select: {
              plan: { select: { multiplier: true, commission: true } },
            },
          },
        },
      }),
    ]);

    const openingPrizes = openingTickets.reduce(
      (sum, ticket) => sum + calculatePrizeForTicket(ticket as PrizeTicket, defaultPlan),
      0
    );

    openingBalance =
      (openingDepositsAgg._sum.amount ?? 0) -
      (openingWithdrawalsAgg._sum.amount ?? 0) +
      (openingTicketAgg._sum.total ?? 0) -
      openingPrizes;
  }

  const totalPrizes = tickets.reduce(
    (sum, ticket) => sum + calculatePrizeForTicket(ticket as PrizeTicket, defaultPlan),
    0
  );

  const totalDeposits = depositsAgg._sum.amount ?? 0;
  const totalWithdrawals = withdrawalsAgg._sum.amount ?? 0;
  const totalSales = ticketAgg._sum.total ?? 0;
  const balance = openingBalance + totalDeposits - totalWithdrawals + totalSales - totalPrizes;

  res.json({
    targetUser: {
      id: target.id,
      fullName: target.fullName,
      username: target.username,
      role: target.role,
      status: target.status,
    },
    totals: {
      openingBalance,
      totalDeposits,
      totalWithdrawals,
      totalSales,
      totalPrizes,
      ticketCount: ticketAgg._count.id,
      balance,
    },
    filters: {
      fromDate: parsed.data.fromDate ?? null,
      toDate: parsed.data.toDate ?? null,
    },
  });
});

// POST /api/cash-movements
router.post('/', authorizeResource('/cash-movements:create'), validate(createMovementSchema), async (req, res) => {
  const authUser = req.user as AuthUser;

  const body = req.body as z.infer<typeof createMovementSchema>;

  if (body.targetUserId === authUser.sub) {
    res.status(400).json({ message: 'No puedes registrar movimientos sobre tu propio usuario.' });
    return;
  }

  const users = await getHierarchyUsers();
  const target = users.find((u) => u.id === body.targetUserId);
  if (!target) {
    res.status(404).json({ message: 'Usuario objetivo no encontrado.' });
    return;
  }

  if (target.role === 'admin') {
    res.status(400).json({ message: 'Solo puedes operar con asociados y vendedores.' });
    return;
  }

  if (target.status !== 'activo') {
    res.status(400).json({ message: 'Solo puedes operar con usuarios activos.' });
    return;
  }

  if (authUser.role === 'asociado') {
    const descendants = getDescendantUserIds(users, authUser.sub);
    if (!descendants.has(body.targetUserId)) {
      res.status(403).json({ message: 'Solo puedes operar con usuarios de tu jerarquia.' });
      return;
    }
  }

  const movement = await prisma.$transaction(async (tx) => {
    const created = await tx.cashMovement.create({
      data: {
        targetUserId: body.targetUserId,
        createdById: authUser.sub,
        type: body.type,
        amount: body.amount,
        note: body.note ?? null,
      },
      include: {
        createdBy: { select: { id: true, fullName: true, username: true, role: true } },
        targetUser: { select: { id: true, fullName: true, username: true, role: true } },
      },
    });

    await tx.auditLog.create({
      data: {
        action: body.type === 'deposito' ? 'CREATE_CASH_DEPOSIT' : 'CREATE_CASH_WITHDRAWAL',
        entity: 'CashMovement',
        entityId: created.id,
        userId: authUser.sub,
        details: {
          amount: body.amount,
          targetUserId: body.targetUserId,
          type: body.type,
          note: body.note ?? null,
        },
      },
    });

    return created;
  });

  res.status(201).json(movement);
});

// PATCH /api/cash-movements/:id/cancel
router.patch('/:id/cancel', authorizeResource('/cash-movements:cancel'), validate(cancelMovementSchema), async (req, res) => {
  const authUser = req.user as AuthUser;
  const movementId = req.params.id as string;
  const body = req.body as z.infer<typeof cancelMovementSchema>;

  const movement = await prisma.cashMovement.findUnique({
    where: { id: movementId },
    include: {
      createdBy: { select: { id: true, fullName: true, username: true, role: true, parentId: true } },
      targetUser: { select: { id: true, fullName: true, username: true, role: true } },
    },
  });

  if (!movement) {
    res.status(404).json({ message: 'Movimiento no encontrado.' });
    return;
  }

  if (movement.canceledAt) {
    res.status(400).json({ message: 'Este movimiento ya ha sido cancelado.' });
    return;
  }

  // Validation: Only the creator or their superiors can cancel
  const users = await getHierarchyUsers();
  const authUserData = users.find((u) => u.id === authUser.sub);

  if (!authUserData) {
    res.status(403).json({ message: 'Usuario no encontrado.' });
    return;
  }

  // Admin can cancel any movement
  if (authUser.role !== 'admin') {
    // Only the creator or a superior in the hierarchy can cancel
    if (authUser.sub === movement.createdById) {
      // User is the creator, allowed
    } else if (authUser.role === 'asociado') {
      // Check if the creator is a subordinate
      const descendants = getDescendantUserIds(users, authUser.sub);
      if (!descendants.has(movement.createdById)) {
        res.status(403).json({ message: 'No tienes permisos para cancelar este movimiento.' });
        return;
      }
    } else {
      // Vendedor cannot cancel movements they didn't create
      res.status(403).json({ message: 'Solo puedes cancelar movimientos que creaste.' });
      return;
    }
  }

  const canceled = await prisma.$transaction(async (tx) => {
    const updated = await tx.cashMovement.update({
      where: { id: movementId },
      data: {
        canceledAt: new Date(),
        canceledById: authUser.sub,
      },
      include: {
        createdBy: { select: { id: true, fullName: true, username: true, role: true } },
        targetUser: { select: { id: true, fullName: true, username: true, role: true } },
      },
    });

    await tx.auditLog.create({
      data: {
        action: movement.type === 'deposito' ? 'CANCEL_CASH_DEPOSIT' : 'CANCEL_CASH_WITHDRAWAL',
        entity: 'CashMovement',
        entityId: movementId,
        userId: authUser.sub,
        details: {
          amount: movement.amount,
          targetUserId: movement.targetUserId,
          type: movement.type,
          originalCreatedById: movement.createdById,
          reason: body.reason ?? null,
        },
      },
    });

    return updated;
  });

  res.json(canceled);
});

export default router;
