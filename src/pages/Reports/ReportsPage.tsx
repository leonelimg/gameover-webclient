import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, BarChart3 } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Select } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { db } from '@/utils/db';
import { formatCurrency, formatDate } from '@/utils/helpers';
import { User } from '@/types';
import { useAuth } from '@/context/AuthContext';

interface AssociateNode {
  user: User;
  children: AssociateNode[];
  totalSales: number;
  ticketCount: number;
}

function buildTree(users: User[], parentId: string | undefined): AssociateNode[] {
  return users
    .filter((u) => u.parentId === parentId && u.role !== 'vendedor')
    .map((u) => ({
      user: u,
      children: buildTree(users, u.id),
      totalSales: 0,
      ticketCount: 0,
    }));
}

function enrichNode(
  node: AssociateNode,
  tickets: ReturnType<typeof db.getTickets>,
  drawId: string
): { totalSales: number; ticketCount: number } {
  const directTickets = tickets.filter(
    (t) => t.associateId === node.user.id && (!drawId || t.drawId === drawId)
  );
  let totalSales = directTickets.reduce((s, t) => s + t.total, 0);
  let ticketCount = directTickets.length;

  for (const child of node.children) {
    const childStats = enrichNode(child, tickets, drawId);
    totalSales += childStats.totalSales;
    ticketCount += childStats.ticketCount;
  }

  node.totalSales = totalSales;
  node.ticketCount = ticketCount;
  return { totalSales, ticketCount };
}

function TreeRow({
  node,
  depth = 0,
}: {
  node: AssociateNode;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(depth === 0);

  return (
    <>
      <tr className="border-t border-slate-100 hover:bg-slate-50">
        <td className="px-4 py-3">
          <div className="flex items-center gap-2" style={{ paddingLeft: depth * 24 }}>
            {node.children.length > 0 ? (
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-slate-400 hover:text-slate-700"
              >
                {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
            ) : (
              <span className="w-4" />
            )}
            <span className="font-medium text-slate-800">{node.user.fullName}</span>
            <Badge variant="secondary" className="text-xs">
              {node.user.role}
            </Badge>
          </div>
        </td>
        <td className="px-4 py-3 text-slate-600">{node.user.username}</td>
        <td className="px-4 py-3 text-center">
          <Badge variant={node.user.status === 'activo' ? 'success' : 'danger'}>
            {node.user.status}
          </Badge>
        </td>
        <td className="px-4 py-3 text-center font-medium">{node.ticketCount}</td>
        <td className="px-4 py-3 text-right font-bold text-green-700">
          {formatCurrency(node.totalSales)}
        </td>
      </tr>
      {expanded &&
        node.children.map((child) => (
          <TreeRow key={child.user.id} node={child} depth={depth + 1} />
        ))}
    </>
  );
}

export default function ReportsPage() {
  const { user } = useAuth();

  const [draws] = useState(() => db.getDraws());
  const [tickets] = useState(() => db.getTickets());
  const [users] = useState(() => db.getUsers());
  const [selectedDrawId, setSelectedDrawId] = useState('');

  const [tree, setTree] = useState<AssociateNode[]>([]);
  const [globalStats, setGlobalStats] = useState({ total: 0, tickets: 0 });

  useEffect(() => {
    // Build hierarchy starting from admins or the current associate
    let rootNodes: AssociateNode[];
    if (user?.role === 'admin') {
      rootNodes = buildTree(users, undefined);
      // Also add direct associates with no parent
    } else {
      rootNodes = [
        {
          user: user!,
          children: buildTree(users, user!.id),
          totalSales: 0,
          ticketCount: 0,
        },
      ];
    }

    let total = 0;
    let ticketCount = 0;
    for (const node of rootNodes) {
      const stats = enrichNode(node, tickets, selectedDrawId);
      total += stats.totalSales;
      ticketCount += stats.ticketCount;
    }
    setTree(rootNodes);
    setGlobalStats({ total, tickets: ticketCount });
  }, [users, tickets, selectedDrawId, user]);

  // Top numbers per draw
  const numberMap: Record<string, number> = {};
  tickets
    .filter((t) => !selectedDrawId || t.drawId === selectedDrawId)
    .forEach((t) => t.lines.forEach((l) => {
      numberMap[l.number] = (numberMap[l.number] ?? 0) + l.amount;
    }));
  const topNumbers = Object.entries(numberMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Reportes</h1>
        <p className="text-sm text-slate-500">Estadísticas de ventas por jerarquía</p>
      </div>

      {/* Filter */}
      <Card>
        <CardBody>
          <div className="flex flex-wrap gap-3 items-center">
            <Select
              value={selectedDrawId}
              onChange={(e) => setSelectedDrawId(e.target.value)}
              options={[
                { value: '', label: 'Todos los sorteos' },
                ...draws.map((d) => ({
                  value: d.id,
                  label: `${d.name} (${formatDate(d.openTime)})`,
                })),
              ]}
              className="w-64"
            />
          </div>
        </CardBody>
      </Card>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-sm text-slate-500 mb-1">Total Ventas</p>
          <p className="text-2xl font-bold text-green-700">{formatCurrency(globalStats.total)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-slate-500 mb-1">Tickets Emitidos</p>
          <p className="text-2xl font-bold text-slate-900">{globalStats.tickets}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-slate-500 mb-1">Sorteos</p>
          <p className="text-2xl font-bold text-slate-900">{draws.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-slate-500 mb-1">Usuarios activos</p>
          <p className="text-2xl font-bold text-slate-900">
            {users.filter((u) => u.status === 'activo').length}
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hierarchy table */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <BarChart3 size={18} className="text-blue-600" />
                <h2 className="font-semibold text-slate-800">Ventas por Jerarquía</h2>
              </div>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-slate-600 font-medium">Asociado</th>
                    <th className="text-left px-4 py-3 text-slate-600 font-medium">Usuario</th>
                    <th className="text-center px-4 py-3 text-slate-600 font-medium">Estado</th>
                    <th className="text-center px-4 py-3 text-slate-600 font-medium">Tickets</th>
                    <th className="text-right px-4 py-3 text-slate-600 font-medium">Ventas</th>
                  </tr>
                </thead>
                <tbody>
                  {tree.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                        No hay datos de jerarquía.
                      </td>
                    </tr>
                  ) : (
                    tree.map((node) => <TreeRow key={node.user.id} node={node} />)
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Top numbers */}
        <div>
          <Card>
            <CardHeader>
              <h2 className="font-semibold text-slate-800">Top 10 Números</h2>
            </CardHeader>
            <CardBody className="p-0">
              {topNumbers.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-6">Sin datos</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {topNumbers.map(([number, total], i) => (
                    <div key={number} className="flex items-center gap-3 px-4 py-3">
                      <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0">
                        {i + 1}
                      </span>
                      <Badge variant="info">{number}</Badge>
                      <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-blue-500 h-2 rounded-full"
                          style={{
                            width: `${Math.round((total / topNumbers[0][1]) * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs font-medium text-slate-700 whitespace-nowrap">
                        {formatCurrency(total)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          {/* Recent tickets */}
          <Card className="mt-4">
            <CardHeader>
              <h2 className="font-semibold text-slate-800">Últimos Tickets</h2>
            </CardHeader>
            <CardBody className="p-0">
              {tickets.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-6 px-4">Sin tickets</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {tickets
                    .filter((t) => !selectedDrawId || t.drawId === selectedDrawId)
                    .slice(-5)
                    .reverse()
                    .map((t) => (
                      <div key={t.id} className="px-4 py-3">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-medium">{t.code}</span>
                          <span className="text-xs font-bold text-green-700">
                            {formatCurrency(t.total)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{t.customerName}</p>
                      </div>
                    ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
