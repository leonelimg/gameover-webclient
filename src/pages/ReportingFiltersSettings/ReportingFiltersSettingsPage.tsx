import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import {
  frontendSettingsApi,
  REPORTING_FILTER_SECTION_KEYS,
  ReportingFilterSectionKey,
  ReportingFilterSettings,
} from '@/services/api';

const SECTION_LABELS: Record<ReportingFilterSectionKey, string> = {
  'reports.sales-stats.summary': 'Reportes > Estadisticas de ventas > Resumen',
  'reports.sales-stats.top-numbers': 'Reportes > Estadisticas de ventas > Top numeros',
  'reports.sales-stats.recent-tickets': 'Reportes > Estadisticas de ventas > Tickets recientes',
  'reports.balance-breakdown': 'Reportes > Desglose de balance',
  'reports.sales-by-user': 'Reportes > Ventas por usuario',
  'reports.commissions': 'Reportes > Comisiones',
  'reports.draw-lists': 'Reportes > Listas de sorteos',
  'cash-movements.balance': 'Depositos y retiros > Balance',
  'cash-movements.summary-by-event': 'Depositos y retiros > Resumen por evento',
};

const SECTION_DESCRIPTION: Record<ReportingFilterSectionKey, string> = {
  'reports.sales-stats.summary': 'Controla totalSales, tickets, sorteos y comisiones del resumen general.',
  'reports.sales-stats.top-numbers': 'Controla los montos agregados del ranking de numeros vendidos.',
  'reports.sales-stats.recent-tickets': 'Controla el listado de ultimos tickets en el dashboard de reportes.',
  'reports.balance-breakdown': 'Controla totales por asociado, vendedor y sorteo en el desglose financiero.',
  'reports.sales-by-user': 'Controla el total de ventas y conteos por usuario con filtros de fecha.',
  'reports.commissions': 'Controla las ventas consideradas para el calculo de comisiones.',
  'reports.draw-lists': 'Controla si la lista 00-99 incluye todos los sorteos o solo los elegibles.',
  'cash-movements.balance': 'Controla ventas y premios usados en el balance de caja.',
  'cash-movements.summary-by-event': 'Controla ventas y premios por evento en el resumen de caja.',
};

function copySettings(settings: ReportingFilterSettings): ReportingFilterSettings {
  return {
    sections: REPORTING_FILTER_SECTION_KEYS.reduce<ReportingFilterSettings['sections']>((acc, section) => {
      acc[section] = { ...settings.sections[section] };
      return acc;
    }, {} as ReportingFilterSettings['sections']),
  };
}

export default function ReportingFiltersSettingsPage() {
  const [settings, setSettings] = useState<ReportingFilterSettings | null>(null);
  const [initialSettings, setInitialSettings] = useState<ReportingFilterSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    frontendSettingsApi
      .getReportingFilters()
      .then((data) => {
        setSettings(copySettings(data));
        setInitialSettings(copySettings(data));
      })
      .catch(() => {
        setError('No se pudo cargar la configuracion de filtros por sorteo.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const hasChanges = useMemo(() => {
    if (!settings || !initialSettings) return false;
    return REPORTING_FILTER_SECTION_KEYS.some((section) => {
      const a = settings.sections[section];
      const b = initialSettings.sections[section];
      return a.requireFinalized !== b.requireFinalized || a.requireWinnerDefined !== b.requireWinnerDefined;
    });
  }, [settings, initialSettings]);

  const toggle = (section: ReportingFilterSectionKey, field: 'requireFinalized' | 'requireWinnerDefined') => {
    setSettings((current) => {
      if (!current) return current;
      return {
        sections: {
          ...current.sections,
          [section]: {
            ...current.sections[section],
            [field]: !current.sections[section][field],
          },
        },
      };
    });
    setSuccess('');
    setError('');
  };

  const handleSave = async () => {
    if (!settings) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const updated = await frontendSettingsApi.updateReportingFilters(settings);
      setSettings(copySettings(updated));
      setInitialSettings(copySettings(updated));
      setSuccess('Configuracion guardada correctamente.');
    } catch {
      setError('No se pudo guardar la configuracion de filtros por sorteo.');
    } finally {
      setSaving(false);
    }
  };

  const handleReload = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const refreshed = await frontendSettingsApi.getReportingFilters();
      setSettings(copySettings(refreshed));
      setInitialSettings(copySettings(refreshed));
    } catch {
      setError('No se pudo recargar la configuracion.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Configuracion de filtros por sorteo</h1>
        <p className="text-sm text-slate-500">
          Define por seccion si los totales y listados incluyen solo sorteos finalizados con ganador o si consideran todos los sorteos.
        </p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-slate-800">Reglas por seccion</h2>
        </CardHeader>
        <CardBody className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          {success && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div>
          )}

          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            Esta configuracion es global y afecta Web + Android para endpoints compartidos.
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2 text-left">Seccion</th>
                  <th className="px-4 py-2 text-left">Descripcion</th>
                  <th className="px-4 py-2 text-center">Requiere finalizado</th>
                  <th className="px-4 py-2 text-center">Requiere ganador</th>
                </tr>
              </thead>
              <tbody>
                {!settings ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                      {loading ? 'Cargando configuracion...' : 'No hay configuracion disponible.'}
                    </td>
                  </tr>
                ) : (
                  REPORTING_FILTER_SECTION_KEYS.map((section) => (
                    <tr key={section} className="border-t border-slate-100">
                      <td className="px-4 py-2 text-slate-800 font-medium">{SECTION_LABELS[section]}</td>
                      <td className="px-4 py-2 text-slate-500">{SECTION_DESCRIPTION[section]}</td>
                      <td className="px-4 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => toggle(section, 'requireFinalized')}
                          disabled={loading || saving}
                          className={`inline-flex h-8 w-14 items-center justify-center rounded-lg border text-sm font-semibold transition-colors ${
                            settings.sections[section].requireFinalized
                              ? 'border-green-300 bg-green-100 text-green-700'
                              : 'border-slate-300 bg-slate-100 text-slate-500'
                          }`}
                        >
                          {settings.sections[section].requireFinalized ? 'SI' : 'NO'}
                        </button>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => toggle(section, 'requireWinnerDefined')}
                          disabled={loading || saving}
                          className={`inline-flex h-8 w-14 items-center justify-center rounded-lg border text-sm font-semibold transition-colors ${
                            settings.sections[section].requireWinnerDefined
                              ? 'border-green-300 bg-green-100 text-green-700'
                              : 'border-slate-300 bg-slate-100 text-slate-500'
                          }`}
                        >
                          {settings.sections[section].requireWinnerDefined ? 'SI' : 'NO'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={handleReload} disabled={loading || saving}>
              Recargar
            </Button>
            <Button onClick={handleSave} loading={saving} disabled={loading || saving || !settings || !hasChanges}>
              Guardar configuracion
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
