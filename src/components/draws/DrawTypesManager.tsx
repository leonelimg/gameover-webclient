import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit2, Trash2, ShieldAlert, Hash, DollarSign, Award, Layers, ExternalLink } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { DrawType } from '@/types';
import { drawTypesApi, DrawTypePayload } from '@/services/api';
import { formatCurrency } from '@/utils/helpers';

interface DrawTypesManagerProps {
  onDrawTypeChanged?: () => void;
}

export function DrawTypesManager({ onDrawTypeChanged }: DrawTypesManagerProps) {
  const navigate = useNavigate();
  const [drawTypes, setDrawTypes] = useState<DrawType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal State for Create/Edit DrawType
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<DrawType | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [digits, setDigits] = useState<number>(2);
  const [multiplier, setMultiplier] = useState<string>('80');
  const [maxDrawSales, setMaxDrawSales] = useState<string>('');
  const [globalNumberLimit, setGlobalNumberLimit] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');

  const fetchDrawTypes = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await drawTypesApi.list();
      setDrawTypes(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cargar los tipos de sorteo.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDrawTypes();
  }, [fetchDrawTypes]);

  const handleOpenCreateModal = () => {
    setEditingType(null);
    setName('');
    setDescription('');
    setDigits(2);
    setMultiplier('80');
    setMaxDrawSales('');
    setGlobalNumberLimit('');
    setModalError('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (dt: DrawType) => {
    setEditingType(dt);
    setName(dt.name);
    setDescription(dt.description ?? '');
    setDigits(dt.digits);
    setMultiplier(dt.multiplier.toString());
    setMaxDrawSales(dt.maxDrawSales !== null && dt.maxDrawSales !== undefined ? dt.maxDrawSales.toString() : '');
    setGlobalNumberLimit(dt.globalNumberLimit !== null && dt.globalNumberLimit !== undefined ? dt.globalNumberLimit.toString() : '');
    setModalError('');
    setIsModalOpen(true);
  };

  const handleSaveDrawType = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');

    if (!name.trim()) {
      setModalError('El nombre es requerido.');
      return;
    }

    const multVal = parseFloat(multiplier);
    if (isNaN(multVal) || multVal <= 0) {
      setModalError('El multiplicador debe ser un número positivo.');
      return;
    }

    const maxSalesVal = maxDrawSales.trim() ? parseFloat(maxDrawSales) : null;
    if (maxSalesVal !== null && (isNaN(maxSalesVal) || maxSalesVal <= 0)) {
      setModalError('El límite de venta total debe ser un número positivo.');
      return;
    }

    const globalNumLimitVal = globalNumberLimit.trim() ? parseFloat(globalNumberLimit) : null;
    if (globalNumLimitVal !== null && (isNaN(globalNumLimitVal) || globalNumLimitVal <= 0)) {
      setModalError('El límite global por número debe ser un número positivo.');
      return;
    }

    const payload: DrawTypePayload = {
      name: name.trim(),
      description: description.trim() || null,
      digits: Number(digits),
      multiplier: multVal,
      maxDrawSales: maxSalesVal,
      globalNumberLimit: globalNumLimitVal,
    };

    setSaving(true);
    try {
      if (editingType) {
        await drawTypesApi.update(editingType.id, payload);
      } else {
        await drawTypesApi.create(payload);
      }
      setIsModalOpen(false);
      await fetchDrawTypes();
      onDrawTypeChanged?.();
    } catch (err: unknown) {
      const resMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setModalError(resMsg || (err instanceof Error ? err.message : 'Error al guardar el tipo de sorteo.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDrawType = async (dt: DrawType) => {
    if (!window.confirm(`¿Estás seguro de eliminar el tipo de sorteo "${dt.name}"?`)) {
      return;
    }

    try {
      await drawTypesApi.delete(dt.id);
      await fetchDrawTypes();
      onDrawTypeChanged?.();
    } catch (err: unknown) {
      const resMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(resMsg || 'Error al eliminar el tipo de sorteo.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Layers className="text-blue-600" size={22} />
            Tipos de Sorteo a Nivel de Sistema
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Configura los parámetros globales de cada tipo de sorteo (dígitos, multiplicador y límites).
          </p>
        </div>
        <Button onClick={handleOpenCreateModal} className="flex items-center gap-2">
          <Plus size={18} />
          Nuevo Tipo de Sorteo
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-slate-500">
          Cargando tipos de sorteo...
        </div>
      ) : drawTypes.length === 0 ? (
        <Card className="p-12 text-center">
          <Layers className="mx-auto text-slate-400 mb-3" size={40} />
          <h3 className="text-lg font-semibold text-slate-800 mb-1">
            No hay tipos de sorteo configurados
          </h3>
          <p className="text-slate-500 text-sm mb-4">
            Crea un tipo de sorteo para definir las reglas de dígitos y multiplicadores.
          </p>
          <Button onClick={handleOpenCreateModal}>Crear primer Tipo de Sorteo</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {drawTypes.map((dt) => (
            <Card key={dt.id} className="hover:shadow-md transition-shadow flex flex-col justify-between">
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-lg text-slate-900">{dt.name}</h3>
                    <Badge variant="info">
                      {dt.digits} {dt.digits === 1 ? 'Dígito' : 'Dígitos'}
                    </Badge>
                  </div>
                  {dt.description && (
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                      {dt.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenEditModal(dt)}
                    title="Editar"
                    className="p-1.5"
                  >
                    <Edit2 size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteDrawType(dt)}
                    title="Eliminar"
                    className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </CardHeader>

              <CardBody className="space-y-3 pt-2">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-slate-500 block mb-0.5 flex items-center gap-1">
                      <Award size={12} className="text-amber-500" /> Multiplicador:
                    </span>
                    <span className="font-bold text-slate-900 text-sm">
                      {dt.multiplier}x
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-slate-500 block mb-0.5 flex items-center gap-1">
                      <Hash size={12} className="text-blue-500" /> Sorteos creados:
                    </span>
                    <span className="font-bold text-slate-900 text-sm">
                      {dt._count?.draws ?? 0}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between items-center text-slate-600">
                    <span className="flex items-center gap-1">
                      <DollarSign size={13} className="text-emerald-500" /> Límite venta sorteo:
                    </span>
                    <span className="font-semibold text-slate-900">
                      {dt.maxDrawSales !== null && dt.maxDrawSales !== undefined
                        ? formatCurrency(dt.maxDrawSales)
                        : 'Sin límite'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-slate-600">
                    <span className="flex items-center gap-1">
                      <ShieldAlert size={13} className="text-purple-500" /> Límite base/número:
                    </span>
                    <span className="font-semibold text-slate-900">
                      {dt.globalNumberLimit !== null && dt.globalNumberLimit !== undefined
                        ? formatCurrency(dt.globalNumberLimit)
                        : 'Sin límite'}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
                  <span className="text-xs text-slate-500">
                    {dt.restrictedNumbers?.length ?? 0} números restringidos
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => navigate(`/restrictions/global-numbers?drawTypeId=${dt.id}`)}
                    className="text-xs py-1 px-2.5 flex items-center gap-1"
                    title="Administrar números restringidos en el módulo de Restricciones"
                  >
                    <span>Restricciones</span>
                    <ExternalLink size={12} />
                  </Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* Modal Create/Edit DrawType */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingType ? `Editar Tipo de Sorteo: ${editingType.name}` : 'Nuevo Tipo de Sorteo'}
      >
        <form onSubmit={handleSaveDrawType} className="p-6 space-y-4">
          {modalError && (
            <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">
              {modalError}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Nombre del Tipo de Sorteo *
            </label>
            <Input
              type="text"
              placeholder="Ej. Diaria 2D, Pick 3, Super 4D"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Descripción
            </label>
            <Input
              type="text"
              placeholder="Descripción o detalles opcionales"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Cantidad de Dígitos *
              </label>
              <Select
                value={digits.toString()}
                onChange={(e) => setDigits(parseInt(e.target.value, 10))}
                options={[
                  { value: '2', label: '2 Dígitos (00 - 99)' },
                  { value: '3', label: '3 Dígitos (000 - 999)' },
                  { value: '4', label: '4 Dígitos (0000 - 9999)' },
                ]}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Multiplicador base (x) *
              </label>
              <Input
                type="number"
                step="any"
                min="1"
                placeholder="Ej. 80, 600, 4000"
                value={multiplier}
                onChange={(e) => setMultiplier(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Límite General de Venta por Sorteo (C$)
            </label>
            <Input
              type="number"
              step="any"
              min="0"
              placeholder="Dejar en blanco para sin límite"
              value={maxDrawSales}
              onChange={(e) => setMaxDrawSales(e.target.value)}
            />
            <span className="text-xs text-slate-500 mt-1 block">
              Venta total máxima permitida acumulada entre todos los vendedores en un sorteo de este tipo.
            </span>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Límite Global Base por Número (C$)
            </label>
            <Input
              type="number"
              step="any"
              min="0"
              placeholder="Dejar en blanco para sin límite por defecto"
              value={globalNumberLimit}
              onChange={(e) => setGlobalNumberLimit(e.target.value)}
            />
            <span className="text-xs text-slate-500 mt-1 block">
              Monto máximo predeterminado a jugar a cualquier número de este tipo de sorteo.
            </span>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Guardando...' : editingType ? 'Guardar Cambios' : 'Crear Tipo de Sorteo'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
