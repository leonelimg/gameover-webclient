import { useEffect, useRef, useState } from 'react';
import { Bell, Plus, Pencil, Trash2, Image, X } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/context/AuthContext';
import { announcementsApi } from '@/services/api';
import { Announcement, AnnouncementPayload } from '@/types';
import { format, parseISO, isAfter, isBefore } from 'date-fns';

// ── Helpers ───────────────────────────────────────────────────────────────────

const BASE_URL = (import.meta.env['VITE_API_URL'] as string | undefined) ?? 'http://localhost:4000';

function getStatus(a: Announcement): { label: string; variant: 'success' | 'warning' | 'secondary' } {
  const now = new Date();
  const start = parseISO(a.startDate);
  const end = parseISO(a.endDate);
  if (isAfter(now, end)) return { label: 'Expirado', variant: 'secondary' };
  if (isBefore(now, start)) return { label: 'Próximo', variant: 'warning' };
  return { label: 'Activo', variant: 'success' };
}

function formatDate(iso: string) {
  return format(parseISO(iso), 'dd/MM/yyyy');
}

// ── Form ──────────────────────────────────────────────────────────────────────

interface FormState {
  name: string;
  message: string;
  startDate: string;
  endDate: string;
  imageFile: File | null;
  imagePreview: string | null;
  clearImage: boolean;
}

function toISODate(dt: string): string {
  // Backend expects an ISO string; date inputs give YYYY-MM-DD, convert to ISO start of day
  if (!dt) return '';
  return new Date(dt + 'T00:00:00').toISOString();
}

function toDateInputValue(iso: string): string {
  if (!iso) return '';
  try {
    return parseISO(iso).toISOString().substring(0, 10);
  } catch {
    return iso.substring(0, 10);
  }
}

interface AnnouncementFormProps {
  initial?: Announcement | null;
  onSave: (payload: AnnouncementPayload) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
}

function AnnouncementForm({ initial, onSave, onCancel, saving, error }: AnnouncementFormProps) {
  const [form, setForm] = useState<FormState>({
    name: initial?.name ?? '',
    message: initial?.message ?? '',
    startDate: initial ? toDateInputValue(initial.startDate) : '',
    endDate: initial ? toDateInputValue(initial.endDate) : '',
    imageFile: null,
    imagePreview: initial?.imageUrl ? `${BASE_URL}${initial.imageUrl}` : null,
    clearImage: false,
  });

  const fileRef = useRef<HTMLInputElement>(null);

  const set = (field: keyof FormState, value: unknown) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    set('imageFile', file);
    set('clearImage', false);
    const reader = new FileReader();
    reader.onload = (ev) => set('imagePreview', ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    set('imageFile', null);
    set('imagePreview', null);
    set('clearImage', true);
    if (fileRef.current) fileRef.current.value = '';
  };

  const submit = async () => {
    const payload: AnnouncementPayload = {
      name: form.name.trim(),
      message: form.message.trim() || undefined,
      startDate: toISODate(form.startDate),
      endDate: toISODate(form.endDate),
      image: form.imageFile ?? undefined,
      clearImage: form.clearImage,
    };
    await onSave(payload);
  };

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Nombre <span className="text-red-500">*</span>
        </label>
        <Input
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="Nombre del anuncio"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Mensaje</label>
        <textarea
          value={form.message}
          onChange={(e) => set('message', e.target.value)}
          placeholder="Texto del anuncio (opcional)"
          rows={4}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Fecha inicio <span className="text-red-500">*</span>
          </label>
          <Input
            type="date"
            value={form.startDate}
            onChange={(e) => set('startDate', e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Fecha fin <span className="text-red-500">*</span>
          </label>
          <Input
            type="date"
            value={form.endDate}
            onChange={(e) => set('endDate', e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Imagen (opcional)</label>
        {form.imagePreview ? (
          <div className="relative w-full rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
            <img
              src={form.imagePreview}
              alt="Preview"
              className="w-full max-h-48 object-contain"
            />
            <button
              type="button"
              onClick={removeImage}
              className="absolute top-2 right-2 bg-white rounded-full p-1 shadow hover:bg-red-50 text-slate-600 hover:text-red-600 transition-colors"
              title="Eliminar imagen"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-slate-300 rounded-lg text-sm text-slate-500 hover:border-blue-400 hover:text-blue-600 transition-colors w-full justify-center"
          >
            <Image size={16} />
            Seleccionar imagen
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button onClick={submit} loading={saving} disabled={saving}>
          {initial ? 'Guardar cambios' : 'Crear anuncio'}
        </Button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AnnouncementsPage() {
  const { hasPermission } = useAuth();
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canCreate = hasPermission('/announcements:create');
  const canUpdate = hasPermission('/announcements:update');
  const canDelete = hasPermission('/announcements:delete');

  const load = () => {
    setLoading(true);
    setPageError(null);
    announcementsApi
      .list()
      .then(setItems)
      .catch(() => setPageError('No se pudieron cargar los anuncios.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (a: Announcement) => {
    setEditing(a);
    setFormError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setFormError(null);
  };

  const handleSave = async (payload: AnnouncementPayload) => {
    if (!payload.name.trim()) {
      setFormError('El nombre es requerido.');
      return;
    }
    if (!payload.startDate || !payload.endDate) {
      setFormError('Las fechas de inicio y fin son requeridas.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (editing) {
        await announcementsApi.update(editing.id, payload);
      } else {
        await announcementsApi.create(payload);
      }
      closeModal();
      load();
    } catch {
      setFormError('No se pudo guardar el anuncio. Intenta nuevamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await announcementsApi.delete(deleteTarget.id);
      setDeleteTarget(null);
      load();
    } catch {
      setPageError('No se pudo eliminar el anuncio.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Anuncios</h1>
          <p className="text-sm text-slate-500">Gestión de notificaciones y anuncios del sistema</p>
        </div>
        {canCreate && (
          <Button onClick={openCreate}>
            <Plus size={16} />
            Nuevo anuncio
          </Button>
        )}
      </div>

      {pageError && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {pageError}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell size={18} className="text-slate-500" />
            <h2 className="font-semibold text-slate-800">Listado de anuncios</h2>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-slate-600 font-medium">Nombre</th>
                <th className="text-left px-4 py-3 text-slate-600 font-medium">Mensaje</th>
                <th className="text-center px-4 py-3 text-slate-600 font-medium">Imagen</th>
                <th className="text-left px-4 py-3 text-slate-600 font-medium">Vigencia</th>
                <th className="text-center px-4 py-3 text-slate-600 font-medium">Estado</th>
                <th className="text-center px-4 py-3 text-slate-600 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    Cargando...
                  </td>
                </tr>
              )}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    No hay anuncios registrados.
                  </td>
                </tr>
              )}
              {!loading &&
                items.map((item) => {
                  const status = getStatus(item);
                  return (
                    <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">{item.name}</td>
                      <td className="px-4 py-3 text-slate-600 max-w-xs">
                        {item.message ? (
                          <span className="line-clamp-2">{item.message}</span>
                        ) : (
                          <span className="text-slate-400 italic">Sin mensaje</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {item.imageUrl ? (
                          <img
                            src={`${BASE_URL}${item.imageUrl}`}
                            alt={item.name}
                            className="w-12 h-12 object-cover rounded-lg inline-block border border-slate-200"
                          />
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">
                        {formatDate(item.startDate)} – {formatDate(item.endDate)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          {canUpdate && (
                            <button
                              onClick={() => openEdit(item)}
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Editar"
                            >
                              <Pencil size={15} />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => setDeleteTarget(item)}
                              className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Eliminar"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                          {!canUpdate && !canDelete && (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? 'Editar anuncio' : 'Nuevo anuncio'}
        size="md"
      >
        <AnnouncementForm
          initial={editing}
          onSave={handleSave}
          onCancel={closeModal}
          saving={saving}
          error={formError}
        />
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Eliminar anuncio"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            ¿Estás seguro de que deseas eliminar el anuncio{' '}
            <span className="font-semibold text-slate-800">"{deleteTarget?.name}"</span>? Esta acción
            no se puede deshacer.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={deleting} disabled={deleting}>
              Eliminar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
