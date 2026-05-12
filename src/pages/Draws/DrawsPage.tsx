import { useCallback, useEffect, useState } from 'react';
import { Plus, Edit, Trash2, AlertCircle, Zap, CalendarDays, LayoutGrid, List } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { formatDateTime } from '@/utils/helpers';
import { Draw, DrawStatus, SpecialMultiplier } from '@/types';
import { drawsApi, DrawPayload, specialMultipliersApi } from '@/services/api';

const STATUS_BADGE: Record<DrawStatus, 'success' | 'warning' | 'danger' | 'secondary'> = {
  abierto: 'success',
  pendiente: 'warning',
  cerrado: 'danger',
  finalizado: 'secondary',
};

interface DrawFormData {
  name: string;
  closeTime: string;
  minutosPreviosCierre: string;
  winnerNumber: string;
  specialMultiplierId: string;
}

interface DrawHistoryTemplate {
  key: string;
  name: string;
  closeTime: string;
}

function toHourMinuteLabel(iso: string): string {
  const date = new Date(iso);
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${hour}:${minute}`;
}

function buildHistoryKey(name: string, timeLabel: string): string {
  const normalizedName = name.trim().toLowerCase();
  return `${normalizedName}__${timeLabel}`;
}

type DrawsRange = 'today' | 'last7' | 'week' | 'month' | 'custom';
type DrawsViewMode = 'cards' | 'list';

const DRAWS_RANGE_STORAGE_KEY = 'go_draws_selected_range';
const DRAWS_CUSTOM_FROM_STORAGE_KEY = 'go_draws_custom_from_date';
const DRAWS_CUSTOM_TO_STORAGE_KEY = 'go_draws_custom_to_date';
const DRAWS_VIEW_MODE_STORAGE_KEY = 'go_draws_view_mode';

const DRAWS_RANGES: Array<{ key: DrawsRange; label: string }> = [
  { key: 'today', label: 'Hoy' },
  { key: 'last7', label: '7 dias' },
  { key: 'week', label: 'Semana' },
  { key: 'month', label: 'Mes' },
  { key: 'custom', label: 'Custom' },
];

function isDrawsRange(value: string): value is DrawsRange {
  return DRAWS_RANGES.some((range) => range.key === value);
}

function isDrawsViewMode(value: string): value is DrawsViewMode {
  return value === 'cards' || value === 'list';
}

function toISODateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDateRange(range: DrawsRange): { fromDate: string; toDate: string } {
  const now = new Date();
  const start = new Date(now);

  if (range === 'today') {
    return { fromDate: toISODateLocal(now), toDate: toISODateLocal(now) };
  }

  if (range === 'last7') {
    start.setDate(now.getDate() - 6);
    return { fromDate: toISODateLocal(start), toDate: toISODateLocal(now) };
  }

  if (range === 'week') {
    const mondayOffset = (now.getDay() + 6) % 7;
    start.setDate(now.getDate() - mondayOffset);
    return { fromDate: toISODateLocal(start), toDate: toISODateLocal(now) };
  }

  start.setDate(1);
  return { fromDate: toISODateLocal(start), toDate: toISODateLocal(now) };
}

const toDatetimeLocal = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function DrawsPage() {
  const PAGE_SIZE = 12;
  const HISTORY_LIMIT = 10;
  const [draws, setDraws] = useState<Draw[]>([]);
  const [totalDraws, setTotalDraws] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [drawHistory, setDrawHistory] = useState<DrawHistoryTemplate[]>([]);
  const [selectedHistoryKey, setSelectedHistoryKey] = useState('');
  const [specialMultipliers, setSpecialMultipliers] = useState<SpecialMultiplier[]>([]);
  const [customFromDate, setCustomFromDate] = useState<string>(() => {
    const savedFromDate = localStorage.getItem(DRAWS_CUSTOM_FROM_STORAGE_KEY);
    return savedFromDate || toISODateLocal(new Date());
  });
  const [customToDate, setCustomToDate] = useState<string>(() => {
    const savedToDate = localStorage.getItem(DRAWS_CUSTOM_TO_STORAGE_KEY);
    return savedToDate || toISODateLocal(new Date());
  });
  const [selectedRange, setSelectedRange] = useState<DrawsRange>(() => {
    const savedRange = localStorage.getItem(DRAWS_RANGE_STORAGE_KEY);
    if (savedRange && isDrawsRange(savedRange)) {
      return savedRange;
    }
    return 'today';
  });
  const [viewMode, setViewMode] = useState<DrawsViewMode>(() => {
    const savedViewMode = localStorage.getItem(DRAWS_VIEW_MODE_STORAGE_KEY);
    if (savedViewMode && isDrawsViewMode(savedViewMode)) {
      return savedViewMode;
    }
    return 'cards';
  });

  const isCustomRangeInvalid = selectedRange === 'custom' &&
    (!customFromDate || !customToDate || customFromDate > customToDate);

  const loadDraws = useCallback(async (targetPage: number) => {
    if (isCustomRangeInvalid) {
      setDraws([]);
      setTotalDraws(0);
      setTotalPages(1);
      setIsLoading(false);
      return;
    }

    const { fromDate, toDate } = selectedRange === 'custom'
      ? { fromDate: customFromDate, toDate: customToDate }
      : getDateRange(selectedRange);

    setIsLoading(true);
    try {
      const result = await drawsApi.listPaged({
        fromDate,
        toDate,
        page: targetPage,
        pageSize: PAGE_SIZE,
      });
      setDraws(result.items);
      setTotalDraws(result.total);
      setTotalPages(result.totalPages);
      if (result.page !== targetPage) {
        setPage(result.page);
      }
    } catch {
      setDraws([]);
      setTotalDraws(0);
      setTotalPages(1);
    } finally {
      setIsLoading(false);
    }
  }, [selectedRange, customFromDate, customToDate, isCustomRangeInvalid]);

  useEffect(() => {
    specialMultipliersApi.list().then(setSpecialMultipliers).catch(() => {});

    drawsApi.list().then((allDraws) => {
      const unique = new Map<string, DrawHistoryTemplate>();
      for (const draw of allDraws) {
        const timeLabel = toHourMinuteLabel(draw.closeTime);
        const key = buildHistoryKey(draw.name, timeLabel);
        if (!unique.has(key)) {
          unique.set(key, {
            key,
            name: draw.name.trim(),
            closeTime: draw.closeTime,
          });
        }
        if (unique.size >= HISTORY_LIMIT) break;
      }
      setDrawHistory(Array.from(unique.values()));
    }).catch(() => {
      setDrawHistory([]);
    });
  }, []);

  useEffect(() => {
    setPage(1);
  }, [selectedRange, customFromDate, customToDate]);

  useEffect(() => {
    loadDraws(page);
  }, [loadDraws, page]);

  useEffect(() => {
    localStorage.setItem(DRAWS_RANGE_STORAGE_KEY, selectedRange);
  }, [selectedRange]);

  useEffect(() => {
    localStorage.setItem(DRAWS_CUSTOM_FROM_STORAGE_KEY, customFromDate);
  }, [customFromDate]);

  useEffect(() => {
    localStorage.setItem(DRAWS_CUSTOM_TO_STORAGE_KEY, customToDate);
  }, [customToDate]);

  useEffect(() => {
    localStorage.setItem(DRAWS_VIEW_MODE_STORAGE_KEY, viewMode);
  }, [viewMode]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingDraw, setEditingDraw] = useState<Draw | null>(null);
  const [form, setForm] = useState<DrawFormData>({
    name: '',
    closeTime: '',
    minutosPreviosCierre: '10',
    winnerNumber: '',
    specialMultiplierId: '',
  });
  const [formError, setFormError] = useState('');

  // Restricted numbers editing
  const [rnDraw, setRnDraw] = useState<Draw | null>(null);
  const [rnNumber, setRnNumber] = useState('');
  const [rnLimit, setRnLimit] = useState('');

  const openCreate = () => {
    setEditingDraw(null);
    const now = new Date();
    const close = new Date(now);
    close.setHours(21, 0, 0, 0);
    setForm({
      name: '',
      closeTime: toDatetimeLocal(close.toISOString()),
      minutosPreviosCierre: '10',
      winnerNumber: '',
      specialMultiplierId: '',
    });
    setSelectedHistoryKey('');
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (d: Draw) => {
    setEditingDraw(d);
    setForm({
      name: d.name,
      closeTime: toDatetimeLocal(d.closeTime),
      minutosPreviosCierre: String(d.minutosPreviosCierre ?? 10),
      winnerNumber: d.winnerNumber ?? '',
      specialMultiplierId: d.specialMultiplier?.id ?? '',
    });
    setSelectedHistoryKey('');
    setFormError('');
    setModalOpen(true);
  };

  const applyDrawHistoryTemplate = (templateKey: string) => {
    setSelectedHistoryKey(templateKey);
    if (!templateKey) return;
    const template = drawHistory.find((item) => item.key === templateKey);
    if (!template) return;

    const sourceDate = new Date(template.closeTime);
    const targetDate = form.closeTime ? new Date(form.closeTime) : new Date();
    targetDate.setHours(sourceDate.getHours(), sourceDate.getMinutes(), 0, 0);

    setForm((prev) => ({
      ...prev,
      name: template.name,
      closeTime: toDatetimeLocal(targetDate.toISOString()),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!form.name || !form.closeTime || form.minutosPreviosCierre === '') {
      setFormError('Todos los campos son requeridos.');
      return;
    }
    const close = new Date(form.closeTime).toISOString();
    const minutosPreviosCierre = Number.parseInt(form.minutosPreviosCierre, 10);
    if (!Number.isFinite(minutosPreviosCierre) || minutosPreviosCierre < 0 || minutosPreviosCierre > 1440) {
      setFormError('El tiempo previo al cierre debe estar entre 0 y 1440 minutos.');
      return;
    }
    if (Number.isNaN(new Date(close).getTime())) {
      setFormError('La fecha y hora de cierre es inválida.');
      return;
    }

    const payload: DrawPayload = {
      name: form.name,
      closeTime: close,
      minutosPreviosCierre,
      winnerNumber: form.winnerNumber || null,
      specialMultiplierId: form.specialMultiplierId || null,
    };

    try {
      if (editingDraw) {
        await drawsApi.update(editingDraw.id, payload);
      } else {
        await drawsApi.create(payload);
      }
      loadDraws(page);
      setModalOpen(false);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setFormError(msg ?? 'Error al guardar el sorteo.');
    }
  };

  const deleteDraw = async (id: string) => {
    if (!confirm('¿Eliminar este sorteo?')) return;
    try {
      await drawsApi.delete(id);
      loadDraws(page);
    } catch { /* ignore */ }
  };

  const addRestrictedNumber = async () => {
    if (!rnDraw || !rnNumber || !rnLimit) return;
    const limit = parseInt(rnLimit);
    if (isNaN(limit) || limit <= 0) return;
    try {
      await drawsApi.addRestrictedNumber(rnDraw.id, rnNumber, limit);
      const updated = await drawsApi.get(rnDraw.id);
      setDraws((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      setRnDraw(updated);
      setRnNumber('');
      setRnLimit('');
    } catch { /* ignore */ }
  };

  const removeRestrictedNumber = async (draw: Draw, number: string) => {
    try {
      await drawsApi.removeRestrictedNumber(draw.id, number);
      const updated = await drawsApi.get(draw.id);
      setDraws((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      setRnDraw(updated);
    } catch { /* ignore */ }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sorteos</h1>
          <p className="text-sm text-slate-500">Gestión de sorteos y números restringidos</p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={16} />
          Nuevo Sorteo
        </Button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <CalendarDays size={13} />
              Filtro de fecha
            </div>

            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  viewMode === 'cards'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                <LayoutGrid size={13} />
                Cards
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  viewMode === 'list'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                <List size={13} />
                Lista
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1 sm:grid-cols-5">
            {DRAWS_RANGES.map((range) => {
              const isActive = selectedRange === range.key;
              return (
                <button
                  key={range.key}
                  type="button"
                  onClick={() => setSelectedRange(range.key)}
                  className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition ${
                    isActive
                      ? 'border-blue-200 bg-blue-600 text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {range.label}
                </button>
              );
            })}
          </div>

          {selectedRange === 'custom' && (
            <div className="mt-1 grid grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 sm:grid-cols-2">
              <label className="text-[11px] font-medium text-slate-600">
                Desde
                <input
                  type="date"
                  value={customFromDate}
                  onChange={(e) => setCustomFromDate(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <label className="text-[11px] font-medium text-slate-600">
                Hasta
                <input
                  type="date"
                  value={customToDate}
                  onChange={(e) => setCustomToDate(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              {isCustomRangeInvalid && (
                <p className="sm:col-span-2 text-xs text-red-600">
                  El rango es invalido: la fecha desde debe ser menor o igual que hasta.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Draws list */}
      {viewMode === 'cards' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {draws.map((draw) => (
            <Card key={draw.id} className="hover:shadow-md transition-shadow">
              <CardBody>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-slate-900">{draw.name}</h3>
                      <Badge variant={STATUS_BADGE[draw.status]} className="capitalize">
                        {draw.status}
                      </Badge>
                    </div>
                    <div className="space-y-1 text-sm text-slate-500">
                      <p>🔒 Cierre: {formatDateTime(draw.closeTime)}</p>
                      <p>⏱️ Bloqueo previo: {draw.minutosPreviosCierre} min</p>
                      {draw.winnerNumber && (
                        <p className="text-green-700 font-medium">🏆 Ganador: {draw.winnerNumber}</p>
                      )}
                      {draw.specialMultiplier && (
                        <p className="flex items-center gap-1 text-purple-700 font-medium">
                          <Zap size={12} />
                          Multiplicador: {draw.specialMultiplier.name} (×{draw.specialMultiplier.value})
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEdit(draw)}
                      className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Edit size={15} />
                    </button>
                    <button
                      onClick={() => deleteDraw(draw.id)}
                      className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Restricted numbers */}
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                      <AlertCircle size={12} />
                      Números restringidos ({draw.restrictedNumbers.length})
                    </span>
                    <button
                      onClick={() => setRnDraw(draw)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Gestionar
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {draw.restrictedNumbers.map((rn) => (
                      <span
                        key={rn.number}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-700 text-xs rounded-md font-mono"
                      >
                        {rn.number}
                        <span className="text-red-400">≤{rn.limit}</span>
                      </span>
                    ))}
                    {draw.restrictedNumbers.length === 0 && (
                      <span className="text-xs text-slate-400">Sin restricciones</span>
                    )}
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Sorteo</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Estado</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Cierre</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Bloqueo previo</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Ganador</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Multiplicador</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Restringidos</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-600">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {draws.map((draw) => (
                  <tr key={draw.id} className="border-t border-slate-100 align-top">
                    <td className="px-4 py-3 font-medium text-slate-900">{draw.name}</td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_BADGE[draw.status]} className="capitalize">
                        {draw.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatDateTime(draw.closeTime)}</td>
                    <td className="px-4 py-3 text-slate-600">{draw.minutosPreviosCierre} min</td>
                    <td className="px-4 py-3">
                      {draw.winnerNumber ? (
                        <span className="font-mono font-medium text-green-700">{draw.winnerNumber}</span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {draw.specialMultiplier ? (
                        <span className="inline-flex items-center gap-1 text-purple-700 font-medium">
                          <Zap size={12} />
                          {draw.specialMultiplier.name} (×{draw.specialMultiplier.value})
                        </span>
                      ) : (
                        <span className="text-slate-400">Sin multiplicador</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-600">{draw.restrictedNumbers.length}</span>
                        <button
                          onClick={() => setRnDraw(draw)}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Gestionar
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => openEdit(draw)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit size={15} />
                        </button>
                        <button
                          onClick={() => deleteDraw(draw.id)}
                          className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          {isLoading ? 'Cargando sorteos...' : `${totalDraws} sorteos en el rango seleccionado`}
        </p>
        <div className="inline-flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page <= 1 || isLoading}
          >
            Anterior
          </Button>
          <span className="text-xs text-slate-600">
            Página {page} de {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={page >= totalPages || isLoading}
          >
            Siguiente
          </Button>
        </div>
      </div>

      {!isLoading && draws.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          {isCustomRangeInvalid
            ? 'Rango inválido. Ajusta las fechas para ver resultados.'
            : 'No hay sorteos para el rango seleccionado.'}
        </div>
      )}

      {/* Draw Form Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingDraw ? 'Editar Sorteo' : 'Nuevo Sorteo'}
        size="md"
      >
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {formError}
            </div>
          )}
          <Input
            label="Nombre del sorteo"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          {!editingDraw && drawHistory.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">
                Histórico de sorteos recientes (haz clic para aplicar)
              </p>
              <div className="flex flex-wrap gap-2">
                {drawHistory.map((item) => {
                  const isSelected = selectedHistoryKey === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => applyDrawHistoryTemplate(item.key)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        isSelected
                          ? 'border-blue-300 bg-blue-100 text-blue-700'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {item.name} · {toHourMinuteLabel(item.closeTime)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Hora de cierre"
              type="datetime-local"
              value={form.closeTime}
              onChange={(e) => setForm({ ...form, closeTime: e.target.value })}
              required
            />
            <Input
              label="Tiempo previo de cierre (min)"
              type="number"
              min={0}
              max={1440}
              value={form.minutosPreviosCierre}
              onChange={(e) => setForm({ ...form, minutosPreviosCierre: e.target.value })}
              required
            />
          </div>
          {editingDraw && (
            <Input
              label="Número ganador (opcional)"
              value={form.winnerNumber}
              onChange={(e) => setForm({ ...form, winnerNumber: e.target.value.replace(/\D/g, '').slice(0, 2) })}
              placeholder="Dejar vacío si no hay ganador aún"
              maxLength={2}
            />
          )}
          <Select
            label="Multiplicador especial (opcional)"
            value={form.specialMultiplierId}
            onChange={(e) => setForm({ ...form, specialMultiplierId: e.target.value })}
            options={[
              { value: '', label: 'Sin multiplicador especial' },
              ...specialMultipliers.map((m) => ({ value: m.id, label: `${m.name} (×${m.value})` })),
            ]}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">{editingDraw ? 'Guardar cambios' : 'Crear sorteo'}</Button>
          </div>
        </form>
      </Modal>

      {/* Restricted Numbers Modal */}
      <Modal
        open={!!rnDraw}
        onClose={() => setRnDraw(null)}
        title={`Números Restringidos — ${rnDraw?.name ?? ''}`}
        size="md"
      >
        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-500">
            Define números con límites máximos de venta acumulada para toda la plataforma.
          </p>

          <div className="flex gap-2">
            <Input
              placeholder="Número (ej: 00)"
              value={rnNumber}
              onChange={(e) => setRnNumber(e.target.value.replace(/\D/g, '').slice(0, 2))}
              className="w-28"
            />
            <Input
              type="number"
              placeholder="Límite (C$)"
              value={rnLimit}
              onChange={(e) => setRnLimit(e.target.value)}
              className="flex-1"
            />
            <Button onClick={addRestrictedNumber} size="md">
              Agregar
            </Button>
          </div>

          <div className="space-y-2">
            {rnDraw?.restrictedNumbers.map((rn) => (
              <div
                key={rn.number}
                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-slate-800">{rn.number}</span>
                  <span className="text-sm text-slate-500">Límite: C$ {rn.limit}</span>
                </div>
                <button
                  onClick={() => rnDraw && removeRestrictedNumber(rnDraw, rn.number)}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {rnDraw?.restrictedNumbers.length === 0 && (
              <p className="text-slate-400 text-sm text-center py-4">Sin números restringidos</p>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
