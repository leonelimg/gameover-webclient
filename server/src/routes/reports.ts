import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import {
  DrawFilterRule,
  ReportingFilterSectionKey,
  getReportingFilterSettings,
} from '../config/reportingFilterSettings.js';
import { authenticate, authorizeAnyResource, authorizeResource } from '../middleware/auth.js';

type Stats = { totalSales: number; ticketCount: number };

interface SummaryTicket {
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

type ReportUser = {
  id: string;
  fullName: string;
  username: string;
  role: 'admin' | 'asociado' | 'vendedor';
  parentId: string | null;
  status: 'activo' | 'bloqueado' | 'archivado';
};

const router = Router();
router.use(authenticate);

const REPORTS_TIMEZONE_OFFSET = '-06:00';

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
  const parsed = new Date(`${dateValue}T${boundaryTime}${REPORTS_TIMEZONE_OFFSET}`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function parseCreatedAtFilter(fromDate?: string, toDate?: string): { filter: Record<string, Date>; error?: string } {
  const filter: Record<string, Date> = {};

  if (fromDate) {
    const parsed = parseDateYmdToUtc(fromDate, false);
    if (!parsed) {
      return { filter, error: 'fromDate inválida. Use formato YYYY-MM-DD.' };
    }
    filter['gte'] = parsed;
  }

  if (toDate) {
    const parsed = parseDateYmdToUtc(toDate, true);
    if (!parsed) {
      return { filter, error: 'toDate inválida. Use formato YYYY-MM-DD.' };
    }
    filter['lte'] = parsed;
  }

  if (filter['gte'] && filter['lte'] && filter['gte'] > filter['lte']) {
    return { filter, error: 'Rango de fechas inválido.' };
  }

  return { filter };
}

function getDescendantUserIds(users: ReportUser[], rootId: string): Set<string> {
  const ids = new Set<string>();

  const walk = (parentId: string) => {
    if (ids.has(parentId)) return;
    ids.add(parentId);
    users
      .filter((user) => user.parentId === parentId)
      .forEach((child) => walk(child.id));
  };

  walk(rootId);
  return ids;
}

async function getScopedUsers() {
  return prisma.user.findMany({
    select: {
      id: true,
      fullName: true,
      username: true,
      role: true,
      parentId: true,
      status: true,
    },
  }) as Promise<ReportUser[]>;
}

function getScopedSellerIds(users: ReportUser[], user: { sub: string; role: 'admin' | 'asociado' | 'vendedor' }): Set<string> | null {
  if (user.role === 'admin') {
    return null;
  }
  // Any non-admin role is scoped to its own subtree (self + descendants).
  return getDescendantUserIds(users, user.sub);
}

function normalizeNumber(value: string): string {
  const trimmed = value.trim();
  return trimmed.replace(/^0+(?=\d)/, '');
}

function calculatePrizeForTicket(
  ticket: SummaryTicket,
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

// ── GET /api/reports/summary ──────────────────────────────────────────────────

router.get('/summary', authorizeAnyResource('/reports/sales-stats', '/dashboard'), async (req, res) => {
  const { drawId, fromDate, toDate } = req.query as Record<string, string>;

  const scopedUsers = await getScopedUsers();
  const scopedSellerIds = getScopedSellerIds(scopedUsers, req.user as { sub: string; role: 'admin' | 'asociado' | 'vendedor' });

  const { filter: createdAtFilter, error } = parseCreatedAtFilter(fromDate, toDate);
  if (error) {
    res.status(400).json({ message: error });
    return;
  }

  const ticketWhere: Record<string, unknown> = {};
  if (drawId) ticketWhere['drawId'] = drawId;
  if (Object.keys(createdAtFilter).length > 0) ticketWhere['createdAt'] = createdAtFilter;
  if (scopedSellerIds) {
    ticketWhere['sellerId'] = { in: Array.from(scopedSellerIds) };
  }
  const drawFilterRule = await getDrawFilterRule('reports.sales-stats.summary');
  applyDrawFilterRule(ticketWhere, drawFilterRule);

  const activeTicketWhere: Record<string, unknown> = {
    ...ticketWhere,
    canceledAt: null,
  };

  const [ticketCount, totalResult, ticketIdsForCounts, defaultPlan, ticketsForFinancials] = await Promise.all([
    prisma.ticket.count({ where: activeTicketWhere }),
    prisma.ticket.aggregate({ where: activeTicketWhere, _sum: { total: true } }),
    prisma.ticket.findMany({
      where: activeTicketWhere,
      select: { drawId: true, sellerId: true, associateId: true },
    }),
    prisma.plan.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { multiplier: true, commission: true },
    }),
    prisma.ticket.findMany({
      where: activeTicketWhere,
      select: {
        total: true,
        lines: { select: { number: true, amount: true, specialAmount: true } },
        draw: {
          select: {
            winnerNumber: true,
            specialMultiplier: { select: { value: true } },
          },
        },
        seller: { select: { plan: { select: { multiplier: true, commission: true } } } },
        associate: { select: { plan: { select: { multiplier: true, commission: true } } } },
      },
    }) as Promise<SummaryTicket[]>,
  ]);

  const drawCount = new Set(ticketIdsForCounts.map((ticket) => ticket.drawId)).size;
  const activeUsersById = new Map(scopedUsers.map((user): [string, ReportUser] => [user.id, user]));
  const involvedUserIds = new Set(ticketIdsForCounts.flatMap((ticket) => [ticket.sellerId, ticket.associateId]));
  const userCount = Array.from(involvedUserIds).filter((userId) => activeUsersById.get(userId)?.status === 'activo').length;

  let totalPrizes = 0;
  let totalCommissions = 0;

  for (const ticket of ticketsForFinancials) {
    const effectivePlan = ticket.seller.plan ?? ticket.associate.plan ?? defaultPlan;
    const commissionRate = (effectivePlan?.commission ?? 0) / 100;
    totalCommissions += ticket.total * commissionRate;
    totalPrizes += calculatePrizeForTicket(ticket, defaultPlan);
  }

  res.json({
    ticketCount,
    totalSales: totalResult._sum.total ?? 0,
    totalPrizes,
    totalCommissions,
    userCount,
    drawCount,
  });
});

// ── GET /api/reports/top-numbers ──────────────────────────────────────────────

router.get('/top-numbers', authorizeAnyResource('/reports/sales-stats', '/dashboard', '/sales'), async (req, res) => {
  const { drawId, limit = '10', fromDate, toDate, includeAllDraws } = req.query as Record<string, string>;

  const users = await getScopedUsers();
  const scopedSellerIds = getScopedSellerIds(users, req.user as { sub: string; role: 'admin' | 'asociado' | 'vendedor' });

  const { filter: createdAtFilter, error } = parseCreatedAtFilter(fromDate, toDate);
  if (error) {
    res.status(400).json({ message: error });
    return;
  }

  const ticketWhere: Record<string, unknown> = {};
  if (drawId) ticketWhere['drawId'] = drawId;
  if (Object.keys(createdAtFilter).length > 0) ticketWhere['createdAt'] = createdAtFilter;
  ticketWhere['canceledAt'] = null;
  if (scopedSellerIds) {
    ticketWhere['sellerId'] = { in: Array.from(scopedSellerIds) };
  }
  if (includeAllDraws === 'true') {
    applyDrawFilterRule(ticketWhere, {
      requireFinalized: false,
      requireWinnerDefined: false,
    });
  } else if (includeAllDraws === 'false') {
    applyDrawFilterRule(ticketWhere, {
      requireFinalized: true,
      requireWinnerDefined: true,
    });
  } else {
    const drawFilterRule = await getDrawFilterRule('reports.sales-stats.top-numbers');
    applyDrawFilterRule(ticketWhere, drawFilterRule);
  }

  // Get all ticket IDs matching filter
  const tickets = await prisma.ticket.findMany({
    where: ticketWhere,
    select: { id: true },
  });
  const ticketIds = tickets.map((t: { id: string }) => t.id);

  const grouped = await prisma.ticketLine.groupBy({
    by: ['number'],
    where: { ticketId: { in: ticketIds } },
    _sum: { amount: true },
    orderBy: { _sum: { amount: 'desc' } },
    take: parseInt(limit, 10),
  });

  const result = grouped.map((g: { number: string; _sum: { amount: number | null } }) => ({
    number: g.number,
    total: g._sum.amount ?? 0,
  }));

  res.json(result);
});

// ── GET /api/reports/hierarchy ────────────────────────────────────────────────

router.get('/hierarchy', authorizeResource('/reports/sales-stats'), async (req, res) => {
  const { drawId, fromDate, toDate } = req.query as Record<string, string>;

  const { filter: createdAtFilter, error } = parseCreatedAtFilter(fromDate, toDate);
  if (error) {
    res.status(400).json({ message: error });
    return;
  }

  // Fetch all users
  const users = await prisma.user.findMany({
    select: {
      id: true, fullName: true, username: true,
      role: true, status: true, parentId: true,
    },
  });

  // Aggregate direct sales by seller, then roll up through the user tree.
  const ticketWhere: Record<string, unknown> = { canceledAt: null };
  if (drawId) ticketWhere['drawId'] = drawId;
  if (Object.keys(createdAtFilter).length > 0) ticketWhere['createdAt'] = createdAtFilter;
  const drawFilterRule = await getDrawFilterRule('reports.sales-stats.summary');
  applyDrawFilterRule(ticketWhere, drawFilterRule);

  const aggregates = await prisma.ticket.groupBy({
    by: ['sellerId'],
    where: ticketWhere,
    _sum: { total: true },
    _count: { id: true },
  });

  const statsMap = new Map<string, Stats>(
    aggregates.map((a: { sellerId: string; _sum: { total: number | null }; _count: { id: number } }): [string, Stats] => [
      a.sellerId,
      { totalSales: a._sum.total ?? 0, ticketCount: a._count.id },
    ])
  );

  // Build tree recursively
  type NodeUser = (typeof users)[0];

  interface TreeNode {
    user: NodeUser;
    totalSales: number;
    ticketCount: number;
    children: TreeNode[];
  }

  function buildTree(parentId: string | null): TreeNode[] {
    return users
      .filter((u: NodeUser) => (parentId === null ? !u.parentId : u.parentId === parentId))
      .map((u: NodeUser) => {
        const children = buildTree(u.id);
        const direct = statsMap.get(u.id) ?? { totalSales: 0, ticketCount: 0 };
        const childTotals = children.reduce<Stats>(
          (acc, c) => ({
            totalSales: acc.totalSales + c.totalSales,
            ticketCount: acc.ticketCount + c.ticketCount,
          }),
          { totalSales: 0, ticketCount: 0 }
        );
        return {
          user: u,
          totalSales: direct.totalSales + childTotals.totalSales,
          ticketCount: direct.ticketCount + childTotals.ticketCount,
          children,
        };
      });
  }

  // Non-admin roles only see their own subtree; admins see full hierarchy.
  let tree: TreeNode[];
  if (req.user!.role !== 'admin') {
    const root = users.find((u: NodeUser) => u.id === req.user!.sub);
    if (!root) { res.json([]); return; }
    const children = buildTree(root.id);
    const direct = statsMap.get(root.id) ?? { totalSales: 0, ticketCount: 0 };
    const childTotals = children.reduce<Stats>(
      (acc, c) => ({ totalSales: acc.totalSales + c.totalSales, ticketCount: acc.ticketCount + c.ticketCount }),
      { totalSales: 0, ticketCount: 0 }
    );
    tree = [{ user: root, totalSales: direct.totalSales + childTotals.totalSales, ticketCount: direct.ticketCount + childTotals.ticketCount, children }];
  } else {
    // Admin: return all root-level users (no parent) so they see full hierarchy
    tree = buildTree(null);
  }

  res.json(tree);
});

// ── GET /api/reports/recent-tickets ──────────────────────────────────────────

router.get('/recent-tickets', authorizeAnyResource('/reports/sales-stats', '/dashboard'), async (req, res) => {
  const { drawId, limit = '10', fromDate, toDate } = req.query as Record<string, string>;

  const users = await getScopedUsers();
  const scopedSellerIds = getScopedSellerIds(users, req.user as { sub: string; role: 'admin' | 'asociado' | 'vendedor' });

  const { filter: createdAtFilter, error } = parseCreatedAtFilter(fromDate, toDate);
  if (error) {
    res.status(400).json({ message: error });
    return;
  }

  const where: Record<string, unknown> = {};
  if (drawId) where['drawId'] = drawId;
  if (Object.keys(createdAtFilter).length > 0) where['createdAt'] = createdAtFilter;
  where['canceledAt'] = null;
  if (scopedSellerIds) where['sellerId'] = { in: Array.from(scopedSellerIds) };
  const drawFilterRule = await getDrawFilterRule('reports.sales-stats.recent-tickets');
  applyDrawFilterRule(where, drawFilterRule);

  const tickets = await prisma.ticket.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: parseInt(limit, 10),
    include: {
      draw: { select: { name: true } },
      seller: { select: { fullName: true } },
    },
  });
  res.json(tickets);
});

// ── GET /api/reports/balance-breakdown ──────────────────────────────────────

router.get('/balance-breakdown', authorizeResource('/reports/balance-breakdown'), async (req, res) => {
  const { drawId, userId, fromDate, toDate } = req.query as Record<string, string>;

  const users = await getScopedUsers();
  const userById = new Map(users.map((user): [string, ReportUser] => [user.id, user]));
  const scopedSellerIds = getScopedSellerIds(users, req.user as { sub: string; role: 'admin' | 'asociado' | 'vendedor' });

  if (userId && scopedSellerIds && !scopedSellerIds.has(userId)) {
    res.status(403).json({ message: 'No tienes permisos para consultar este usuario.' });
    return;
  }

  const { filter: createdAtFilter, error } = parseCreatedAtFilter(fromDate, toDate);
  if (error) {
    res.status(400).json({ message: error });
    return;
  }

  const where: Record<string, unknown> = { canceledAt: null };
  if (drawId) where['drawId'] = drawId;
  if (Object.keys(createdAtFilter).length > 0) where['createdAt'] = createdAtFilter;
  if (userId) {
    const descendantIds = getDescendantUserIds(users, userId);
    where['sellerId'] = { in: Array.from(descendantIds) };
  } else if (scopedSellerIds) {
    where['sellerId'] = { in: Array.from(scopedSellerIds) };
  }
  const drawFilterRule = await getDrawFilterRule('reports.balance-breakdown');
  applyDrawFilterRule(where, drawFilterRule);

  interface BreakdownTicket {
    createdAt: Date;
    associateId: string;
    associate: {
      id: string;
      fullName: string;
      plan: {
        multiplier: number;
        commission: number;
      } | null;
    };
    total: number;
    draw: {
      id: string;
      name: string;
      closeTime: Date;
      winnerNumber: string | null;
    };
    lines: Array<{
      number: string;
      amount: number;
    }>;
    seller: {
      id: string;
      fullName: string;
      username: string;
      role: 'asociado' | 'vendedor' | 'admin';
      parentId: string | null;
      plan: {
        multiplier: number;
        commission: number;
      } | null;
    };
  }

  const tickets = (await prisma.ticket.findMany({
    where,
    include: {
      lines: { select: { number: true, amount: true } },
      draw: { select: { id: true, name: true, closeTime: true, winnerNumber: true } },
      associate: {
        select: {
          id: true,
          fullName: true,
          plan: { select: { multiplier: true, commission: true } },
        },
      },
      seller: {
        select: {
          id: true,
          fullName: true,
          username: true,
          role: true,
          parentId: true,
          plan: { select: { multiplier: true, commission: true } },
        },
      },
    },
  })) as BreakdownTicket[];

  const defaultPlan = await prisma.plan.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { multiplier: true, commission: true },
  });

  function normalizeNumber(value: string): string {
    const trimmed = value.trim();
    return trimmed.replace(/^0+(?=\d)/, '');
  }

  function calculateTicketFinancials(ticket: BreakdownTicket): { prizeForTicket: number; commissionForTicket: number } {
    const effectivePlan = ticket.seller.plan ?? ticket.associate.plan ?? defaultPlan;
    const multiplier = effectivePlan?.multiplier ?? 0;
    const commissionRate = (effectivePlan?.commission ?? 0) / 100;

    const winnerNumber = ticket.draw.winnerNumber;
    if (!winnerNumber) {
      return {
        prizeForTicket: 0,
        commissionForTicket: ticket.total * commissionRate,
      };
    }

    const normalizedWinner = normalizeNumber(winnerNumber);
    const prizeForTicket = ticket.lines.reduce((sum, line) => {
      if (normalizeNumber(line.number) !== normalizedWinner) return sum;
      return sum + line.amount * multiplier;
    }, 0);

    return {
      prizeForTicket,
      commissionForTicket: ticket.total * commissionRate,
    };
  }

  interface BreakdownAccumulator {
    userId: string;
    fullName: string;
    username: string;
    role: 'asociado' | 'vendedor' | 'admin';
    parentId: string | null;
    ticketCount: number;
    totalSales: number;
    totalPrizes: number;
    totalCommissions: number;
    totalAssociateCommissions: number;
  }

  const bySeller = new Map<string, BreakdownAccumulator>();
  for (const ticket of tickets) {
    const seller = ticket.seller;
    const { prizeForTicket, commissionForTicket } = calculateTicketFinancials(ticket);
    const associatePlan = ticket.associate.plan ?? defaultPlan;
    const associateCommissionRate = (associatePlan?.commission ?? 0) / 100;
    const associateCommissionForTicket = ticket.total * associateCommissionRate;

    const current = bySeller.get(seller.id) ?? {
      userId: seller.id,
      fullName: seller.fullName,
      username: seller.username,
      role: seller.role,
      parentId: seller.parentId,
      ticketCount: 0,
      totalSales: 0,
      totalPrizes: 0,
      totalCommissions: 0,
      totalAssociateCommissions: 0,
    };

    current.ticketCount += 1;
    current.totalSales += ticket.total;
    current.totalPrizes += prizeForTicket;
    current.totalCommissions += commissionForTicket;
    current.totalAssociateCommissions += associateCommissionForTicket;
    bySeller.set(seller.id, current);
  }

  const roleOrder: Record<'asociado' | 'vendedor' | 'admin', number> = {
    asociado: 0,
    vendedor: 1,
    admin: 2,
  };

  const rows = Array.from(bySeller.values())
    .map((row) => {
      const parent = row.parentId ? userById.get(row.parentId) : null;
      return {
        userId: row.userId,
        fullName: row.fullName,
        username: row.username,
        role: row.role,
        parentName: parent?.fullName ?? null,
        ticketCount: row.ticketCount,
        totalSales: row.totalSales,
        totalPrizes: row.totalPrizes,
        totalCommissions: row.totalCommissions,
        totalAssociateCommissions: row.totalAssociateCommissions,
        balance: row.totalSales - row.totalPrizes,
      };
    })
    .sort((a, b) => {
      if (roleOrder[a.role] !== roleOrder[b.role]) {
        return roleOrder[a.role] - roleOrder[b.role];
      }
      return b.totalSales - a.totalSales;
    });

  const totals = rows.reduce(
    (acc, row) => ({
      ticketCount: acc.ticketCount + row.ticketCount,
      totalSales: acc.totalSales + row.totalSales,
      totalPrizes: acc.totalPrizes + row.totalPrizes,
      totalCommissions: acc.totalCommissions + row.totalCommissions,
      totalAssociateCommissions: acc.totalAssociateCommissions + row.totalAssociateCommissions,
      balance: acc.balance + row.balance,
    }),
    {
      ticketCount: 0,
      totalSales: 0,
      totalPrizes: 0,
      totalCommissions: 0,
      totalAssociateCommissions: 0,
      balance: 0,
    }
  );

  const byVendor = new Map<string, {
    vendorId: string;
    vendorName: string;
    ticketCount: number;
    totalSales: number;
    totalPrizes: number;
    totalCommissions: number;
    totalAssociateCommissions: number;
    balance: number;
  }>();

  for (const ticket of tickets) {
    const seller = ticket.seller;
    if (seller.role === 'admin') continue;

    const { prizeForTicket, commissionForTicket } = calculateTicketFinancials(ticket);
    const associatePlan = ticket.associate.plan ?? defaultPlan;
    const associateCommissionRate = (associatePlan?.commission ?? 0) / 100;
    const associateCommissionForTicket = ticket.total * associateCommissionRate;

    const current = byVendor.get(seller.id) ?? {
      vendorId: seller.id,
      vendorName: seller.fullName,
      ticketCount: 0,
      totalSales: 0,
      totalPrizes: 0,
      totalCommissions: 0,
      totalAssociateCommissions: 0,
      balance: 0,
    };

    current.ticketCount += 1;
    current.totalSales += ticket.total;
    current.totalPrizes += prizeForTicket;
    current.totalCommissions += commissionForTicket;
    current.totalAssociateCommissions += associateCommissionForTicket;
    current.balance = current.totalSales - current.totalPrizes;
    byVendor.set(seller.id, current);
  }

  const vendorRows = Array.from(byVendor.values()).sort((a, b) => b.totalSales - a.totalSales);
  const vendorTotals = vendorRows.reduce(
    (acc, row) => ({
      ticketCount: acc.ticketCount + row.ticketCount,
      totalSales: acc.totalSales + row.totalSales,
      totalPrizes: acc.totalPrizes + row.totalPrizes,
      totalCommissions: acc.totalCommissions + row.totalCommissions,
      totalAssociateCommissions: acc.totalAssociateCommissions + row.totalAssociateCommissions,
      balance: acc.balance + row.balance,
    }),
    {
      ticketCount: 0,
      totalSales: 0,
      totalPrizes: 0,
      totalCommissions: 0,
      totalAssociateCommissions: 0,
      balance: 0,
    }
  );

  const byDraw = new Map<string, {
    drawId: string;
    drawName: string;
    ticketCount: number;
    totalSales: number;
    totalPrizes: number;
    totalCommissions: number;
    totalAssociateCommissions: number;
    balance: number;
  }>();

  for (const ticket of tickets) {
    const { prizeForTicket, commissionForTicket } = calculateTicketFinancials(ticket);
    const associatePlan = ticket.associate.plan ?? defaultPlan;
    const associateCommissionRate = (associatePlan?.commission ?? 0) / 100;
    const associateCommissionForTicket = ticket.total * associateCommissionRate;

    const current = byDraw.get(ticket.draw.id) ?? {
      drawId: ticket.draw.id,
      drawName: ticket.draw.name,
      ticketCount: 0,
      totalSales: 0,
      totalPrizes: 0,
      totalCommissions: 0,
      totalAssociateCommissions: 0,
      balance: 0,
    };

    current.ticketCount += 1;
    current.totalSales += ticket.total;
    current.totalPrizes += prizeForTicket;
    current.totalCommissions += commissionForTicket;
    current.totalAssociateCommissions += associateCommissionForTicket;
    current.balance = current.totalSales - current.totalPrizes;
    byDraw.set(ticket.draw.id, current);
  }

  const drawRows = Array.from(byDraw.values()).sort((a, b) => b.totalSales - a.totalSales);
  const drawTotals = drawRows.reduce(
    (acc, row) => ({
      ticketCount: acc.ticketCount + row.ticketCount,
      totalSales: acc.totalSales + row.totalSales,
      totalPrizes: acc.totalPrizes + row.totalPrizes,
      totalCommissions: acc.totalCommissions + row.totalCommissions,
      totalAssociateCommissions: acc.totalAssociateCommissions + row.totalAssociateCommissions,
      balance: acc.balance + row.balance,
    }),
    {
      ticketCount: 0,
      totalSales: 0,
      totalPrizes: 0,
      totalCommissions: 0,
      totalAssociateCommissions: 0,
      balance: 0,
    }
  );

  let parentId: string | null = null;
  if (userId) {
    parentId = userId;
  } else if (req.user!.role !== 'admin') {
    parentId = req.user!.sub;
  }

  // Build children map for depth-first traversal
  const childrenMap = new Map<string, ReportUser[]>();
  for (const u of users) {
    if (u.parentId) {
      const list = childrenMap.get(u.parentId) ?? [];
      list.push(u);
      childrenMap.set(u.parentId, list);
    }
  }

  const rootUsers: ReportUser[] = [];
  if (parentId) {
    const rootUser = userById.get(parentId);
    if (rootUser) {
      rootUsers.push(rootUser);
    }
  } else {
    for (const u of users) {
      if (!u.parentId || !userById.has(u.parentId)) {
        rootUsers.push(u);
      }
    }
    rootUsers.sort((a, b) => a.fullName.localeCompare(b.fullName));
  }

  interface OrderedUser {
    user: ReportUser;
    depth: number;
  }
  const orderedUsers: OrderedUser[] = [];

  const visit = (u: ReportUser, depth: number) => {
    orderedUsers.push({ user: u, depth });
    const children = childrenMap.get(u.id) ?? [];
    children.sort((a, b) => a.fullName.localeCompare(b.fullName));
    for (const child of children) {
      visit(child, depth + 1);
    }
  };

  for (const root of rootUsers) {
    visit(root, 0);
  }

  const byUser = new Map<string, {
    userId: string;
    userName: string;
    ticketCount: number;
    totalSales: number;
    totalPrizes: number;
    totalCommissions: number;
    totalAssociateCommissions: number;
    balance: number;
    draws: Map<string, {
      drawId: string;
      drawName: string;
      drawCloseTime: string;
      lastTicketCreatedAt: string;
      ticketCount: number;
      totalSales: number;
      totalPrizes: number;
      totalCommissions: number;
      totalAssociateCommissions: number;
      balance: number;
    }>;
  }>();

  for (const ticket of tickets) {
    const { prizeForTicket, commissionForTicket } = calculateTicketFinancials(ticket);
    const associatePlan = ticket.associate.plan ?? defaultPlan;
    const associateCommissionRate = (associatePlan?.commission ?? 0) / 100;
    const associateCommissionForTicket = ticket.total * associateCommissionRate;

    const sellerId = ticket.seller.id;
    const sellerName = ticket.seller.fullName;

    const current = byUser.get(sellerId) ?? {
      userId: sellerId,
      userName: sellerName,
      ticketCount: 0,
      totalSales: 0,
      totalPrizes: 0,
      totalCommissions: 0,
      totalAssociateCommissions: 0,
      balance: 0,
      draws: new Map(),
    };

    current.ticketCount += 1;
    current.totalSales += ticket.total;
    current.totalPrizes += prizeForTicket;
    current.totalCommissions += commissionForTicket;
    current.totalAssociateCommissions += associateCommissionForTicket;
    current.balance = current.totalSales - current.totalPrizes;

    const drawCurrent = current.draws.get(ticket.draw.id) ?? {
      drawId: ticket.draw.id,
      drawName: ticket.draw.name,
      drawCloseTime: ticket.draw.closeTime.toISOString(),
      lastTicketCreatedAt: ticket.createdAt.toISOString(),
      ticketCount: 0,
      totalSales: 0,
      totalPrizes: 0,
      totalCommissions: 0,
      totalAssociateCommissions: 0,
      balance: 0,
    };

    drawCurrent.ticketCount += 1;
    drawCurrent.totalSales += ticket.total;
    drawCurrent.totalPrizes += prizeForTicket;
    drawCurrent.totalCommissions += commissionForTicket;
    drawCurrent.totalAssociateCommissions += associateCommissionForTicket;
    drawCurrent.balance = drawCurrent.totalSales - drawCurrent.totalPrizes;
    if (ticket.createdAt.toISOString() > drawCurrent.lastTicketCreatedAt) {
      drawCurrent.lastTicketCreatedAt = ticket.createdAt.toISOString();
    }

    current.draws.set(ticket.draw.id, drawCurrent);
    byUser.set(sellerId, current);
  }

  function hasSalesOrDescendantHasSales(userId: string): boolean {
    if (byUser.has(userId)) return true;
    const descendants = getDescendantUserIds(users, userId);
    for (const dId of descendants) {
      if (byUser.has(dId)) return true;
    }
    return false;
  }

  const associateRows = [];
  const rootUserIds = new Set(rootUsers.map((u) => u.id));

  for (const { user, depth } of orderedUsers) {
    if (!hasSalesOrDescendantHasSales(user.id)) continue;

    const descendantIds = getDescendantUserIds(users, user.id);

    let ticketCount = 0;
    let totalSales = 0;
    let totalPrizes = 0;
    let totalCommissions = 0;
    let totalAssociateCommissions = 0;
    let balance = 0;

    for (const dId of descendantIds) {
      const data = byUser.get(dId);
      if (!data) continue;

      ticketCount += data.ticketCount;
      totalSales += data.totalSales;
      totalPrizes += data.totalPrizes;
      totalCommissions += data.totalCommissions;
      totalAssociateCommissions += data.totalAssociateCommissions;
      balance += data.balance;
    }

    const roleLabel = user.role === 'vendedor' ? 'Vendedor' : user.role === 'asociado' ? 'Asociado' : 'Admin';
    const indent = '\u00A0'.repeat(depth * 4);
    const formattedName = `${indent}${user.fullName} (${user.username}) [${roleLabel}]`;

    const directData = byUser.get(user.id);
    const drawsList = directData
      ? Array.from(directData.draws.values()).sort((a, b) => b.lastTicketCreatedAt.localeCompare(a.lastTicketCreatedAt))
      : [];

    associateRows.push({
      associateId: user.id,
      associateName: formattedName,
      parentId: user.parentId,
      ticketCount,
      totalSales,
      totalPrizes,
      totalCommissions,
      totalAssociateCommissions,
      balance,
      draws: drawsList,
    });
  }

  const associateTotals = associateRows
    .filter((row) => rootUserIds.has(row.associateId))
    .reduce(
      (acc, row) => ({
        ticketCount: acc.ticketCount + row.ticketCount,
        totalSales: acc.totalSales + row.totalSales,
        totalPrizes: acc.totalPrizes + row.totalPrizes,
        totalCommissions: acc.totalCommissions + row.totalCommissions,
        totalAssociateCommissions: acc.totalAssociateCommissions + row.totalAssociateCommissions,
        balance: acc.balance + row.balance,
      }),
      {
        ticketCount: 0,
        totalSales: 0,
        totalPrizes: 0,
        totalCommissions: 0,
        totalAssociateCommissions: 0,
        balance: 0,
      }
    );

  res.json({
    filters: {
      drawId: drawId || null,
      userId: userId || null,
      fromDate: fromDate || null,
      toDate: toDate || null,
    },
    totals,
    rows,
    byVendor: {
      totals: vendorTotals,
      rows: vendorRows,
    },
    byDraw: {
      totals: drawTotals,
      rows: drawRows,
    },
    byAssociate: {
      totals: associateTotals,
      rows: associateRows,
    },
  });
});

// ── GET /api/reports/sales-by-user ──────────────────────────────────────────

router.get('/sales-by-user', authorizeResource('/reports/sales-by-user'), async (req, res) => {
  const { drawId, userId, fromDate, toDate } = req.query as Record<string, string>;

  const users = await getScopedUsers();
  const scopedSellerIds = getScopedSellerIds(users, req.user as { sub: string; role: 'admin' | 'asociado' | 'vendedor' });

  if (userId && scopedSellerIds && !scopedSellerIds.has(userId)) {
    res.status(403).json({ message: 'No tienes permisos para consultar este usuario.' });
    return;
  }

  const { filter: createdAtFilter, error } = parseCreatedAtFilter(fromDate, toDate);
  if (error) {
    res.status(400).json({ message: error });
    return;
  }

  const where: Record<string, unknown> = {};
  if (drawId) where['drawId'] = drawId;
  if (Object.keys(createdAtFilter).length > 0) where['createdAt'] = createdAtFilter;
  if (userId) {
    where['sellerId'] = userId;
  } else if (scopedSellerIds) {
    where['sellerId'] = { in: Array.from(scopedSellerIds) };
  }
  const drawFilterRule = await getDrawFilterRule('reports.sales-by-user');
  applyDrawFilterRule(where, drawFilterRule);

  const tickets = await prisma.ticket.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      draw: {
        select: {
          id: true,
          name: true,
          closeTime: true,
          winnerNumber: true,
          specialMultiplier: { select: { id: true, name: true, value: true } },
        },
      },
      lines: { select: { number: true, amount: true, specialAmount: true } },
      seller: {
        select: {
          id: true,
          fullName: true,
          username: true,
          plan: { select: { id: true, name: true, multiplier: true } },
        },
      },
      associate: {
        select: {
          id: true,
          fullName: true,
        },
      },
      canceledBy: {
        select: {
          id: true,
          fullName: true,
          username: true,
        },
      },
    },
  });

  const bySeller = new Map<string, {
    userId: string;
    fullName: string;
    username: string;
    role: 'admin' | 'asociado' | 'vendedor';
    ticketCount: number;
    activeTicketCount: number;
    canceledTicketCount: number;
    totalSales: number;
  }>();

  for (const ticket of tickets) {
    const sellerInfo = users.find((user) => user.id === ticket.sellerId);
    const role = sellerInfo?.role ?? 'vendedor';
    const current = bySeller.get(ticket.sellerId) ?? {
      userId: ticket.sellerId,
      fullName: ticket.seller?.fullName ?? sellerInfo?.fullName ?? 'Sin nombre',
      username: ticket.seller?.username ?? sellerInfo?.username ?? 'sin-usuario',
      role,
      ticketCount: 0,
      activeTicketCount: 0,
      canceledTicketCount: 0,
      totalSales: 0,
    };

    current.ticketCount += 1;
    if (ticket.canceledAt) {
      current.canceledTicketCount += 1;
    } else {
      current.activeTicketCount += 1;
      current.totalSales += ticket.total;
    }

    bySeller.set(ticket.sellerId, current);
  }

  const roleOrder: Record<'admin' | 'asociado' | 'vendedor', number> = {
    admin: 0,
    asociado: 1,
    vendedor: 2,
  };

  const rows = Array.from(bySeller.values()).sort((a, b) => {
    if (roleOrder[a.role] !== roleOrder[b.role]) {
      return roleOrder[a.role] - roleOrder[b.role];
    }
    return b.totalSales - a.totalSales;
  });

  const totals = rows.reduce(
    (acc, row) => ({
      ticketCount: acc.ticketCount + row.ticketCount,
      activeTicketCount: acc.activeTicketCount + row.activeTicketCount,
      canceledTicketCount: acc.canceledTicketCount + row.canceledTicketCount,
      totalSales: acc.totalSales + row.totalSales,
    }),
    {
      ticketCount: 0,
      activeTicketCount: 0,
      canceledTicketCount: 0,
      totalSales: 0,
    }
  );

  res.json({
    filters: {
      drawId: drawId || null,
      userId: userId || null,
      fromDate: fromDate || null,
      toDate: toDate || null,
    },
    totals,
    rows,
    tickets,
  });
});

// ── GET /api/reports/draw-lists ─────────────────────────────────────────────

router.get('/draw-lists', authorizeResource('/reports/draw-lists'), async (req, res) => {
  const { drawId, userId, fromDate, toDate } = req.query as Record<string, string>;

  const users = await getScopedUsers();
  const scopedSellerIds = getScopedSellerIds(users, req.user as { sub: string; role: 'admin' | 'asociado' | 'vendedor' });

  if (userId && scopedSellerIds && !scopedSellerIds.has(userId)) {
    res.status(403).json({ message: 'No tienes permisos para consultar este usuario.' });
    return;
  }

  const { filter: createdAtFilter, error } = parseCreatedAtFilter(fromDate, toDate);
  if (error) {
    res.status(400).json({ message: error });
    return;
  }

  const where: Record<string, unknown> = { canceledAt: null };
  if (drawId) where['drawId'] = drawId;
  if (Object.keys(createdAtFilter).length > 0) where['createdAt'] = createdAtFilter;
  if (userId) {
    where['sellerId'] = userId;
  } else if (scopedSellerIds) {
    where['sellerId'] = { in: Array.from(scopedSellerIds) };
  }
  const drawFilterRule = await getDrawFilterRule('reports.draw-lists');
  applyDrawFilterRule(where, drawFilterRule);

  const tickets = await prisma.ticket.findMany({
    where,
    select: {
      id: true,
      lines: { select: { number: true, amount: true } },
    },
  });

  const numbers = Array.from({ length: 100 }, (_, index) => ({
    number: index.toString().padStart(2, '0'),
    total: 0,
  }));
  const byNumber = new Map(numbers.map((row) => [row.number, row]));

  for (const ticket of tickets) {
    for (const line of ticket.lines) {
      const key = line.number.trim().padStart(2, '0').slice(-2);
      const current = byNumber.get(key);
      if (!current) continue;
      current.total += line.amount;
    }
  }

  res.json({
    filters: {
      drawId: drawId || null,
      userId: userId || null,
      fromDate: fromDate || null,
      toDate: toDate || null,
    },
    totals: {
      ticketCount: tickets.length,
      totalAmount: numbers.reduce((sum, row) => sum + row.total, 0),
    },
    numbers,
  });
});

// ── GET /api/reports/commissions ────────────────────────────────────────────

router.get('/commissions', authorizeResource('/reports/commissions'), async (req, res) => {
  const { drawId, userId, fromDate, toDate } = req.query as Record<string, string>;

  const users = await getScopedUsers();
  const scopedSellerIds = getScopedSellerIds(users, req.user as { sub: string; role: 'admin' | 'asociado' | 'vendedor' });

  if (userId && scopedSellerIds && !scopedSellerIds.has(userId)) {
    res.status(403).json({ message: 'No tienes permisos para consultar este usuario.' });
    return;
  }

  const { filter: createdAtFilter, error } = parseCreatedAtFilter(fromDate, toDate);
  if (error) {
    res.status(400).json({ message: error });
    return;
  }

  const where: Record<string, unknown> = { canceledAt: null };
  if (drawId) where['drawId'] = drawId;
  if (Object.keys(createdAtFilter).length > 0) where['createdAt'] = createdAtFilter;
  if (userId) {
    const descendantIds = getDescendantUserIds(users, userId);
    where['sellerId'] = { in: Array.from(descendantIds) };
  } else if (scopedSellerIds) {
    where['sellerId'] = { in: Array.from(scopedSellerIds) };
  }
  const drawFilterRule = await getDrawFilterRule('reports.commissions');
  applyDrawFilterRule(where, drawFilterRule);

  const defaultPlan = await prisma.plan.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { commission: true },
  });

  const tickets = await prisma.ticket.findMany({
    where,
    select: {
      createdAt: true,
      total: true,
      draw: {
        select: {
          id: true,
          name: true,
          closeTime: true,
        },
      },
      seller: {
        select: {
          id: true,
          fullName: true,
          username: true,
          plan: { select: { commission: true } },
        },
      },
      associate: {
        select: {
          plan: { select: { commission: true } },
        },
      },
    },
    orderBy: [
      { seller: { fullName: 'asc' } },
      { createdAt: 'desc' },
    ],
  });

  const bySeller = new Map<string, {
    sellerId: string;
    sellerName: string;
    sellerUsername: string;
    totalSales: number;
    subtotal: number;
    rows: Map<string, { drawId: string; drawName: string; drawCloseTime: string; totalSales: number; commission: number }>;
  }>();

  for (const ticket of tickets) {
    const commissionRate = (ticket.seller.plan?.commission ?? ticket.associate.plan?.commission ?? defaultPlan?.commission ?? 0) / 100;
    const commission = ticket.total * commissionRate;

    const current = bySeller.get(ticket.seller.id) ?? {
      sellerId: ticket.seller.id,
      sellerName: ticket.seller.fullName,
      sellerUsername: ticket.seller.username,
      totalSales: 0,
      subtotal: 0,
      rows: new Map<string, { drawId: string; drawName: string; drawCloseTime: string; totalSales: number; commission: number }>(),
    };

    current.totalSales += ticket.total;
    current.subtotal += commission;

    const row = current.rows.get(ticket.draw.id) ?? {
      drawId: ticket.draw.id,
      drawName: ticket.draw.name,
      drawCloseTime: ticket.draw.closeTime.toISOString(),
      totalSales: 0,
      commission: 0,
    };
    row.totalSales += ticket.total;
    row.commission += commission;

    current.rows.set(ticket.draw.id, row);
    bySeller.set(ticket.seller.id, current);
  }

  let parentId: string | null = null;
  if (userId) {
    parentId = userId;
  } else if (req.user!.role !== 'admin') {
    parentId = req.user!.sub;
  }

  // Build children map for depth-first traversal
  const childrenMap = new Map<string, ReportUser[]>();
  for (const u of users) {
    if (u.parentId) {
      const list = childrenMap.get(u.parentId) ?? [];
      list.push(u);
      childrenMap.set(u.parentId, list);
    }
  }

  const userById = new Map(users.map((user): [string, ReportUser] => [user.id, user]));

  const rootUsers: ReportUser[] = [];
  if (parentId) {
    const rootUser = userById.get(parentId);
    if (rootUser) {
      rootUsers.push(rootUser);
    }
  } else {
    for (const u of users) {
      if (!u.parentId || !userById.has(u.parentId)) {
        rootUsers.push(u);
      }
    }
    rootUsers.sort((a, b) => a.fullName.localeCompare(b.fullName));
  }

  interface OrderedUser {
    user: ReportUser;
    depth: number;
  }
  const orderedUsers: OrderedUser[] = [];

  const visit = (u: ReportUser, depth: number) => {
    orderedUsers.push({ user: u, depth });
    const children = childrenMap.get(u.id) ?? [];
    children.sort((a, b) => a.fullName.localeCompare(b.fullName));
    for (const child of children) {
      visit(child, depth + 1);
    }
  };

  for (const root of rootUsers) {
    visit(root, 0);
  }

  function hasSalesOrDescendantHasSales(uId: string): boolean {
    if (bySeller.has(uId)) return true;
    const descendants = getDescendantUserIds(users, uId);
    for (const dId of descendants) {
      if (bySeller.has(dId)) return true;
    }
    return false;
  }

  const sellerRows = [];
  const rootUserIds = new Set(rootUsers.map((u) => u.id));

  for (const { user, depth } of orderedUsers) {
    if (!hasSalesOrDescendantHasSales(user.id)) continue;

    const descendantIds = getDescendantUserIds(users, user.id);

    let totalSales = 0;
    let subtotal = 0;

    for (const dId of descendantIds) {
      const data = bySeller.get(dId);
      if (!data) continue;

      totalSales += data.totalSales;
      subtotal += data.subtotal;
    }

    const roleLabel = user.role === 'vendedor' ? 'Vendedor' : user.role === 'asociado' ? 'Asociado' : 'Admin';
    const indent = '\u00A0'.repeat(depth * 4);
    const formattedName = `${indent}${user.fullName} (${user.username}) [${roleLabel}]`;

    const directData = bySeller.get(user.id);
    const drawsList = directData
      ? Array.from(directData.rows.values()).sort((a, b) => b.drawCloseTime.localeCompare(a.drawCloseTime))
      : [];

    sellerRows.push({
      sellerId: user.id,
      sellerName: formattedName,
      sellerUsername: user.username,
      parentId: user.parentId,
      totalSales,
      subtotal,
      rows: drawsList,
    });
  }

  const rootSellerRows = sellerRows.filter((r) => rootUserIds.has(r.sellerId));

  const totals = {
    totalSales: rootSellerRows.reduce((sum, r) => sum + r.totalSales, 0),
    totalCommissions: rootSellerRows.reduce((sum, r) => sum + r.subtotal, 0),
  };

  res.json({
    filters: {
      drawId: drawId || null,
      userId: userId || null,
      fromDate: fromDate || null,
      toDate: toDate || null,
    },
    totals,
    bySeller: sellerRows,
  });
});

export default router;
