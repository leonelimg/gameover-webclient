import { useState } from 'react';
import { Plus, Edit, Trash2, AlertCircle } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { db } from '@/utils/db';
import { generateId, formatDateTime, isDrawOpen } from '@/utils/helpers';
import { Draw, DrawStatus, RestrictedNumber } from '@/types';

const STATUS_BADGE: Record<DrawStatus, 'success' | 'warning' | 'danger' | 'secondary'> = {
  abierto: 'success',
  pendiente: 'warning',
  cerrado: 'danger',
  finalizado: 'secondary',
};

function useDraws() {
  const [draws, setDraws] = useState<Draw[]>(() => {
    // Refresh statuses on load
    const stored = db.getDraws();
    const updated = stored.map((d) => {
      if (d.status === 'finalizado') return d;
      const now = Date.now();
      const open = new Date(d.openTime).getTime();
      const close = new Date(d.closeTime).getTime();
      let status: DrawStatus = d.status;
      if (now < open) status = 'pendiente';
      else if (now >= open && now <= close) status = 'abierto';
      else if (now > close && !d.winnerNumber) status = 'cerrado';
      return { ...d, status };
    });
    db.saveDraws(updated);
    return updated;
  });

  const persist = (next: Draw[]) => {
    setDraws(next);
    db.saveDraws(next);
  };
  return { draws, persist };
}

interface DrawFormData {
  name: string;
  openTime: string;
  closeTime: string;
  winnerNumber: string;
}

const toDatetimeLocal = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function DrawsPage() {
  const { draws, persist } = useDraws();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingDraw, setEditingDraw] = useState<Draw | null>(null);
  const [form, setForm] = useState<DrawFormData>({
    name: '',
    openTime: '',
    closeTime: '',
    winnerNumber: '',
  });
  const [formError, setFormError] = useState('');

  // Restricted numbers editing
  const [rnDraw, setRnDraw] = useState<Draw | null>(null);
  const [rnNumber, setRnNumber] = useState('');
  const [rnLimit, setRnLimit] = useState('');

  const openCreate = () => {
    setEditingDraw(null);
    const now = new Date();
    const open = new Date(now);
    open.setHours(8, 0, 0, 0);
    const close = new Date(now);
    close.setHours(21, 0, 0, 0);
    setForm({
      name: '',
      openTime: toDatetimeLocal(open.toISOString()),
      closeTime: toDatetimeLocal(close.toISOString()),
      winnerNumber: '',
    });
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (d: Draw) => {
    setEditingDraw(d);
    setForm({
      name: d.name,
      openTime: toDatetimeLocal(d.openTime),
      closeTime: toDatetimeLocal(d.closeTime),
      winnerNumber: d.winnerNumber ?? '',
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!form.name || !form.openTime || !form.closeTime) {
      setFormError('Todos los campos son requeridos.');
      return;
    }
    const open = new Date(form.openTime).toISOString();
    const close = new Date(form.closeTime).toISOString();
    if (new Date(close) <= new Date(open)) {
      setFormError('La hora de cierre debe ser posterior a la de apertura.');
      return;
    }

    if (editingDraw) {
      persist(
        draws.map((d) =>
          d.id === editingDraw.id
            ? {
                ...d,
                name: form.name,
                openTime: open,
                closeTime: close,
                winnerNumber: form.winnerNumber || undefined,
                status: form.winnerNumber
                  ? 'finalizado'
                  : (isDrawOpen(open, close) ? 'abierto' : 'pendiente'),
              }
            : d
        )
      );
    } else {
      const newDraw: Draw = {
        id: generateId(),
        name: form.name,
        openTime: open,
        closeTime: close,
        status: isDrawOpen(open, close) ? 'abierto' : 'pendiente',
        restrictedNumbers: [],
        createdAt: new Date().toISOString(),
      };
      persist([...draws, newDraw]);
    }
    setModalOpen(false);
  };

  const deleteDraw = (id: string) => {
    if (confirm('¿Eliminar este sorteo?')) {
      persist(draws.filter((d) => d.id !== id));
    }
  };

  const addRestrictedNumber = () => {
    if (!rnDraw || !rnNumber || !rnLimit) return;
    const limit = parseInt(rnLimit);
    if (isNaN(limit) || limit <= 0) return;
    const updated = draws.map((d) => {
      if (d.id !== rnDraw.id) return d;
      const existing = d.restrictedNumbers.find((rn) => rn.number === rnNumber);
      const restrictedNumbers: RestrictedNumber[] = existing
        ? d.restrictedNumbers.map((rn) =>
            rn.number === rnNumber ? { ...rn, limit } : rn
          )
        : [...d.restrictedNumbers, { number: rnNumber, limit }];
      return { ...d, restrictedNumbers };
    });
    persist(updated);
    setRnDraw(updated.find((d) => d.id === rnDraw.id) ?? null);
    setRnNumber('');
    setRnLimit('');
  };

  const removeRestrictedNumber = (draw: Draw, number: string) => {
    const updated = draws.map((d) =>
      d.id === draw.id
        ? { ...d, restrictedNumbers: d.restrictedNumbers.filter((rn) => rn.number !== number) }
        : d
    );
    persist(updated);
    setRnDraw(updated.find((d) => d.id === draw.id) ?? null);
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

      {/* Draws list */}
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
                    <p>🔓 Apertura: {formatDateTime(draw.openTime)}</p>
                    <p>🔒 Cierre: {formatDateTime(draw.closeTime)}</p>
                    {draw.winnerNumber && (
                      <p className="text-green-700 font-medium">🏆 Ganador: {draw.winnerNumber}</p>
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

        {draws.length === 0 && (
          <div className="col-span-full text-center py-12 text-slate-500">
            No hay sorteos. Crea el primero.
          </div>
        )}
      </div>

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
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Hora de apertura"
              type="datetime-local"
              value={form.openTime}
              onChange={(e) => setForm({ ...form, openTime: e.target.value })}
              required
            />
            <Input
              label="Hora de cierre"
              type="datetime-local"
              value={form.closeTime}
              onChange={(e) => setForm({ ...form, closeTime: e.target.value })}
              required
            />
          </div>
          {editingDraw && (
            <Input
              label="Número ganador (opcional)"
              value={form.winnerNumber}
              onChange={(e) => setForm({ ...form, winnerNumber: e.target.value })}
              placeholder="Dejar vacío si no hay ganador aún"
              maxLength={4}
            />
          )}
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
              onChange={(e) => setRnNumber(e.target.value.slice(0, 4))}
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
                  onClick={() => removeRestrictedNumber(rnDraw!, rn.number)}
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
