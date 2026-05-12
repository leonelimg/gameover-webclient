import { Fragment, useEffect, useState } from 'react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import {
  drawsApi,
  reportsApi,
  BalanceBreakdownResponse,
  BalanceBreakdownTotals,
  AssociateBreakdownRow,
  AssociateDrawBreakdownRow,
} from '@/services/api';
import { Draw } from '@/types';
import { formatCurrency, formatDate } from '@/utils/helpers';

const EMPTY_TOTALS: BalanceBreakdownTotals = {
  ticketCount: 0,
  totalSales: 0,
  totalPrizes: 0,
  totalCommissions: 0,
  balance: 0,
};

const EMPTY_REPORT: BalanceBreakdownResponse = {
  filters: {
    drawId: null,
    fromDate: null,
    toDate: null,
  },
  totals: EMPTY_TOTALS,
  rows: [],
  byVendor: {
    totals: EMPTY_TOTALS,
    rows: [],
  },
  byDraw: {
    totals: EMPTY_TOTALS,
    rows: [],
  },
  byAssociate: {
    totals: EMPTY_TOTALS,
    rows: [],
  },
};

function EventRow({
  event,
  totals,
  indented = false,
  bold = false,
  variant = 'draw',
}: {
  event: string;
  totals: BalanceBreakdownTotals;
  indented?: boolean;
  bold?: boolean;
  variant?: 'grand-total' | 'associate-total' | 'draw';
}) {
  const textClass = bold ? 'font-semibold' : 'font-medium';
  const rowClass =
    variant === 'grand-total'
      ? 'bg-emerald-50 border-emerald-200'
      : variant === 'associate-total'
        ? 'bg-blue-50 border-blue-100'
        : 'bg-white border-slate-100';

  const eventTextClass =
    variant === 'grand-total'
      ? 'text-emerald-900'
      : variant === 'associate-total'
        ? 'text-blue-900'
        : 'text-slate-800';

  return (
    <tr className={`border-t hover:bg-slate-50 ${rowClass}`}>
      <td className={`px-4 py-3 ${eventTextClass} ${textClass} ${indented ? 'pl-10' : ''}`}>{event}</td>
      <td className={`px-4 py-3 text-center text-slate-900 ${textClass}`}>{totals.ticketCount}</td>
      <td className={`px-4 py-3 text-right text-green-700 ${textClass}`}>{formatCurrency(totals.totalSales)}</td>
      <td className={`px-4 py-3 text-right text-amber-700 ${textClass}`}>{formatCurrency(totals.totalPrizes)}</td>
      <td className={`px-4 py-3 text-right ${totals.balance >= 0 ? 'text-emerald-700' : 'text-red-700'} ${textClass}`}>
        {formatCurrency(totals.balance)}
      </td>
      <td className={`px-4 py-3 text-right text-blue-700 ${textClass}`}>{formatCurrency(totals.totalCommissions)}</td>
    </tr>
  );
}

function mapAssociateToTotals(row: AssociateBreakdownRow): BalanceBreakdownTotals {
  return {
    ticketCount: row.ticketCount,
    totalSales: row.totalSales,
    totalPrizes: row.totalPrizes,
    totalCommissions: row.totalCommissions,
    balance: row.balance,
  };
}

function mapDrawToTotals(row: AssociateDrawBreakdownRow): BalanceBreakdownTotals {
  return {
    ticketCount: row.ticketCount,
    totalSales: row.totalSales,
    totalPrizes: row.totalPrizes,
    totalCommissions: row.totalCommissions,
    balance: row.balance,
  };
}

export default function BalanceBreakdownPage() {
  const [draws, setDraws] = useState<Draw[]>([]);
  const [selectedDrawId, setSelectedDrawId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState<BalanceBreakdownResponse>(EMPTY_REPORT);

  useEffect(() => {
    drawsApi.list().then(setDraws).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError('');

    reportsApi.balanceBreakdown({
      drawId: selectedDrawId || undefined,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
    })
      .then(setReport)
      .catch((err: unknown) => {
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
        setError(msg ?? 'No fue posible cargar el reporte.');
        setReport(EMPTY_REPORT);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [selectedDrawId, fromDate, toDate]);

  const resetFilters = () => {
    setSelectedDrawId('');
    setFromDate('');
    setToDate('');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Desglose de balance por asociados</h1>
        <p className="text-sm text-slate-500">Totales, asociado y sorteos en una sola tabla</p>
      </div>

      <Card>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <Select
              label="Sorteo"
              value={selectedDrawId}
              onChange={(e) => setSelectedDrawId(e.target.value)}
              options={[
                { value: '', label: 'Todos los sorteos' },
                ...draws.map((d) => ({
                  value: d.id,
                  label: `${d.name} (${formatDate(d.closeTime)})`,
                })),
              ]}
            />
            <Input
              label="Desde"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
            <Input
              label="Hasta"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
            <Button variant="secondary" onClick={resetFilters}>
              Limpiar filtros
            </Button>
          </div>
          {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-slate-800">Formato de evento</h2>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-slate-600 font-medium">Evento</th>
                <th className="text-center px-4 py-3 text-slate-600 font-medium">Tickets</th>
                <th className="text-right px-4 py-3 text-slate-600 font-medium">Venta</th>
                <th className="text-right px-4 py-3 text-slate-600 font-medium">Premios</th>
                <th className="text-right px-4 py-3 text-slate-600 font-medium">Balance</th>
                <th className="text-right px-4 py-3 text-slate-600 font-medium">Comision</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    Cargando reporte...
                  </td>
                </tr>
              ) : report.byAssociate.rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No hay registros para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                <>
                  <EventRow event="Totales" totals={report.byAssociate.totals} bold variant="grand-total" />
                  {report.byAssociate.rows.map((associate) => (
                    <Fragment key={associate.associateId}>
                      <EventRow
                        event={associate.associateName}
                        totals={mapAssociateToTotals(associate)}
                        bold
                        variant="associate-total"
                      />
                      {associate.draws.map((draw) => (
                        <EventRow
                          key={`${associate.associateId}-${draw.drawId}`}
                          event={draw.drawName}
                          totals={mapDrawToTotals(draw)}
                          indented
                          variant="draw"
                        />
                      ))}
                    </Fragment>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
