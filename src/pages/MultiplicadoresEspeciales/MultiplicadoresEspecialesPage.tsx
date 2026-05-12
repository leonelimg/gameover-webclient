import { useCallback, useEffect, useState } from 'react';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { SpecialMultiplier } from '@/types';
import { specialMultipliersApi, SpecialMultiplierPayload } from '@/services/api';

interface FormData {
  name: string;
  value: string;
}

const emptyForm: FormData = { name: '', value: '2' };

export default function MultiplicadoresEspecialesPage() {
  const [items, setItems] = useState<SpecialMultiplier[]>([]);

  const loadItems = useCallback(() => {
    specialMultipliersApi.list().then(setItems).catch(() => {});
  }, []);

  useEffect(() => { loadItems(); }, [loadItems]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SpecialMultiplier | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [formError, setFormError] = useState('');

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (item: SpecialMultiplier) => {
    setEditing(item);
    setForm({ name: item.name, value: String(item.value) });
    setFormError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!form.name.trim()) {
      setFormError('El nombre es requerido.');
      return;
    }

    const value = parseInt(form.value, 10);
    if (isNaN(value) || value < 1 || value > 10) {
      setFormError('El valor debe ser un número entero entre 1 y 10.');
      return;
    }

    const payload: SpecialMultiplierPayload = { name: form.name.trim(), value };

    try {
      if (editing) {
        const updated = await specialMultipliersApi.update(editing.id, payload);
        setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      } else {
        await specialMultipliersApi.create(payload);
        loadItems();
      }
      setModalOpen(false);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setFormError(msg ?? 'Error al guardar el multiplicador.');
    }
  };

  const deleteItem = async (id: string) => {
    if (!confirm('¿Eliminar este multiplicador especial? Los sorteos vinculados quedarán sin multiplicador.')) return;
    try {
      await specialMultipliersApi.delete(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch { /* ignore */ }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Multiplicadores especiales</h1>
          <p className="text-sm text-slate-500">Configura multiplicadores para asociarlos a sorteos</p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={16} />
          Nuevo multiplicador
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {items.map((item) => (
          <Card key={item.id} className="hover:shadow-md transition-shadow">
            <CardBody>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-slate-900">{item.name}</h3>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => openEdit(item)}
                    className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Edit size={15} />
                  </button>
                  <button
                    onClick={() => deleteItem(item.id)}
                    className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                <span className="text-sm text-slate-600">Valor</span>
                <span className="font-bold text-purple-700 text-lg">×{item.value}</span>
              </div>
            </CardBody>
          </Card>
        ))}

        {items.length === 0 && (
          <div className="col-span-full text-center py-12 text-slate-500">
            No hay multiplicadores especiales. Crea el primero.
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar multiplicador' : 'Nuevo multiplicador especial'}
        size="sm"
      >
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {formError}
            </div>
          )}
          <Input
            label="Nombre"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ej: Especial 2x"
            required
          />
          <Input
            label="Valor (1 – 10)"
            type="number"
            min="1"
            max="10"
            step="1"
            value={form.value}
            onChange={(e) => setForm({ ...form, value: e.target.value })}
            required
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">{editing ? 'Guardar cambios' : 'Crear'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
