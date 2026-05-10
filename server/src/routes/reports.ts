import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();
router.use(authenticate, authorize('admin', 'asociado'));

// ── GET /api/reports/summary ──────────────────────────────────────────────────

router.get('/summary', async (req, res) => {
  const { drawId } = req.query as Record<string, string>;

  const ticketWhere: Record<string, unknown> = {};
  if (drawId) ticketWhere['drawId'] = drawId;
  if (req.user!.role === 'asociado') {
    ticketWhere['associateId'] = req.user!.sub;
  }

  const [ticketCount, totalResult, userCount, drawCount] = await Promise.all([
    prisma.ticket.count({ where: ticketWhere }),
    prisma.ticket.aggregate({ where: ticketWhere, _sum: { total: true } }),
    prisma.user.count({ where: { status: 'activo' } }),
    prisma.draw.count(),
  ]);

  res.json({
    ticketCount,
    totalSales: totalResult._sum.total ?? 0,
    userCount,
    drawCount,
  });
});

// ── GET /api/reports/top-numbers ──────────────────────────────────────────────

router.get('/top-numbers', async (req, res) => {
  const { drawId, limit = '10' } = req.query as Record<string, string>;

  const ticketWhere: Record<string, unknown> = {};
  if (drawId) ticketWhere['drawId'] = drawId;
  if (req.user!.role === 'asociado') {
    ticketWhere['associateId'] = req.user!.sub;
  }

  // Get all ticket IDs matching filter
  const tickets = await prisma.ticket.findMany({
    where: ticketWhere,
    select: { id: true },
  });
  const ticketIds = tickets.map((t) => t.id);

  const grouped = await prisma.ticketLine.groupBy({
    by: ['number'],
    where: { ticketId: { in: ticketIds } },
    _sum: { amount: true },
    orderBy: { _sum: { amount: 'desc' } },
    take: parseInt(limit, 10),
  });

  const result = grouped.map((g) => ({
    number: g.number,
    total: g._sum.amount ?? 0,
  }));

  res.json(result);
});

// ── GET /api/reports/hierarchy ────────────────────────────────────────────────

router.get('/hierarchy', async (req, res) => {
  const { drawId } = req.query as Record<string, string>;

  // Fetch all users
  const users = await prisma.user.findMany({
    select: {
      id: true, fullName: true, username: true,
      role: true, status: true, parentId: true,
    },
  });

  // Fetch ticket aggregates per associate
  const ticketWhere: Record<string, unknown> = {};
  if (drawId) ticketWhere['drawId'] = drawId;

  const aggregates = await prisma.ticket.groupBy({
    by: ['associateId'],
    where: ticketWhere,
    _sum: { total: true },
    _count: { id: true },
  });

  const statsMap = new Map(
    aggregates.map((a) => [a.associateId, { totalSales: a._sum.total ?? 0, ticketCount: a._count.id }])
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
      .filter((u) => (parentId === null ? !u.parentId : u.parentId === parentId))
      .map((u) => {
        const children = buildTree(u.id);
        const direct = statsMap.get(u.id) ?? { totalSales: 0, ticketCount: 0 };
        const childTotals = children.reduce(
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

  // For asociados show only their subtree
  let tree: TreeNode[];
  if (req.user!.role === 'asociado') {
    const root = users.find((u) => u.id === req.user!.sub);
    if (!root) { res.json([]); return; }
    const children = buildTree(root.id);
    const direct = statsMap.get(root.id) ?? { totalSales: 0, ticketCount: 0 };
    const childTotals = children.reduce(
      (acc, c) => ({ totalSales: acc.totalSales + c.totalSales, ticketCount: acc.ticketCount + c.ticketCount }),
      { totalSales: 0, ticketCount: 0 }
    );
    tree = [{ user: root, totalSales: direct.totalSales + childTotals.totalSales, ticketCount: direct.ticketCount + childTotals.ticketCount, children }];
  } else {
    tree = buildTree(null);
  }

  res.json(tree);
});

// ── GET /api/reports/recent-tickets ──────────────────────────────────────────

router.get('/recent-tickets', async (req, res) => {
  const { drawId, limit = '10' } = req.query as Record<string, string>;

  const where: Record<string, unknown> = {};
  if (drawId) where['drawId'] = drawId;
  if (req.user!.role === 'asociado') where['associateId'] = req.user!.sub;

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

export default router;
