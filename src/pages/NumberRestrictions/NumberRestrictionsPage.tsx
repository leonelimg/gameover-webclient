import { useEffect, useState } from 'react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { numberRestrictionsApi } from '@/services/api';

export default function NumberRestrictionsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [globalLimit, setGlobalLimit] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    numberRestrictionsApi.getGlobal()
      .then((settings) => {
        setGlobalLimit(settings.globalLimit === null ? '' : String(settings.globalLimit));
      })
      .catch(() => {
        setError('No se pudo cargar la restricción global.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    const trimmed = globalLimit.trim();
    const parsed = trimmed === '' ? null : Number(trimmed);
    if (parsed !== null && (!Number.isFinite(parsed) || parsed <= 0)) {
      setError('Ingresa un monto positivo o deja el campo vacío para desactivar la restricción global.');
      setSaving(false);
      return;
    }

    try {
      const updated = await numberRestrictionsApi.updateGlobal(parsed);
      setGlobalLimit(updated.globalLimit === null ? '' : String(updated.globalLimit));
      setSuccess(updated.globalLimit === null ? 'Restricción global desactivada.' : 'Restricción global actualizada.');
    } catch {
      setError('No se pudo guardar la restricción global.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Restricción global de números</h1>
        <p className="text-sm text-slate-500">
          Define el límite base por número. Esta regla aplica cuando el número no tiene una restricción específica en Globales por número ni una restricción global por usuario.
        </p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-slate-800">Configuración</h2>
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

          <Input
            label="Límite global por número (C$)"
            type="number"
            min="1"
            step="0.01"
            value={globalLimit}
            onChange={(e) => setGlobalLimit(e.target.value)}
            placeholder="Vacío para desactivar"
            disabled={loading || saving}
          />

          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Prioridad de reglas al vender: Globales por número, luego Global por usuario y finalmente esta restricción global base.
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