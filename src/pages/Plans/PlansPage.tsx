import { useCallback, useEffect, useState } from 'react';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { formatDate } from '@/utils/helpers';
import { Plan, User } from '@/types';
import { plansApi, usersApi, PlanPayload } from '@/services/api';

interface PlanFormData {
  name: string;
  multiplier: string;
  commission: string;
  masterId: string;
}

const emptyForm: PlanFormData = {
  name: '',
  multiplier: '60',
  commission: '10',
  masterId: '',
};

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [associates, setAssociates] = useState<User[]>([]);

  const loadPlans = useCallback(() => {
    plansApi.list().then(setPlans).catch(() => {});
  }, []);

  useEffect(() => {
    loadPlans();
    usersApi.list({ role: 'asociado' }).then(setAssociates).catch(() => {});
  }, [loadPlans]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [form, setForm] = useState<PlanFormData>(emptyForm);
  const [formError, setFormError] = useState('');

  const openCreate = () => {
    setEditingPlan(null);
    setForm(emptyForm);
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (p: Plan) => {
    setEditingPlan(p);
    setForm({
      name: p.name,
      multiplier: String(p.multiplier),
      commission: String(p.commission),
      masterId: p.masterId ?? '',
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!form.name) {
      setFormError('El nombre es requerido.');
      return;
    }
    const mult = parseFloat(form.multiplier);
    const comm = parseFloat(form.commission);
    if (isNaN(mult) || mult <= 0) {
      setFormError('El multiplicador debe ser un número positivo.');
      return;
    }
    if (isNaN(comm) || comm < 0 || comm > 100) {
      setFormError('La comisión debe estar entre 0 y 100.');
      return;
    }

    const payload: PlanPayload = {
      name: form.name,
      multiplier: mult,
      commission: comm,
      masterId: form.masterId || null,
    };

    try {
      if (editingPlan) {
        const updated = await plansApi.update(editingPlan.id, payload);
        setPlans((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      } else {
        await plansApi.create(payload);
        loadPlans();
      }
      setModalOpen(false);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setFormError(msg ?? 'Error al guardar el plan.');
    }
  };

  const deletePlan = async (id: string) => {
    if (!confirm('¿Eliminar este plan?')) return;
    try {
      await plansApi.delete(id);
      setPlans((prev) => prev.filter((p) => p.id !== id));
    } catch { /* ignore */ }
  };

  const getMasterName = (id?: string) => {
    if (!id) return '—';
    return associates.find((a) => a.id === id)?.fullName ?? '—';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Planes de Afiliados</h1>
          <p className="text-sm text-slate-500">Configuración de multiplicadores y comisiones</p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={16} />
          Nuevo Plan
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {plans.map((plan) => (
          <Card key={plan.id} className="hover:shadow-md transition-shadow">
            <CardBody>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-slate-900">{plan.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Creado {formatDate(plan.createdAt)}</p>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => openEdit(plan)}
                    className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Edit size={15} />
                  </button>
                  <button
                    onClick={() => deletePlan(plan.id)}
                    className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center p-2 bg-blue-50 rounded-lg">
                  <span className="text-sm text-slate-600">Multiplicador</span>
                  <span className="font-bold text-blue-700">×{plan.multiplier}</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-green-50 rounded-lg">
                  <span className="text-sm text-slate-600">Comisión</span>
                  <span className="font-bold text-green-700">{plan.commission}%</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-slate-50 rounded-lg">
                  <span className="text-sm text-slate-600">Asociado master</span>
                  <span className="text-sm font-medium text-slate-700">
                    {getMasterName(plan.masterId)}
                  </span>
                </div>
              </div>
            </CardBody>
          </Card>
        ))}

        {plans.length === 0 && (
          <div className="col-span-full text-center py-12 text-slate-500">
            No hay planes configurados. Crea el primero.
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingPlan ? 'Editar Plan' : 'Nuevo Plan'}
        size="md"
      >
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {formError}
            </div>
          )}
          <Input
            label="Nombre del plan"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Multiplicador (×)"
              type="number"
              min="1"
              step="1"
              value={form.multiplier}
              onChange={(e) => setForm({ ...form, multiplier: e.target.value })}
              required
            />
            <Input
              label="Comisión (%)"
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={form.commission}
              onChange={(e) => setForm({ ...form, commission: e.target.value })}
              required
            />
          </div>
          <Select
            label="Asociado master (opcional)"
            value={form.masterId}
            onChange={(e) => setForm({ ...form, masterId: e.target.value })}
            options={[
              { value: '', label: 'Sin master' },
              ...associates.map((a) => ({ value: a.id, label: a.fullName })),
            ]}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">{editingPlan ? 'Guardar cambios' : 'Crear plan'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
