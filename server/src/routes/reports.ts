import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { authenticate, authorizeAnyResource, authorizeResource } from '../middleware/auth.js';

type Stats = { totalSales: number; ticketCount: number };
type Role = 'admin' | 'asociado' | 'vendedor';

interface HierarchyUser {
  id: string;
  fullName: string;
  username: string;
  role: Role;
  parentId: string | null;
}

const router = Router();
router.use(authenticate);

async function getHierarchyUsers(): Promise<HierarchyUser[]> {
  return prisma.user.findMany({
    select: {
      id: true,
      fullName: true,
      username: true,
      role: true,
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

function parseCreatedAtFilter(query: Record<string, string>): {
  filter: Record<string, Date>;
  error?: string;
} {
  const { fromDate, toDate } = query;
  const filter: Record<string, Date> = {};

  if (fromDate) {
    const parsed = new Date(`${fromDate}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      return { filter: {}, error: 'fromDate inválida. Use formato YYYY-MM-DD.' };
    }
    filter['gte'] = parsed;
  }

  if (toDate) {
    const parsed = new Date(`${toDate}T23:59:59.999`);
    if (Number.isNaN(parsed.getTime())) {
      return { filter: {}, error: 'toDate inválida. Use formato YYYY-MM-DD.' };
    }
    filter['lte'] = parsed;
  }

  if (filter['gte'] && filter['lte'] && filter['gte'] > filter['lte']) {
    return { filter: {}, error: 'Rango de fechas inválido.' };
  }

  return { filter };
}

// ── GET /api/reports/summary ──────────────────────────────────────────────────

router.get('/summary', authorizeAnyResource('/dashboard', '/reports/sales-stats'), async (req, res) => {
  const query = req.query as Record<string, string>;
  const { drawId } = query;

  const { filter: createdAtFilter, error } = parseCreatedAtFilter(query);
  if (error) {
    res.status(400).json({ message: error });
    return;
  }

  const ticketWhere: Record<string, unknown> = {};
  if (drawId) ticketWhere['drawId'] = drawId;
  if (Object.keys(createdAtFilter).length > 0) ticketWhere['createdAt'] = createdAtFilter;
  ticketWhere['canceledAt'] = null;

  let scopedUserIds: Set<string> | null = null;

  if (req.user!.role !== 'admin') {
    const users = await getHierarchyUsers();
    const currentScopedUserIds =
      req.user!.role === 'asociado'
        ? getDescendantUserIds(users, req.user!.sub)
        : new Set<string>([req.user!.sub]);
    scopedUserIds = currentScopedUserIds;

    const sellerIds = users
      .filter((u) => currentScopedUserIds.has(u.id))
      .map((u) => u.id);

    ticketWhere['sellerId'] = { in: sellerIds };
  }

  const userCountWhere: Record<string, unknown> = { status: 'activo' };
  if (scopedUserIds) {
    userCountWhere['id'] = { in: Array.from(scopedUserIds) };
  }

  interface SummaryTicket {
    total: number;
    lines: Array<{ number: string; amount: number; specialAmount: number | null }>;
    draw: {
      winnerNumber: string | null;
      specialMultiplier: { value: number } | null;
    };
    seller: { plan: { multiplier: number; commission: number } | null };
    associate: { plan: { multiplier: number; commission: number } | null };
  }

  const [ticketCount, totalResult, userCount, drawCount, tickets, defaultPlan] = await Promise.all([
    prisma.ticket.count({ where: ticketWhere }),
    prisma.ticket.aggregate({ where: ticketWhere, _sum: { total: true } }),
    prisma.user.count({ where: userCountWhere }),
    prisma.draw.count(),
    prisma.ticket.findMany({
      where: ticketWhere,
      select: {
        total: true,
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
    }) as Promise<SummaryTicket[]>,
    prisma.plan.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { multiplier: true, commission: true },
    }),
  ]);

  function normalizeNumber(value: string): string {
    const trimmed = value.trim();
    return trimmed.replace(/^0+(?=\d)/, '');
  }

  const financialTotals = tickets.reduce(
    (acc, ticket) => {
      const effectivePlan = ticket.seller.plan ?? ticket.associate.plan ?? defaultPlan;
      const regularMultiplier = effectivePlan?.multiplier ?? 0;
      const commissionRate = (effectivePlan?.commission ?? 0) / 100;
      const specialMultiplierValue = ticket.draw.specialMultiplier?.value ?? null;

      acc.totalCommissions += ticket.total * commissionRate;

      const winnerNumber = ticket.draw.winnerNumber;
      if (!winnerNumber) {
        return acc;
      }

      const normalizedWinner = normalizeNumber(winnerNumber);
      const prizeForTicket = ticket.lines.reduce((sum, line) => {
        if (normalizeNumber(line.number) !== normalizedWinner) return sum;
        if (specialMultiplierValue !== null && (line.specialAmount ?? 0) > 0) {
          return sum + (line.amount + (line.specialAmount ?? 0)) * regularMultiplier * specialMultiplierValue;
        }
        return sum + line.amount * regularMultiplier;
      }, 0);

      acc.totalPrizes += prizeForTicket;
      return acc;
    },
    { totalPrizes: 0, totalCommissions: 0 }
  );

  res.json({
    ticketCount,
    totalSales: totalResult._sum.total ?? 0,
    totalPrizes: financialTotals.totalPrizes,
    totalCommissions: financialTotals.totalCommissions,
    userCount,
    drawCount,
  });
});

// ── GET /api/reports/top-numbers ──────────────────────────────────────────────

router.get('/top-numbers', async (req, res) => {
  const query = req.query as Record<string, string>;
  const { drawId, limit = '10' } = query;

  const { filter: createdAtFilter, error } = parseCreatedAtFilter(query);
  if (error) {
    res.status(400).json({ message: error });
    return;
  }

  const ticketWhere: Record<string, unknown> = {};
  if (drawId) ticketWhere['drawId'] = drawId;
  if (Object.keys(createdAtFilter).length > 0) ticketWhere['createdAt'] = createdAtFilter;
  ticketWhere['canceledAt'] = null;
  if (req.user!.role === 'asociado') {
    ticketWhere['associateId'] = req.user!.sub;
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

// ── GET /api/reports/recent-tickets ──────────────────────────────────────────

router.get('/recent-tickets', authorizeAnyResource('/dashboard', '/reports/sales-stats'), async (req, res) => {
  const query = req.query as Record<string, string>;
  const { drawId, limit = '10' } = query;

  const { filter: createdAtFilter, error } = parseCreatedAtFilter(query);
  if (error) {
    res.status(400).json({ message: error });
    return;
  }

  const where: Record<string, unknown> = {};
  if (drawId) where['drawId'] = drawId;
  if (Object.keys(createdAtFilter).length > 0) where['createdAt'] = createdAtFilter;
  where['canceledAt'] = null;

  if (req.user!.role !== 'admin') {
    const users = await getHierarchyUsers();
    const scopedUserIds =
      req.user!.role === 'asociado'
        ? getDescendantUserIds(users, req.user!.sub)
        : new Set<string>([req.user!.sub]);

    const sellerIds = users
      .filter((u) => scopedUserIds.has(u.id))
      .map((u) => u.id);

    where['sellerId'] = { in: sellerIds };
  }

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

router.use(authorizeResource('/reports'));

// ── GET /api/reports/hierarchy ────────────────────────────────────────────────

router.get('/hierarchy', authorizeResource('/reports/sales-stats'), async (req, res) => {
  const query = req.query as Record<string, string>;
  const { drawId } = query;

  const { filter: createdAtFilter, error } = parseCreatedAtFilter(query);
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
  const ticketWhere: Record<string, unknown> = {};
  if (drawId) ticketWhere['drawId'] = drawId;
  if (Object.keys(createdAtFilter).length > 0) ticketWhere['createdAt'] = createdAtFilter;
  ticketWhere['canceledAt'] = null;

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

  // For asociados show only their subtree; for admins show the full tree
  let tree: TreeNode[];
  if (req.user!.role === 'asociado') {
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

// ── GET /api/reports/balance-breakdown ──────────────────────────────────────

router.get('/balance-breakdown', authorizeResource('/reports/balance-breakdown'), async (req, res) => {
  const { drawId, userId, fromDate, toDate } = req.query as Record<string, string>;

  interface BreakdownUser {
    id: string;
    fullName: string;
    username: string;
    role: 'admin' | 'asociado' | 'vendedor';
    parentId: string | null;
  }

  const users = (await prisma.user.findMany({
    select: {
      id: true,
      fullName: true,
      username: true,
      role: true,
      parentId: true,
    },
  })) as BreakdownUser[];

  const userById = new Map<string, BreakdownUser>(
    users.map((u): [string, BreakdownUser] => [u.id, u])
  );

  const createdAtFilter: Record<string, Date> = {};
  if (fromDate) {
    const parsed = new Date(`${fromDate}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      res.status(400).json({ message: 'fromDate inválida. Use formato YYYY-MM-DD.' });
      return;
    }
    createdAtFilter['gte'] = parsed;
  }
  if (toDate) {
    const parsed = new Date(`${toDate}T23:59:59.999`);
    if (Number.isNaN(parsed.getTime())) {
      res.status(400).json({ message: 'toDate inválida. Use formato YYYY-MM-DD.' });
      return;
    }
    createdAtFilter['lte'] = parsed;
  }

  if (createdAtFilter['gte'] && createdAtFilter['lte'] && createdAtFilter['gte'] > createdAtFilter['lte']) {
    res.status(400).json({ message: 'Rango de fechas inválido.' });
    return;
  }

  const descendantSellerIds = new Set<string>();
  if (req.user!.role === 'asociado') {
    const walk = (parentId: string) => {
      descendantSellerIds.add(parentId);
      users
        .filter((u: BreakdownUser) => u.parentId === parentId)
        .forEach((child: BreakdownUser) => walk(child.id));
    };
    walk(req.user!.sub);
  }

  const where: Record<string, unknown> = {};
  if (drawId) where['drawId'] = drawId;
  if (userId) where['sellerId'] = userId;
  if (Object.keys(createdAtFilter).length > 0) where['createdAt'] = createdAtFilter;
  where['canceledAt'] = null;
  if (req.user!.role === 'asociado') {
    where['sellerId'] = { in: Array.from(descendantSellerIds) };
  }

  interface BreakdownTicket {
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
    lines: Array<{
      number: string;
      amount: number;
      specialAmount: number | null;
    }>;
    draw: {
      id: string;
      name: string;
      closeTime: Date;
      winnerNumber: string | null;
      specialMultiplier: { id: string; name: string; value: number } | null;
    };
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
      lines: { select: { number: true, amount: true, specialAmount: true } },
      draw: {
        select: {
          id: true,
          name: true,
          closeTime: true,
          winnerNumber: true,
          specialMultiplier: { select: { id: true, name: true, value: true } },
        },
      },
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
    const regularMultiplier = effectivePlan?.multiplier ?? 0;
    const commissionRate = (effectivePlan?.commission ?? 0) / 100;
    const specialMultiplierValue = ticket.draw.specialMultiplier?.value ?? null;

    const winnerNumber = ticket.draw.winnerNumber;
    if (!winnerNumber) {
      return {
        prizeForTicket: 0,
        commissionForTicket: ticket.total * commissionRate,
      };
    }

    const normalizedWinner = normalizeNumber(winnerNumber);
    const prizeForTicket = ticket.lines.reduce((sum: number, line: { number: string; amount: number; specialAmount: number | null }) => {
      if (normalizeNumber(line.number) !== normalizedWinner) return sum;
      if (specialMultiplierValue !== null && (line.specialAmount ?? 0) > 0) {
        // Formula: (montoRegular + montoEspecial) * multiplicadorRegular * multiplicadorEspecial
        return sum + (line.amount + (line.specialAmount ?? 0)) * regularMultiplier * specialMultiplierValue;
      }
      return sum + line.amount * regularMultiplier;
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
  }

  const bySeller = new Map<string, BreakdownAccumulator>();

  for (const ticket of tickets) {
    const seller = ticket.seller;
    const { prizeForTicket, commissionForTicket } = calculateTicketFinancials(ticket);

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
    };

    current.ticketCount += 1;
    current.totalSales += ticket.total;
    current.totalPrizes += prizeForTicket;
    current.totalCommissions += commissionForTicket;

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
        balance: row.totalSales - row.totalPrizes - row.totalCommissions,
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

  // Agrupación por vendedor (solo los que son vendedor/asociado, no admin)
  interface VendorGroup {
    vendorId: string;
    vendorName: string;
    ticketCount: number;
    totalSales: number;
    totalPrizes: number;
    totalCommissions: number;
    balance: number;
  }

  const byVendor = new Map<string, VendorGroup>();
  for (const ticket of tickets) {
    const seller = ticket.seller;
    if (seller.role === 'admin') continue; // Skip admin

    const { prizeForTicket, commissionForTicket } = calculateTicketFinancials(ticket);

    const current = byVendor.get(seller.id) ?? {
      vendorId: seller.id,
      vendorName: seller.fullName,
      ticketCount: 0,
      totalSales: 0,
      totalPrizes: 0,
      totalCommissions: 0,
      balance: 0,
    };

    current.ticketCount += 1;
    current.totalSales += ticket.total;
    current.totalPrizes += prizeForTicket;
    current.totalCommissions += commissionForTicket;
    current.balance = current.totalSales - current.totalPrizes - current.totalCommissions;

    byVendor.set(seller.id, current);
  }

  const vendorRows = Array.from(byVendor.values())
    .sort((a, b) => b.totalSales - a.totalSales);

  const vendorTotals = vendorRows.reduce(
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

  // Agrupación por sorteo
  interface DrawGroup {
    drawId: string;
    drawName: string;
    ticketCount: number;
    totalSales: number;
    totalPrizes: number;
    totalCommissions: number;
    balance: number;
  }

  const byDraw = new Map<string, DrawGroup>();
  for (const ticket of tickets) {
    const draw = ticket.draw;
    const { prizeForTicket, commissionForTicket } = calculateTicketFinancials(ticket);

    const current = byDraw.get(draw.id) ?? {
      drawId: draw.id,
      drawName: draw.name,
      ticketCount: 0,
      totalSales: 0,
      totalPrizes: 0,
      totalCommissions: 0,
      balance: 0,
    };

    current.ticketCount += 1;
    current.totalSales += ticket.total;
    current.totalPrizes += prizeForTicket;
    current.totalCommissions += commissionForTicket;
    current.balance = current.totalSales - current.totalPrizes - current.totalCommissions;

    byDraw.set(draw.id, current);
  }

  const drawRows = Array.from(byDraw.values())
    .sort((a, b) => b.totalSales - a.totalSales);

  const drawTotals = drawRows.reduce(
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

  // Agrupación por asociado, con detalle por sorteo
  interface AssociateDrawGroup {
    drawId: string;
    drawName: string;
    drawCloseTime: Date;
    ticketCount: number;
    totalSales: number;
    totalPrizes: number;
    totalCommissions: number;
    balance: number;
  }

  interface AssociateGroup {
    associateId: string;
    associateName: string;
    ticketCount: number;
    totalSales: number;
    totalPrizes: number;
    totalCommissions: number;
    balance: number;
    draws: AssociateDrawGroup[];
  }

  const byAssociate = new Map<string, {
    associateId: string;
    associateName: string;
    ticketCount: number;
    totalSales: number;
    totalPrizes: number;
    totalCommissions: number;
    balance: number;
    draws: Map<string, AssociateDrawGroup>;
  }>();

  for (const ticket of tickets) {
    const { prizeForTicket, commissionForTicket } = calculateTicketFinancials(ticket);
    const associateId = ticket.associateId;
    const associateName = ticket.associate.fullName;

    const associateCurrent = byAssociate.get(associateId) ?? {
      associateId,
      associateName,
      ticketCount: 0,
      totalSales: 0,
      totalPrizes: 0,
      totalCommissions: 0,
      balance: 0,
      draws: new Map<string, AssociateDrawGroup>(),
    };

    associateCurrent.ticketCount += 1;
    associateCurrent.totalSales += ticket.total;
    associateCurrent.totalPrizes += prizeForTicket;
    associateCurrent.totalCommissions += commissionForTicket;
    associateCurrent.balance = associateCurrent.totalSales - associateCurrent.totalPrizes - associateCurrent.totalCommissions;

    const drawCurrent = associateCurrent.draws.get(ticket.draw.id) ?? {
      drawId: ticket.draw.id,
      drawName: ticket.draw.name,
      drawCloseTime: ticket.draw.closeTime,
      ticketCount: 0,
      totalSales: 0,
      totalPrizes: 0,
      totalCommissions: 0,
      balance: 0,
    };

    drawCurrent.ticketCount += 1;
    drawCurrent.totalSales += ticket.total;
    drawCurrent.totalPrizes += prizeForTicket;
    drawCurrent.totalCommissions += commissionForTicket;
    drawCurrent.balance = drawCurrent.totalSales - drawCurrent.totalPrizes - drawCurrent.totalCommissions;

    associateCurrent.draws.set(ticket.draw.id, drawCurrent);
    byAssociate.set(associateId, associateCurrent);
  }

  const associateRows: AssociateGroup[] = Array.from(byAssociate.values())
    .map((associate) => ({
      associateId: associate.associateId,
      associateName: associate.associateName,
      ticketCount: associate.ticketCount,
      totalSales: associate.totalSales,
      totalPrizes: associate.totalPrizes,
      totalCommissions: associate.totalCommissions,
      balance: associate.balance,
      draws: Array.from(associate.draws.values()).sort((a, b) => new Date(b.drawCloseTime).getTime() - new Date(a.drawCloseTime).getTime()),
    }))
    .sort((a, b) => b.totalSales - a.totalSales);

  const associateTotals = associateRows.reduce(
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

// ── GET /api/reports/sales-by-user ─────────────────────────────────────────

router.get('/sales-by-user', authorizeResource('/reports/sales-by-user'), async (req, res) => {
  const query = req.query as Record<string, string>;
  const { drawId, userId } = query;

  const { filter: createdAtFilter, error } = parseCreatedAtFilter(query);
  if (error) {
    res.status(400).json({ message: error });
    return;
  }

  const users = await getHierarchyUsers();

  let allowedUserIds: Set<string>;
  if (req.user!.role === 'admin') {
    allowedUserIds = new Set(users.map((u) => u.id));
  } else if (req.user!.role === 'asociado') {
    allowedUserIds = getDescendantUserIds(users, req.user!.sub);
  } else {
    allowedUserIds = new Set([req.user!.sub]);
  }

  if (userId && !allowedUserIds.has(userId)) {
    res.status(403).json({ message: 'No tienes permisos para consultar ese usuario.' });
    return;
  }

  const scopedUserIds = userId
    ? getDescendantUserIds(users, userId)
    : allowedUserIds;

  const sellerIds = users
    .filter((u) => allowedUserIds.has(u.id) && scopedUserIds.has(u.id))
    .map((u) => u.id);

  const where: Record<string, unknown> = {
    sellerId: { in: sellerIds },
  };
  if (drawId) where['drawId'] = drawId;
  if (Object.keys(createdAtFilter).length > 0) where['createdAt'] = createdAtFilter;

  const tickets = await prisma.ticket.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      lines: true,
      draw: { select: { id: true, name: true } },
      seller: { select: { id: true, fullName: true, username: true } },
      associate: { select: { id: true, fullName: true } },
      canceledBy: { select: { id: true, fullName: true, username: true } },
    },
  });

  const rowsMap = new Map<string, {
    userId: string;
    fullName: string;
    username: string;
    role: Role;
    ticketCount: number;
    activeTicketCount: number;
    canceledTicketCount: number;
    totalSales: number;
  }>();

  for (const t of tickets) {
    const seller = users.find((u) => u.id === t.sellerId);
    if (!seller) continue;

    const current = rowsMap.get(seller.id) ?? {
      userId: seller.id,
      fullName: seller.fullName,
      username: seller.username,
      role: seller.role,
      ticketCount: 0,
      activeTicketCount: 0,
      canceledTicketCount: 0,
      totalSales: 0,
    };

    current.ticketCount += 1;
    if (t.canceledAt) {
      current.canceledTicketCount += 1;
    } else {
      current.activeTicketCount += 1;
      current.totalSales += t.total;
    }

    rowsMap.set(seller.id, current);
  }

  const rows = Array.from(rowsMap.values()).sort((a, b) => b.totalSales - a.totalSales);

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
      fromDate: query.fromDate || null,
      toDate: query.toDate || null,
    },
    totals,
    rows,
    tickets,
  });
});

// ── GET /api/reports/draw-lists ────────────────────────────────────────────

router.get('/draw-lists', authorizeResource('/reports/draw-lists'), async (req, res) => {
  const query = req.query as Record<string, string>;
  const { drawId, userId } = query;

  const { filter: createdAtFilter, error } = parseCreatedAtFilter(query);
  if (error) {
    res.status(400).json({ message: error });
    return;
  }

  const users = await getHierarchyUsers();

  let allowedUserIds = new Set<string>(users.map((u) => u.id));
  if (req.user!.role === 'asociado') {
    allowedUserIds = getDescendantUserIds(users, req.user!.sub);
  }

  if (userId && !allowedUserIds.has(userId)) {
    res.status(403).json({ message: 'No tienes permisos para consultar ese usuario.' });
    return;
  }

  const sellerIds = userId
    ? [userId]
    : users
      .filter((u) => allowedUserIds.has(u.id))
      .map((u) => u.id);

  const where: Record<string, unknown> = {
    sellerId: { in: sellerIds },
    canceledAt: null,
  };
  if (drawId) where['drawId'] = drawId;
  if (Object.keys(createdAtFilter).length > 0) where['createdAt'] = createdAtFilter;

  const tickets = await prisma.ticket.findMany({
    where,
    select: {
      id: true,
      lines: {
        select: {
          number: true,
          amount: true,
        },
      },
    },
  });

  const numberMap = new Map<string, number>();
  for (let i = 0; i <= 99; i += 1) {
    const key = i.toString().padStart(2, '0');
    numberMap.set(key, 0);
  }

  const toTwoDigitNumber = (value: string): string | null => {
    const cleaned = value.trim();
    if (!/^\d+$/.test(cleaned)) return null;
    const asNumber = Number.parseInt(cleaned, 10);
    if (!Number.isFinite(asNumber) || asNumber < 0 || asNumber > 99) return null;
    return asNumber.toString().padStart(2, '0');
  };

  for (const ticket of tickets) {
    for (const line of ticket.lines) {
      const numberKey = toTwoDigitNumber(line.number);
      if (!numberKey) continue;

      const current = numberMap.get(numberKey) ?? 0;
      numberMap.set(numberKey, current + line.amount);
    }
  }

  const numbers = Array.from(numberMap.entries())
    .map(([number, total]) => ({ number, total }))
    .sort((a, b) => a.number.localeCompare(b.number));

  const totalAmount = numbers.reduce((acc, row) => acc + row.total, 0);

  res.json({
    filters: {
      drawId: drawId || null,
      userId: userId || null,
      fromDate: query.fromDate || null,
      toDate: query.toDate || null,
    },
    totals: {
      ticketCount: tickets.length,
      totalAmount,
    },
    numbers,
  });
});

export default router;
