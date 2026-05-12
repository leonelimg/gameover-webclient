import { useEffect, useMemo, useState } from 'react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { drawsApi, DrawListsResponse, reportsApi, usersApi } from '@/services/api';
import { Draw, User } from '@/types';
import { formatCurrency, formatDate } from '@/utils/helpers';

const COLUMN_OPTIONS = [
  { value: '2', label: '2 Columnas' },
  { value: '3', label: '3 Columnas' },
  { value: '4', label: '4 Columnas' },
  { value: '5', label: '5 Columnas' },
];

const buildEmptyReport = (): DrawListsResponse => ({
  filters: {
    drawId: null,
    userId: null,
    fromDate: null,
    toDate: null,
  },
  totals: {
    ticketCount: 0,
    totalAmount: 0,
  },
  numbers: Array.from({ length: 100 }, (_, index) => ({
    number: index.toString().padStart(2, '0'),
    total: 0,
  })),
});

function splitInColumns<T>(items: T[], columns: number): T[][] {
  if (columns <= 0) return [items];
  const size = Math.ceil(items.length / columns);

  return Array.from({ length: columns }, (_, index) => {
    const start = index * size;
    return items.slice(start, start + size);
  }).filter((chunk) => chunk.length > 0);
}

export default function DrawListsPage() {
  const [draws, setDraws] = useState<Draw[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const [selectedDrawId, setSelectedDrawId] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [columnsToShow, setColumnsToShow] = useState('4');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState<DrawListsResponse>(buildEmptyReport());

  useEffect(() => {
    drawsApi.list().then(setDraws).catch(() => {});
    usersApi.list().then(setUsers).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError('');

    reportsApi.drawLists({
      drawId: selectedDrawId || undefined,
      userId: selectedUserId || undefined,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
    })
      .then(setReport)
      .catch((err: unknown) => {
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
        setError(msg ?? 'No fue posible cargar la lista de sorteos.');
        setReport(buildEmptyReport());
      })
      .finally(() => setLoading(false));
  }, [selectedDrawId, selectedUserId, fromDate, toDate]);

  const columnCount = useMemo(() => {
    const parsed = Number.parseInt(columnsToShow, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return 4;
    return parsed;
  }, [columnsToShow]);

  const chunkedRows = useMemo(
    () => splitInColumns(report.numbers, columnCount),
    [report.numbers, columnCount]
  );

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
    setFromDate('');
    setToDate('');
  };

  const handleExportText = () => {
    const lines: string[] = [];
    lines.push('LISTAS DE SORTEOS');
    lines.push(`Fecha: ${new Date().toLocaleString()}`);
    lines.push(`Sorteo: ${draws.find((d) => d.id === selectedDrawId)?.name ?? 'Todos'}`);
    lines.push(`Usuario: ${users.find((u) => u.id === selectedUserId)?.fullName ?? 'Todos'}`);
    lines.push(`Tickets: ${report.totals.ticketCount}`);
    lines.push('');

    for (const row of report.numbers) {
      lines.push(`${row.number}\t${row.total.toFixed(2)}`);
    }

    lines.push('');
    lines.push(`TOTAL\t${report.totals.totalAmount.toFixed(2)}`);

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `listas-sorteos-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Listas de sorteos</h1>
        <p className="text-sm text-slate-500">Montos acumulados por numero (00 al 99)</p>
      </div>

      <Card>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
            <Select
              label="Sorteo"
              value={selectedDrawId}
              onChange={(e) => setSelectedDrawId(e.target.value)}
              options={[
                { value: '', label: 'Todos los sorteos' },
                ...draws.map((d) => ({ value: d.id, label: `${d.name} (${formatDate(d.closeTime)})` })),
              ]}
            />
            <Select
              label="Usuario"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              options={userOptions}
            />
            <Select
              label="Mostrar en"
              value={columnsToShow}
              onChange={(e) => setColumnsToShow(e.target.value)}
              options={COLUMN_OPTIONS}
            />
            <Input label="Desde" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            <Input label="Hasta" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            <Button variant="secondary" onClick={resetFilters}>Limpiar filtros</Button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={handleExportText}>Exportar texto</Button>
            <Button variant="ghost" onClick={() => window.print()}>Imprimir</Button>
            <p className="text-xs text-slate-500 ml-auto">Tickets en filtro: {report.totals.ticketCount}</p>
          </div>

          {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-slate-800">Lista por numero</h2>
        </CardHeader>
        <CardBody>
          {loading ? (
            <p className="text-center text-slate-500 py-10">Cargando reporte...</p>
          ) : (
            <>
              <div
                className="grid gap-4"
                style={{ gridTemplateColumns: `repeat(${chunkedRows.length}, minmax(0, 1fr))` }}
              >
                {chunkedRows.map((columnRows, index) => {
                  const subtotal = columnRows.reduce((acc, row) => acc + row.total, 0);

                  return (
                    <div key={`column-${index}`} className="overflow-hidden rounded-lg border border-slate-200">
                      <table className="w-full text-sm">
                        <thead className="bg-blue-600 text-white">
                          <tr>
                            <th className="text-left px-3 py-2 font-semibold">Num.</th>
                            <th className="text-right px-3 py-2 font-semibold">Monto</th>
                          </tr>
                        </thead>
                        <tbody>
                          {columnRows.map((row) => (
                            <tr key={row.number} className="border-t border-slate-100">
                              <td className="px-3 py-2 font-medium text-slate-800">{row.number}</td>
                              <td className="px-3 py-2 text-right text-slate-700">
                                {row.total === 0 ? '0' : formatCurrency(row.total)}
                              </td>
                            </tr>
                          ))}
                          <tr className="border-t border-slate-200 bg-slate-50">
                            <td className="px-3 py-2 font-semibold text-slate-700">Subtotal</td>
                            <td className="px-3 py-2 text-right font-semibold text-slate-900">
                              {formatCurrency(subtotal)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 flex justify-end">
                <p className="text-base font-semibold text-slate-900">
                  Total {formatCurrency(report.totals.totalAmount)}
                </p>
              </div>
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
