import { Fragment, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { DateRangeSegmentedControl } from '@/components/ui/DateRangeSegmentedControl';
import { drawsApi, reportsApi, usersApi, CommissionsReportResponse } from '@/services/api';
import { Draw, User } from '@/types';
import { formatCurrency, formatDateTime, formatDrawLabel } from '@/utils/helpers';
import { DateRange, getDateRange, isDateRange, toISODateLocal } from '@/utils/dateRanges';

const COMMISSIONS_RANGE_KEY = 'go_commissions_selected_range';
const COMMISSIONS_CUSTOM_FROM_KEY = 'go_commissions_custom_from_date';
const COMMISSIONS_CUSTOM_TO_KEY = 'go_commissions_custom_to_date';

const EMPTY_REPORT: CommissionsReportResponse = {
  filters: {
    drawId: null,
    userId: null,
    fromDate: null,
    toDate: null,
  },
  totals: {
    totalSales: 0,
    totalCommissions: 0,
  },
  bySeller: [],
};

const isRowVisible = (row: any, rows: any[], expandedUsers: Set<string>): boolean => {
  if (!row.parentId) return true;
  const parentRow = rows.find((r) => r.sellerId === row.parentId);
  if (!parentRow) return true;
  return expandedUsers.has(row.parentId) && isRowVisible(parentRow, rows, expandedUsers);
};

export default function CommissionsPage() {
  const [draws, setDraws] = useState<Draw[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const [selectedDrawId, setSelectedDrawId] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [customFromDate, setCustomFromDate] = useState<string>(() => {
    const saved = localStorage.getItem(COMMISSIONS_CUSTOM_FROM_KEY);
    return saved || toISODateLocal(new Date());
  });
  const [customToDate, setCustomToDate] = useState<string>(() => {
    const saved = localStorage.getItem(COMMISSIONS_CUSTOM_TO_KEY);
    return saved || toISODateLocal(new Date());
  });
  const [selectedRange, setSelectedRange] = useState<DateRange>(() => {
    const saved = localStorage.getItem(COMMISSIONS_RANGE_KEY);
    if (saved && isDateRange(saved)) {
      return saved;
    }
    return 'today';
  });
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState<CommissionsReportResponse>(EMPTY_REPORT);

  useEffect(() => {
    drawsApi.list().then(setDraws).catch(() => {});
    usersApi.list().then(setUsers).catch(() => {});
  }, []);

  useEffect(() => {
    localStorage.setItem(COMMISSIONS_RANGE_KEY, selectedRange);
  }, [selectedRange]);

  useEffect(() => {
    localStorage.setItem(COMMISSIONS_CUSTOM_FROM_KEY, customFromDate);
  }, [customFromDate]);

  useEffect(() => {
    localStorage.setItem(COMMISSIONS_CUSTOM_TO_KEY, customToDate);
  }, [customToDate]);

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

  useEffect(() => {
    setLoading(true);
    setError('');

    const isCustomRange = selectedRange === 'custom';
    if (isCustomRange && (!customFromDate || !customToDate || customFromDate > customToDate)) {
      setReport(EMPTY_REPORT);
      setLoading(false);
      return;
    }

    const { fromDate, toDate } = isCustomRange
      ? { fromDate: customFromDate, toDate: customToDate }
      : getDateRange(selectedRange);

    if (selectedDrawId && !filteredDraws.some((d) => d.id === selectedDrawId)) {
      return;
    }

    reportsApi.commissions({
      drawId: selectedDrawId || undefined,
      userId: selectedUserId || undefined,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
    })
      .then((data) => {
        setReport(data);
        setExpandedUsers(new Set());
      })
      .catch((err: unknown) => {
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
        setError(msg ?? 'No fue posible cargar el reporte de comisiones.');
        setReport(EMPTY_REPORT);
      })
      .finally(() => setLoading(false));
  }, [selectedDrawId, selectedUserId, selectedRange, customFromDate, customToDate, filteredDraws]);

  const userOptions = useMemo(
    () => [
      { value: '', label: 'Todos los usuarios' },
      ...users.map((u) => ({ value: u.id, label: `${u.fullName} (${u.username})` })),
    ],
    [users]
  );

  const resetFilters = () => {
    setSelectedDrawId('');
    setSelectedUserId('');
    setSelectedRange('today');
  };

  const toggleUserExpand = (userId: string) => {
    setExpandedUsers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Comisiones</h1>
        <p className="text-sm text-slate-500">Detalle por vendedor, fecha y sorteo</p>
      </div>

      <DateRangeSegmentedControl
        selectedRange={selectedRange}
        onRangeChange={setSelectedRange}
        customFromDate={customFromDate}
        customToDate={customToDate}
        onCustomFromDateChange={setCustomFromDate}
        onCustomToDateChange={setCustomToDate}
      />

      <Card>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <Select
              label="Sorteo"
              value={selectedDrawId}
              onChange={(e) => setSelectedDrawId(e.target.value)}
              options={[
                { value: '', label: 'Todos los sorteos' },
                ...filteredDraws.map((d) => ({ value: d.id, label: formatDrawLabel(d) })),
              ]}
            />
            <Select
              label="Vendedor"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              options={userOptions}
            />
            <Button variant="secondary" onClick={resetFilters}>Limpiar filtros</Button>
          </div>

          <div className="mt-3 text-xs text-slate-500">
            Vendedores: {report.bySeller.length} | Total comisiones: {formatCurrency(report.totals.totalCommissions)}
          </div>

          {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
        </CardBody>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-slate-600 font-medium">Vendedor</th>
                <th className="text-left px-4 py-3 text-slate-600 font-medium">Fecha sorteo</th>
                <th className="text-left px-4 py-3 text-slate-600 font-medium">Sorteo</th>
                <th className="text-right px-4 py-3 text-slate-600 font-medium">Monto de venta</th>
                <th className="text-right px-4 py-3 text-slate-600 font-medium">Comisión</th>
              </tr>
            </thead>
            <tbody>              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    Cargando reporte...
                  </td>
                </tr>
              ) : report.bySeller.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No hay registros para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                <>
                  {report.bySeller
                    .filter((seller) => isRowVisible(seller, report.bySeller, expandedUsers))
                    .map((seller) => (
                      <Fragment key={seller.sellerId}>
                        {/* Seller header as clickable group row */}
                        <tr
                          key={`${seller.sellerId}-header`}
                          className="bg-blue-100 border-blue-200 hover:bg-blue-200 cursor-pointer font-semibold text-slate-900 border-t"
                          onClick={() => toggleUserExpand(seller.sellerId)}
                        >
                          <td className="px-4 py-3 text-blue-950">
                            <div className="flex items-center gap-2">
                              <span className="text-slate-400 flex-shrink-0">
                                {expandedUsers.has(seller.sellerId) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                              </span>
                              <span>{seller.sellerName}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3"></td>
                          <td className="px-4 py-3"></td>
                          <td className="px-4 py-3 text-right text-green-800">
                            {formatCurrency(seller.totalSales)}
                          </td>
                          <td className="px-4 py-3 text-right text-blue-800 font-semibold">
                            {formatCurrency(seller.subtotal)}
                          </td>
                        </tr>

                        {/* Detail rows for each draw */}
                        {expandedUsers.has(seller.sellerId) &&
                          seller.rows.map((row, idx) => (
                            <tr
                              key={`${seller.sellerId}-${idx}`}
                              className="border-t border-slate-100 hover:bg-slate-50 font-medium text-slate-800 bg-white"
                            >
                              <td className="px-4 py-3 text-slate-600"></td>
                              <td className="px-4 py-3 text-slate-700">{formatDateTime(row.drawCloseTime)}</td>
                              <td className="px-4 py-3 text-slate-700">{row.drawName}</td>
                              <td className="px-4 py-3 text-right text-slate-700 font-medium">
                                {formatCurrency(row.totalSales)}
                              </td>
                              <td className="px-4 py-3 text-right text-blue-700 font-semibold">
                                {formatCurrency(row.commission)}
                              </td>
                            </tr>
                          ))}
                      </Fragment>
                    ))}

                  {/* Grand total */}
                  <tr className="bg-slate-800 border-t-2 border-slate-800">
                    <td colSpan={3} className="px-4 py-3 text-right font-bold text-white">
                      TOTALES
                    </td>
                    <td className="px-4 py-3 text-right text-white font-bold text-lg">
                      {formatCurrency(report.totals.totalSales)}
                    </td>
                    <td className="px-4 py-3 text-right text-white font-bold text-lg">
                      {formatCurrency(report.totals.totalCommissions)}
                    </td>
                  </tr>
                  <tr className="bg-slate-700 border-t border-slate-700">
                    <td colSpan={4} className="px-4 py-2 text-right font-bold text-white/90">
                      TOTAL EN COMISIONES
                    </td>
                    <td className="px-4 py-2 text-right text-white font-bold">
                      {formatCurrency(report.totals.totalCommissions)}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
