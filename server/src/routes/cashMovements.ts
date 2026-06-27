import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import {
  DrawFilterRule,
  ReportingFilterSectionKey,
  getReportingFilterSettings,
} from '../config/reportingFilterSettings.js';
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
  balanceAfterTransaction?: number;
};

type CashMovementEventSummaryRow = {
  eventId: string;
  eventName: string;
  eventDate: Date;
  ticketCount: number;
  totalSales: number;
  totalPrizes: number;
  totalCommissions: number;
  balance: number;
  balanceAfterTransaction: number;
};

const router = Router();
router.use(authenticate);
router.use(authorizeResource('/cash-movements'));

const CASH_MOVEMENTS_TIMEZONE_OFFSET = '-06:00';

async function getDrawFilterRule(sectionKey: ReportingFilterSectionKey): Promise<DrawFilterRule> {
  const settings = await getReportingFilterSettings();
  return settings.sections[sectionKey];
}

function applyDrawFilterRule(where: Record<string, unknown>, rule: DrawFilterRule): void {
  const drawFilter: Record<string, unknown> = {};

  if (rule.requireFinalized) {
    drawFilter['status'] = 'finalizado';
  }
  if (rule.requireWinnerDefined) {
    drawFilter['winnerNumber'] = { not: null as string | null };
  }

  if (Object.keys(drawFilter).length > 0) {
    where['draw'] = drawFilter;
  }
}

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

function parseDateYmdToUtc(dateValue: string, endOfDay: boolean): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const overflowCheck = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
  if (
    overflowCheck.getUTCFullYear() !== year ||
    overflowCheck.getUTCMonth() !== month - 1 ||
    overflowCheck.getUTCDate() !== day
  ) {
    return null;
  }

  const boundaryTime = endOfDay ? '23:59:59.999' : '00:00:00.000';
  const parsed = new Date(`${dateValue}T${boundaryTime}${CASH_MOVEMENTS_TIMEZONE_OFFSET}`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

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
    const parsed = parseDateYmdToUtc(fromDate, false);
    if (!parsed) {
      return { filter: {}, error: 'fromDate invalida. Use formato YYYY-MM-DD.' };
    }
    filter['gte'] = parsed;
  }

  if (toDate) {
    const parsed = parseDateYmdToUtc(toDate, true);
    if (!parsed) {
      return { filter: {}, error: 'toDate invalida. Use formato YYYY-MM-DD.' };
    }
    filter['lte'] = parsed;
  }

  if (filter['gte'] && filter['lte'] && filter['gte'] > filter['lte']) {
    return { filter: {}, error: 'Rango de fechas invalido.' };
  }

  return { filter };
}



async function getOpeningBalances(
  userIds: string[],
  cutoffDate: Date | null,
  drawFilterRule: DrawFilterRule
): Promise<Record<string, number>> {
  const balances: Record<string, number> = {};
  for (const id of userIds) {
    balances[id] = 0;
  }

  if (!cutoffDate) {
    return balances;
  }

  const movements = await prisma.cashMovement.groupBy({
    by: ['targetUserId', 'type'],
    where: {
      targetUserId: { in: userIds },
      canceledAt: null,
      createdAt: { lt: cutoffDate },
    },
    _sum: { amount: true },
  });

  for (const m of movements) {
    const userId = m.targetUserId;
    const amount = m._sum.amount ?? 0;
    if (m.type === 'deposito') {
      balances[userId] = (balances[userId] ?? 0) + amount;
    } else {
      balances[userId] = (balances[userId] ?? 0) - amount;
    }
  }

  const ticketWhere: Record<string, unknown> = {
    sellerId: { in: userIds },
    canceledAt: null,
    createdAt: { lt: cutoffDate },
  };
  applyDrawFilterRule(ticketWhere, drawFilterRule);

  const ticketAggs = await prisma.ticket.groupBy({
    by: ['sellerId'],
    where: ticketWhere,
    _sum: {
      total: true,
      prize: true,
    },
  });

  for (const agg of ticketAggs) {
    const userId = agg.sellerId;
    const sales = agg._sum.total ?? 0;
    const prize = agg._sum.prize ?? 0;
    balances[userId] = (balances[userId] ?? 0) + sales - prize;
  }

  return balances;
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

  const targetUserIds = finalTargetUserId ? [finalTargetUserId] : Array.from(scoped);
  const openingBalanceCutoff = fromDate ? parseDateYmdToUtc(fromDate, false) : null;
  const drawFilterRule = await getDrawFilterRule('cash-movements.balance');

  const openingBalances = await getOpeningBalances(
    targetUserIds,
    openingBalanceCutoff,
    drawFilterRule
  );

  const rangeMovementWhere: Record<string, unknown> = {
    targetUserId: { in: targetUserIds },
    canceledAt: null,
  };
  if (Object.keys(createdAt).length > 0) {
    rangeMovementWhere['createdAt'] = createdAt;
  }

  const rangeTicketWhere: Record<string, unknown> = {
    sellerId: { in: targetUserIds },
    canceledAt: null,
  };
  if (Object.keys(createdAt).length > 0) {
    rangeTicketWhere['createdAt'] = createdAt;
  }
  applyDrawFilterRule(rangeTicketWhere, drawFilterRule);

  const [allMovements, allTickets] = await Promise.all([
    prisma.cashMovement.findMany({
      where: rangeMovementWhere,
      orderBy: { createdAt: 'asc' },
    }),
    prisma.ticket.findMany({
      where: rangeTicketWhere,
      select: {
        id: true,
        sellerId: true,
        total: true,
        prize: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  const allEvents = [
    ...allMovements.map(m => ({
      id: m.id,
      userId: m.targetUserId,
      type: m.type,
      amount: m.amount,
      createdAt: m.createdAt,
      isMovement: true,
    })),
    ...allTickets.map(t => {
      return {
        id: t.id,
        userId: t.sellerId,
        type: 'ticket' as const,
        amount: t.total - t.prize,
        createdAt: t.createdAt,
        isMovement: false,
      };
    })
  ].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const currentBalances = { ...openingBalances };
  const balanceMap = new Map<string, number>();

  for (const event of allEvents) {
    const userId = event.userId;
    const currentBalance = currentBalances[userId] ?? 0;
    let newBalance = currentBalance;

    if (event.isMovement) {
      if (event.type === 'deposito') {
        newBalance += event.amount;
      } else {
        newBalance -= event.amount;
      }
      currentBalances[userId] = newBalance;
      balanceMap.set(event.id, newBalance);
    } else {
      newBalance += event.amount;
      currentBalances[userId] = newBalance;
    }
  }

  movementRows.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const rows: CashMovementHistoryRow[] = movementRows.map((row) => ({
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
    balanceAfterTransaction: balanceMap.get(row.id) ?? (openingBalances[row.targetUserId] ?? 0),
  }));

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

  const openingBalanceCutoff = parsed.data.fromDate ? parseDateYmdToUtc(parsed.data.fromDate, false) : null;

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
  const drawFilterRule = await getDrawFilterRule('cash-movements.balance');
  applyDrawFilterRule(ticketWhere, drawFilterRule);

  const ticketAgg = await prisma.ticket.aggregate({
    where: ticketWhere,
    _sum: { total: true, prize: true },
    _count: { id: true },
  });

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
    applyDrawFilterRule(openingTicketWhere, drawFilterRule);

    const [openingDepositsAgg, openingWithdrawalsAgg, openingTicketAgg] = await Promise.all([
      prisma.cashMovement.aggregate({
        where: { ...openingMovementWhere, type: 'deposito' },
        _sum: { amount: true },
      }),
      prisma.cashMovement.aggregate({
        where: { ...openingMovementWhere, type: 'retiro' },
        _sum: { amount: true },
      }),
      prisma.ticket.aggregate({
        where: openingTicketWhere,
        _sum: { total: true, prize: true },
      }),
    ]);

    openingBalance =
      (openingDepositsAgg._sum.amount ?? 0) -
      (openingWithdrawalsAgg._sum.amount ?? 0) +
      (openingTicketAgg._sum.total ?? 0) -
      (openingTicketAgg._sum.prize ?? 0);
  }

  const totalPrizes = ticketAgg._sum.prize ?? 0;
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

// GET /api/cash-movements/summary-by-event
router.get('/summary-by-event', async (req, res) => {
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

  const openingBalanceCutoff = parsed.data.fromDate ? parseDateYmdToUtc(parsed.data.fromDate, false) : null;

  const ticketWhere: Record<string, unknown> = {
    sellerId: targetUserId,
    canceledAt: null,
  };
  if (Object.keys(createdAt).length > 0) {
    ticketWhere['createdAt'] = createdAt;
  }
  const drawFilterRule = await getDrawFilterRule('cash-movements.summary-by-event');
  applyDrawFilterRule(ticketWhere, drawFilterRule);

  const ticketGroups = await prisma.ticket.groupBy({
    by: ['drawId'],
    where: ticketWhere,
    _sum: {
      total: true,
      prize: true,
      commission: true,
    },
    _count: {
      id: true,
    },
  });

  const drawIds = ticketGroups.map((g) => g.drawId);
  const draws = await prisma.draw.findMany({
    where: { id: { in: drawIds } },
    select: { id: true, name: true, closeTime: true },
  });
  const drawById = new Map(draws.map((d) => [d.id, d]));

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
    applyDrawFilterRule(openingTicketWhere, drawFilterRule);

    const [openingDepositsAgg, openingWithdrawalsAgg, openingTicketAgg] = await Promise.all([
      prisma.cashMovement.aggregate({
        where: { ...openingMovementWhere, type: 'deposito' },
        _sum: { amount: true },
      }),
      prisma.cashMovement.aggregate({
        where: { ...openingMovementWhere, type: 'retiro' },
        _sum: { amount: true },
      }),
      prisma.ticket.aggregate({
        where: openingTicketWhere,
        _sum: { total: true, prize: true },
      }),
    ]);

    openingBalance =
      (openingDepositsAgg._sum.amount ?? 0) -
      (openingWithdrawalsAgg._sum.amount ?? 0) +
      (openingTicketAgg._sum.total ?? 0) -
      (openingTicketAgg._sum.prize ?? 0);
  }

  const byEvent = new Map<string, CashMovementEventSummaryRow>();
  for (const group of ticketGroups) {
    const draw = drawById.get(group.drawId);
    if (!draw) continue;

    byEvent.set(group.drawId, {
      eventId: group.drawId,
      eventName: draw.name,
      eventDate: draw.closeTime,
      ticketCount: group._count.id,
      totalSales: group._sum.total ?? 0,
      totalPrizes: group._sum.prize ?? 0,
      totalCommissions: group._sum.commission ?? 0,
      balance: (group._sum.total ?? 0) - (group._sum.prize ?? 0),
      balanceAfterTransaction: 0,
    });
  }

  let runningBalance = openingBalance;
  const rows = Array.from(byEvent.values())
    .sort((a, b) => {
      const dateDiff = a.eventDate.getTime() - b.eventDate.getTime();
      if (dateDiff !== 0) return dateDiff;
      return a.eventName.localeCompare(b.eventName);
    })
    .map((row) => {
      runningBalance += row.balance;
      return {
        eventId: row.eventId,
        eventName: row.eventName,
        eventDate: row.eventDate.toISOString(),
        ticketCount: row.ticketCount,
        totalSales: row.totalSales,
        totalPrizes: row.totalPrizes,
        totalCommissions: row.totalCommissions,
        balance: row.balance,
        balanceAfterTransaction: runningBalance,
      };
    });

  const totals = rows.reduce(
    (acc, row) => ({
      ticketCount: acc.ticketCount + row.ticketCount,
      totalSales: acc.totalSales + row.totalSales,
      totalPrizes: acc.totalPrizes + row.totalPrizes,
      totalCommissions: acc.totalCommissions + row.totalCommissions,
      balance: acc.balance + row.balance,
    }),
    {
      ticketCount: 0,
      totalSales: 0,
      totalPrizes: 0,
      totalCommissions: 0,
      balance: 0,
    }
  );

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
      ...totals,
    },
    filters: {
      fromDate: parsed.data.fromDate ?? null,
      toDate: parsed.data.toDate ?? null,
    },
    rows,
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
