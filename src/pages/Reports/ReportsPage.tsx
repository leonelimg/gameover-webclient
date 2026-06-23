import { useState, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronRight, BarChart3 } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Select } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { DateRangeSegmentedControl } from '@/components/ui/DateRangeSegmentedControl';
import { formatCurrency, formatDrawLabel } from '@/utils/helpers';
import { drawsApi, reportsApi, HierarchyNode, ReportSummary, TopNumber } from '@/services/api';
import { DateRange, getDateRange, isDateRange, toISODateLocal } from '@/utils/dateRanges';
import { Draw, Ticket } from '@/types';

const REPORTS_RANGE_KEY = 'go_reports_selected_range';
const REPORTS_CUSTOM_FROM_KEY = 'go_reports_custom_from_date';
const REPORTS_CUSTOM_TO_KEY = 'go_reports_custom_to_date';

const EMPTY_REPORT_SUMMARY: ReportSummary = {
  ticketCount: 0,
  totalSales: 0,
  totalPrizes: 0,
  totalCommissions: 0,
  userCount: 0,
  drawCount: 0,
};

function TreeRow({
  node,
  depth = 0,
}: {
  node: HierarchyNode;
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
  const [draws, setDraws] = useState<Draw[]>([]);
  const [selectedDrawId, setSelectedDrawId] = useState('');
  const [customFromDate, setCustomFromDate] = useState<string>(() => {
    const saved = localStorage.getItem(REPORTS_CUSTOM_FROM_KEY);
    return saved || toISODateLocal(new Date());
  });
  const [customToDate, setCustomToDate] = useState<string>(() => {
    const saved = localStorage.getItem(REPORTS_CUSTOM_TO_KEY);
    return saved || toISODateLocal(new Date());
  });
  const [selectedRange, setSelectedRange] = useState<DateRange>(() => {
    const saved = localStorage.getItem(REPORTS_RANGE_KEY);
    if (saved && isDateRange(saved)) {
      return saved;
    }
    return 'today';
  });

  const [summary, setSummary] = useState<ReportSummary>(EMPTY_REPORT_SUMMARY);
  const [tree, setTree] = useState<HierarchyNode[]>([]);
  const [topNumbers, setTopNumbers] = useState<TopNumber[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);

  // Persist selectedRange to localStorage
  useEffect(() => {
    localStorage.setItem(REPORTS_RANGE_KEY, selectedRange);
  }, [selectedRange]);

  // Persist custom dates to localStorage
  useEffect(() => {
    localStorage.setItem(REPORTS_CUSTOM_FROM_KEY, customFromDate);
  }, [customFromDate]);

  useEffect(() => {
    localStorage.setItem(REPORTS_CUSTOM_TO_KEY, customToDate);
  }, [customToDate]);

  // Load draws once
  useEffect(() => {
    drawsApi.list().then(setDraws).catch(() => {});
  }, []);

  const filteredDraws = useMemo(() => {
    const isCustomRange = selectedRange === 'custom';
    if (isCustomRange && (!customFromDate || !customToDate || customFromDate > customToDate)) {
      return [];
    }
    const { fromDate, toDate } = isCustomRange
      ? { fromDate: customFromDate, toDate: customToDate }
      : getDateRange(selectedRange);

    return draws.filter((d) => {
      const drawDate = toISODateLocal(new Date(d.closeTime));
      return drawDate >= fromDate && drawDate <= toDate;
    });
  }, [draws, selectedRange, customFromDate, customToDate]);

  useEffect(() => {
    if (selectedDrawId && !filteredDraws.some((d) => d.id === selectedDrawId)) {
      setSelectedDrawId('');
    }
  }, [filteredDraws, selectedDrawId]);

  // Reload report data whenever the selected draw or date range changes
  useEffect(() => {
    const drawId = selectedDrawId || undefined;
    const isCustomRange = selectedRange === 'custom';
    if (isCustomRange && (!customFromDate || !customToDate || customFromDate > customToDate)) {
      return;
    }

    const { fromDate, toDate } = isCustomRange
      ? { fromDate: customFromDate, toDate: customToDate }
      : getDateRange(selectedRange);

    if (selectedDrawId && !filteredDraws.some((d) => d.id === selectedDrawId)) {
      return;
    }

    let isMounted = true;

    Promise.all([
      reportsApi.summary(drawId, fromDate, toDate),
      reportsApi.hierarchy(drawId, fromDate, toDate),
      reportsApi.topNumbers(drawId, 10, fromDate, toDate),
      reportsApi.recentTickets(drawId, 10, fromDate, toDate),
    ])
      .then(([summaryData, hierarchyData, topNumbersData, ticketsData]) => {
        if (!isMounted) return;
        setSummary(summaryData);
        setTree(hierarchyData);
        setTopNumbers(topNumbersData);
        setTickets(ticketsData);
      })
      .catch(() => {
        if (!isMounted) return;
        setSummary(EMPTY_REPORT_SUMMARY);
        setTree([]);
        setTopNumbers([]);
        setTickets([]);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedDrawId, selectedRange, customFromDate, customToDate, filteredDraws]);

  const resetFilters = () => {
    setSelectedDrawId('');
    setSelectedRange('today');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Reportes</h1>
        <p className="text-sm text-slate-500">Estadisctica de ventas</p>
      </div>

      {/* Date range filter */}
      <DateRangeSegmentedControl
        selectedRange={selectedRange}
        onRangeChange={setSelectedRange}
        customFromDate={customFromDate}
        customToDate={customToDate}
        onCustomFromDateChange={setCustomFromDate}
        onCustomToDateChange={setCustomToDate}
      />

      {/* Additional filters */}
      <Card>
        <CardBody>
          <div className="flex flex-wrap gap-3 items-center">
            <Select
              value={selectedDrawId}
              onChange={(e) => setSelectedDrawId(e.target.value)}
              options={[
                { value: '', label: 'Todos los sorteos' },
                ...filteredDraws.map((d) => ({
                  value: d.id,
                  label: formatDrawLabel(d),
                })),
              ]}
              className="w-64"
            />
            <button
              onClick={resetFilters}
              className="px-3 py-2 text-sm rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Limpiar filtros
            </button>
          </div>
        </CardBody>
      </Card>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-sm text-slate-500 mb-1">Total Ventas</p>
          <p className="text-2xl font-bold text-green-700">{formatCurrency(summary.totalSales)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-slate-500 mb-1">Tickets Emitidos</p>
          <p className="text-2xl font-bold text-slate-900">{summary.ticketCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-slate-500 mb-1">Sorteos</p>
          <p className="text-2xl font-bold text-slate-900">{summary.drawCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-slate-500 mb-1">Usuarios activos</p>
          <p className="text-2xl font-bold text-slate-900">{summary.userCount}</p>
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
                  {topNumbers.map((tn, i) => (
                    <div key={tn.number} className="flex items-center gap-3 px-4 py-3">
                      <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0">
                        {i + 1}
                      </span>
                      <Badge variant="info">{tn.number}</Badge>
                      <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-blue-500 h-2 rounded-full"
                          style={{
                            width: `${Math.round((tn.total / topNumbers[0].total) * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs font-medium text-slate-700 whitespace-nowrap">
                        {formatCurrency(tn.total)}
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
                  {tickets.map((t) => (
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
