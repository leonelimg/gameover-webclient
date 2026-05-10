import { useEffect, useState } from 'react';
import { Users, Ticket, ShoppingCart, TrendingUp, DollarSign, Award } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { db } from '@/utils/db';
import { formatCurrency, formatDateTime } from '@/utils/helpers';
import { useAuth } from '@/context/AuthContext';

export default function DashboardPage() {
  const { user } = useAuth();

  const [stats, setStats] = useState({
    userCount: 0,
    drawCount: 0,
    ticketCount: 0,
    totalSales: 0,
  });

  const [recentTickets, setRecentTickets] = useState<ReturnType<typeof db.getTickets>>([]);
  const [topNumbers, setTopNumbers] = useState<{ number: string; total: number }[]>([]);

  useEffect(() => {
    const users = db.getUsers();
    const draws = db.getDraws();
    const tickets = db.getTickets();
    const totalSales = tickets.reduce((sum, t) => sum + t.total, 0);

    setStats({
      userCount: users.length,
      drawCount: draws.length,
      ticketCount: tickets.length,
      totalSales,
    });

    setRecentTickets(tickets.slice(-5).reverse());

    const numberMap: Record<string, number> = {};
    tickets.forEach((t) =>
      t.lines.forEach((l) => {
        numberMap[l.number] = (numberMap[l.number] ?? 0) + l.amount;
      })
    );
    const top = Object.entries(numberMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([number, total]) => ({ number, total }));
    setTopNumbers(top);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Bienvenido, {user?.fullName?.split(' ')[0]}
        </h1>
        <p className="text-slate-500 text-sm mt-1">Resumen del sistema</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Users size={20} />} label="Usuarios" value={stats.userCount} color="blue" />
        <StatCard icon={<Ticket size={20} />} label="Sorteos" value={stats.drawCount} color="purple" />
        <StatCard icon={<ShoppingCart size={20} />} label="Tickets" value={stats.ticketCount} color="green" />
        <StatCard
          icon={<DollarSign size={20} />}
          label="Ventas Totales"
          value={formatCurrency(stats.totalSales)}
          color="orange"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent tickets */}
        <Card>
          <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-2">
            <TrendingUp size={18} className="text-blue-600" />
            <h2 className="font-semibold text-slate-800">Tickets Recientes</h2>
          </div>
          <CardBody className="p-0">
            {recentTickets.length === 0 ? (
              <p className="text-slate-500 text-sm p-6 text-center">Sin tickets registrados</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-4 py-2 text-slate-600 font-medium">Código</th>
                    <th className="text-left px-4 py-2 text-slate-600 font-medium">Cliente</th>
                    <th className="text-right px-4 py-2 text-slate-600 font-medium">Total</th>
                    <th className="text-left px-4 py-2 text-slate-600 font-medium">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTickets.map((t) => (
                    <tr key={t.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-mono text-xs">{t.code}</td>
                      <td className="px-4 py-3">{t.customerName}</td>
                      <td className="px-4 py-3 text-right font-medium text-green-700">
                        {formatCurrency(t.total)}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {formatDateTime(t.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardBody>
        </Card>

        {/* Top numbers */}
        <Card>
          <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-2">
            <Award size={18} className="text-yellow-600" />
            <h2 className="font-semibold text-slate-800">Top 10 Números</h2>
          </div>
          <CardBody className="p-0">
            {topNumbers.length === 0 ? (
              <p className="text-slate-500 text-sm p-6 text-center">Sin datos de ventas</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {topNumbers.map((n, i) => (
                  <div key={n.number} className="flex items-center gap-3 px-4 py-3">
                    <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <Badge variant="info">{n.number}</Badge>
                    <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{
                          width: `${Math.round((n.total / topNumbers[0].total) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium text-slate-700">
                      {formatCurrency(n.total)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: 'blue' | 'purple' | 'green' | 'orange';
}) {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
    green: 'bg-green-50 text-green-600',
    orange: 'bg-orange-50 text-orange-600',
  };
  return (
    <Card className="p-4">
      <div className={`inline-flex p-2 rounded-lg ${colorMap[color]} mb-3`}>{icon}</div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-sm text-slate-500 mt-0.5">{label}</p>
    </Card>
  );
}
