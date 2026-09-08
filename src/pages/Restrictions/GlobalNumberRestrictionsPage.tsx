import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { numberRestrictionsApi, drawTypesApi } from '@/services/api';
import { GlobalNumberRestrictionItem, DrawType } from '@/types';

export default function GlobalNumberRestrictionsPage() {
  const [searchParams] = useSearchParams();
  const urlDrawTypeId = searchParams.get('drawTypeId');

  const [drawTypes, setDrawTypes] = useState<DrawType[]>([]);
  const [selectedDrawTypeId, setSelectedDrawTypeId] = useState<string>(urlDrawTypeId || '');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [items, setItems] = useState<GlobalNumberRestrictionItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [numberDraft, setNumberDraft] = useState('');
  const [limitDraft, setLimitDraft] = useState('');

  const selectedDrawType = useMemo(
    () => drawTypes.find((dt) => dt.id === selectedDrawTypeId),
    [drawTypes, selectedDrawTypeId]
  );
  const requiredDigits = selectedDrawType?.digits ?? 2;

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true })),
    [items]
  );

  const changedItems = useMemo(
    () => items.filter((item) => (drafts[item.number] ?? '').trim() !== String(item.limit)),
    [items, drafts]
  );

  const loadItems = useCallback(async (dtId?: string) => {
    setLoading(true);
    setError('');
    try {
      const response = await numberRestrictionsApi.listGlobalNumbers(dtId || undefined);
      setItems(response);
      setDrafts(
        Object.fromEntries(response.map((item) => [item.number, String(item.limit)]))
      );
    } catch {
      setError('No se pudieron cargar las restricciones globales por número.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    drawTypesApi.list().then((list) => {
      setDrawTypes(list);
      if (list.length > 0) {
        const matching = urlDrawTypeId && list.some((dt) => dt.id === urlDrawTypeId);
        setSelectedDrawTypeId((prev) => (matching ? (urlDrawTypeId as string) : prev || list[0].id));
      }
    }).catch(() => {});
  }, [urlDrawTypeId]);

  useEffect(() => {
    loadItems(selectedDrawTypeId);
  }, [selectedDrawTypeId, loadItems]);

  const handleAddOrUpdate = async () => {
    setError('');
    setSuccess('');

    const number = numberDraft.replace(/\D/g, '').slice(0, requiredDigits);
    const numRegex = new RegExp(`^\\d{${requiredDigits}}$`);
    if (!numRegex.test(number)) {
      setError(`Ingresa un número válido de ${requiredDigits} dígitos.`);
      return;
    }

    const limit = Number(limitDraft.trim());
    if (!Number.isFinite(limit) || limit <= 0) {
      setError('Ingresa un límite positivo para el número.');
      return;
    }

    setSaving(true);
    try {
      const item = await numberRestrictionsApi.upsertGlobalNumber(number, limit, selectedDrawTypeId || undefined);
      setItems((prev) => {
        const exists = prev.some((entry) => entry.number === item.number);
        if (exists) {
          return prev.map((entry) => (entry.number === item.number ? item : entry));
        }
        return [...prev, item];
      });
      setDrafts((prev) => ({
        ...prev,
        [item.number]: String(item.limit),
      }));
      setNumberDraft('');
      setLimitDraft('');
      setSuccess('Restricción global por número guardada correctamente.');
    } catch {
      setError('No se pudo guardar la restricción global por número.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (number: string) => {
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      await numberRestrictionsApi.deleteGlobalNumber(number, selectedDrawTypeId || undefined);
      setItems((prev) => prev.filter((entry) => entry.number !== number));
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[number];
        return next;
      });
      setSuccess(`Se eliminó la restricción del número ${number}.`);
    } catch {
      setError('No se pudo eliminar la restricción seleccionada.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAll = async () => {
    setError('');
    setSuccess('');

    if (changedItems.length === 0) {
      setSuccess('No hay cambios pendientes por guardar.');
      return;
    }

    const updates: Array<{ number: string; limit: number }> = [];
    for (const item of changedItems) {
      const raw = (drafts[item.number] ?? '').trim();
      const parsed = Number(raw);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        setError(`Ingresa un límite positivo para el número ${item.number}.`);
        return;
      }
      updates.push({ number: item.number, limit: parsed });
    }

    setSaving(true);
    try {
      const updatedItems = await Promise.all(
        updates.map((entry) => numberRestrictionsApi.updateGlobalNumber(entry.number, entry.limit, selectedDrawTypeId || undefined))
      );

      const updatedByNumber = new Map(updatedItems.map((item) => [item.number, item]));
      setItems((prev) => prev.map((entry) => updatedByNumber.get(entry.number) ?? entry));
      setDrafts((prev) => ({
        ...prev,
        ...Object.fromEntries(updatedItems.map((item) => [item.number, String(item.limit)])),
      }));
      setSuccess(`Se guardaron ${updatedItems.length} cambio(s) correctamente.`);
    } catch {
      setError('No se pudieron guardar todos los cambios.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Globales por número</h1>
          <p className="text-sm text-slate-500">
            Define límites de venta por número parametrizados por Tipo de Sorteo.
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
          <h2 className="font-semibold text-slate-800 flex items-center justify-between">
            <span>Gestión de restricciones {selectedDrawType ? `— ${selectedDrawType.name}` : ''}</span>
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

          <div className="flex gap-2">
            <Input
              placeholder={`Número (${requiredDigits}D)`}
              value={numberDraft}
              onChange={(e) => setNumberDraft(e.target.value.replace(/\D/g, '').slice(0, requiredDigits))}
              maxLength={requiredDigits}
              className="w-32 font-mono"
              disabled={loading || saving}
            />
            <Input
              type="number"
              min="1"
              step="0.01"
              placeholder="Límite (C$)"
              value={limitDraft}
              onChange={(e) => setLimitDraft(e.target.value)}
              className="flex-1"
              disabled={loading || saving}
            />
            <Button onClick={handleAddOrUpdate} disabled={loading || saving} loading={saving}>
              Agregar
            </Button>
          </div>

          <div className="space-y-2">
            {loading ? (
              <p className="text-sm text-slate-500">Cargando restricciones...</p>
            ) : sortedItems.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-4">Sin números restringidos globales</p>
            ) : (
              sortedItems.map((item) => (
                <div
                  key={item.number}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono font-bold text-slate-800">{item.number}</span>
                    <div className="w-40">
                      <Input
                        label=""
                        type="number"
                        min="1"
                        step="0.01"
                        value={drafts[item.number] ?? ''}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [item.number]: e.target.value,
                          }))
                        }
                        disabled={saving}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRemove(item.number)}
                      className="text-red-500 hover:text-red-700 text-sm"
                      disabled={saving}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSaveAll} disabled={loading || saving} loading={saving}>
              Guardar cambios ({changedItems.length})
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
