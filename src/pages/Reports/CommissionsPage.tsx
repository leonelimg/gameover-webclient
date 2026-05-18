import { Fragment, useEffect, useMemo, useState } from 'react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
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
    totalCommissions: 0,
  },
  bySeller: [],
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

    reportsApi.commissions({
      drawId: selectedDrawId || undefined,
      userId: selectedUserId || undefined,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
    })
      .then(setReport)
      .catch((err: unknown) => {
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
        setError(msg ?? 'No fue posible cargar el reporte de comisiones.');
        setReport(EMPTY_REPORT);
      })
      .finally(() => setLoading(false));
  }, [selectedDrawId, selectedUserId, selectedRange, customFromDate, customToDate]);

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
                ...draws.map((d) => ({ value: d.id, label: formatDrawLabel(d) })),
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
        <CardHeader>
          <h2 className="font-semibold text-slate-800">Listado de comisiones</h2>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-slate-600 font-medium">Vendedor</th>
                <th className="text-left px-4 py-3 text-slate-600 font-medium">Fecha</th>
                <th className="text-left px-4 py-3 text-slate-600 font-medium">Sorteo</th>
                <th className="text-right px-4 py-3 text-slate-600 font-medium">Comisión</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                    Cargando reporte...
                  </td>
                </tr>
              ) : report.bySeller.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                    No hay registros para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                <>
                  {report.bySeller.map((seller) => (
                    <Fragment key={seller.sellerId}>
                      {/* Seller header */}
                      <tr key={`${seller.sellerId}-header`} className="bg-blue-50 border-t-2 border-blue-200">
                        <td colSpan={4} className="px-4 py-2 text-sm font-bold text-blue-900">
                          {seller.sellerName} / {seller.sellerUsername}
                        </td>
                      </tr>

                      {/* Detail rows for each draw */}
                      {seller.rows.map((row, idx) => (
                        <tr key={`${seller.sellerId}-${idx}`} className="border-t border-slate-100 hover:bg-slate-50">
                          <td className="px-4 py-3 text-slate-600"></td>
                          <td className="px-4 py-3 text-slate-700">{formatDateTime(row.drawCloseTime)}</td>
                          <td className="px-4 py-3 text-slate-700">{row.drawName}</td>
                          <td className="px-4 py-3 text-right text-blue-700 font-semibold">{formatCurrency(row.commission)}</td>
                        </tr>
                      ))}

                      {/* Seller subtotal */}
                      <tr key={`${seller.sellerId}-subtotal`} className="bg-slate-100 border-t border-slate-200">
                        <td colSpan={3} className="px-4 py-2 text-right font-semibold text-slate-700">
                          Subtotal:
                        </td>
                        <td className="px-4 py-2 text-right font-bold text-slate-900">
                          {formatCurrency(seller.subtotal)}
                        </td>
                      </tr>
                    </Fragment>
                  ))}

                  {/* Grand total */}
                  <tr className="bg-slate-800 border-t-2 border-slate-800">
                    <td colSpan={3} className="px-4 py-3 text-right font-bold text-white">
                      TOTAL EN COMISIONES
                    </td>
                    <td className="px-4 py-3 text-right text-white font-bold text-lg">
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
