import { useCallback, useEffect, useState } from 'react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { numberRestrictionsApi, drawTypesApi } from '@/services/api';
import { DrawType } from '@/types';

export default function NumberRestrictionsPage() {
  const [drawTypes, setDrawTypes] = useState<DrawType[]>([]);
  const [selectedDrawTypeId, setSelectedDrawTypeId] = useState<string>('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [globalLimit, setGlobalLimit] = useState('');
  const [maxDrawSales, setMaxDrawSales] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadDrawTypes = useCallback(async () => {
    try {
      const list = await drawTypesApi.list();
      setDrawTypes(list);
      if (list.length > 0 && !selectedDrawTypeId) {
        setSelectedDrawTypeId(list[0].id);
      }
    } catch {
      setError('No se pudieron cargar los tipos de sorteo.');
    }
  }, [selectedDrawTypeId]);

  const loadLimits = useCallback(async (dtId?: string) => {
    setLoading(true);
    setError('');
    try {
      const settings = await numberRestrictionsApi.getGlobal(dtId || undefined);
      setGlobalLimit(settings.globalLimit === null ? '' : String(settings.globalLimit));
      setMaxDrawSales(settings.maxDrawSales === null || settings.maxDrawSales === undefined ? '' : String(settings.maxDrawSales));
    } catch {
      setError('No se pudo cargar la configuración de límites.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDrawTypes();
  }, [loadDrawTypes]);

  useEffect(() => {
    if (selectedDrawTypeId) {
      loadLimits(selectedDrawTypeId);
    }
  }, [selectedDrawTypeId, loadLimits]);

  const selectedDrawType = drawTypes.find((dt) => dt.id === selectedDrawTypeId);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    const trimmedLimit = globalLimit.trim();
    const parsedLimit = trimmedLimit === '' ? null : Number(trimmedLimit);
    if (parsedLimit !== null && (!Number.isFinite(parsedLimit) || parsedLimit <= 0)) {
      setError('Ingresa un monto positivo para el límite base por número o déjalo vacío.');
      setSaving(false);
      return;
    }

    const trimmedSales = maxDrawSales.trim();
    const parsedSales = trimmedSales === '' ? null : Number(trimmedSales);
    if (parsedSales !== null && (!Number.isFinite(parsedSales) || parsedSales <= 0)) {
      setError('Ingresa un monto positivo para el límite de venta por sorteo o déjalo vacío.');
      setSaving(false);
      return;
    }

    try {
      const updated = await numberRestrictionsApi.updateGlobal(parsedLimit, selectedDrawTypeId || undefined, parsedSales);
      setGlobalLimit(updated.globalLimit === null ? '' : String(updated.globalLimit));
      setMaxDrawSales(updated.maxDrawSales === null || updated.maxDrawSales === undefined ? '' : String(updated.maxDrawSales));
      setSuccess(`Límites para "${selectedDrawType?.name ?? 'Tipo de Sorteo'}" guardados correctamente.`);
      // Refresh draw types list
      loadDrawTypes();
    } catch {
      setError('No se pudo guardar la configuración de restricciones.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Restricción global base</h1>
          <p className="text-sm text-slate-500">
            Define los límites generales por Tipo de Sorteo (límite base por número y límite total acumulado por sorteo).
          </p>
        </div>

        {drawTypes.length > 0 && (
          <div className="w-full sm:w-64">
            <Select
              value={selectedDrawTypeId}
              onChange={(e) => setSelectedDrawTypeId(e.target.value)}
              options={drawTypes.map((dt) => ({
                value: dt.id,
                label: `${dt.name} (${dt.digits} Dígitos)`,
              }))}
            />
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-slate-800">
            Configuración {selectedDrawType ? `— ${selectedDrawType.name} (${selectedDrawType.digits} Dígitos · x${selectedDrawType.multiplier})` : ''}
          </h2>
        </CardHeader>
        <CardBody className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              {success}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Input
                label="Límite base por número (C$)"
                type="number"
                min="1"
                step="0.01"
                value={globalLimit}
                onChange={(e) => setGlobalLimit(e.target.value)}
                placeholder="Vacío para sin límite base"
                disabled={loading || saving}
              />
              <p className="text-xs text-slate-500 mt-1">
                Tope máximo predeterminado que cualquier cajero puede vender a un número que no tenga restricción individual.
              </p>
            </div>

            <div>
              <Input
                label="Límite de venta total por sorteo (C$)"
                type="number"
                min="1"
                step="0.01"
                value={maxDrawSales}
                onChange={(e) => setMaxDrawSales(e.target.value)}
                placeholder="Vacío para sin límite de sorteo"
                disabled={loading || saving}
              />
              <p className="text-xs text-slate-500 mt-1">
                Tope máximo total acumulado entre todos los vendedores para un sorteo de este tipo.
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            <strong>Jerarquía de evaluación al vender:</strong>
            <ol className="list-decimal list-inside mt-1 text-xs space-y-0.5 text-blue-800">
              <li>Límite de venta total por sorteo (si se excede el monto total acumulado del sorteo, se bloquea la venta).</li>
              <li>Límite de venta total por usuario (si el usuario tiene un tope de venta por sorteo).</li>
              <li>Restricción individual del número en "Globales por número" (o límite de números restringidos por usuario).</li>
              <li>Límite base por número de este tipo de sorteo (o límite global del usuario).</li>
            </ol>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} loading={saving} disabled={loading || saving}>
              Guardar configuración
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}