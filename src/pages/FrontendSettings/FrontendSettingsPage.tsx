import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import {
  DEFAULT_FRONTEND_TICKET_SETTINGS,
  getFrontendTicketSettings,
  loadFrontendTicketSettings,
  resetFrontendTicketSettings,
  saveFrontendTicketSettings,
} from '@/utils/ticketAppearance';

export default function FrontendSettingsPage() {
  const currentSettings = getFrontendTicketSettings();
  const [ticketTitle, setTicketTitle] = useState(currentSettings.ticketTitle);
  const [footerNote, setFooterNote] = useState(currentSettings.footerNote);
  const [ticketCodeFontSize, setTicketCodeFontSize] = useState(currentSettings.ticketCodeFontSize);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadFrontendTicketSettings(true)
      .then((settings) => {
        setTicketTitle(settings.ticketTitle);
        setFooterNote(settings.footerNote);
        setTicketCodeFontSize(settings.ticketCodeFontSize);
      })
      .catch(() => {
        setError('No se pudo cargar la configuración global de tickets.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const saved = await saveFrontendTicketSettings({ ticketTitle, footerNote, ticketCodeFontSize });
      setTicketTitle(saved.ticketTitle);
      setFooterNote(saved.footerNote);
      setTicketCodeFontSize(saved.ticketCodeFontSize);
      setSuccess('Configuración global de tickets guardada.');
    } catch {
      setError('No se pudo guardar la configuración global de tickets.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const reset = await resetFrontendTicketSettings();
      setTicketTitle(reset.ticketTitle);
      setFooterNote(reset.footerNote);
      setTicketCodeFontSize(reset.ticketCodeFontSize);
      setSuccess('Configuración restablecida a valores predeterminados.');
    } catch {
      setError('No se pudo restablecer la configuración global de tickets.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Configuración global de tickets</h1>
        <p className="text-sm text-slate-500">
          Define el título principal y la nota fija del pie para las impresiones del navegador y la impresión nativa del bridge local.
        </p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-slate-800">Apariencia del ticket</h2>
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

          <div className="flex flex-col gap-1">
            <label htmlFor="ticket-title" className="text-sm font-medium text-slate-700">
              Título del encabezado
            </label>
            <input
              id="ticket-title"
              type="text"
              value={ticketTitle}
              onChange={(event) => {
                setTicketTitle(event.target.value);
                setSuccess('');
                setError('');
              }}
              maxLength={60}
              disabled={loading || saving}
              className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="GameOver Loteria"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="ticket-footer-note" className="text-sm font-medium text-slate-700">
              Nota fija de pie de página
            </label>
            <textarea
              id="ticket-footer-note"
              value={footerNote}
              onChange={(event) => {
                setFooterNote(event.target.value);
                setSuccess('');
                setError('');
              }}
              rows={4}
              maxLength={240}
              disabled={loading || saving}
              className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Gracias por su preferencia"
            />
            <p className="text-xs text-slate-500">Puedes usar varias líneas. Cada línea se imprimirá por separado.</p>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="ticket-code-font-size" className="text-sm font-medium text-slate-700">
              Tamaño del número de ticket (px)
            </label>
            <input
              id="ticket-code-font-size"
              type="number"
              min={18}
              max={64}
              value={ticketCodeFontSize}
              onChange={(event) => {
                setTicketCodeFontSize(Number(event.target.value));
                setSuccess('');
                setError('');
              }}
              disabled={loading || saving}
              className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="32"
            />
            <p className="text-xs text-slate-500">Rango recomendado: 18 a 64.</p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            Vista rápida:
            <div className="mt-2 rounded-md border border-slate-200 bg-white px-4 py-3 font-mono text-sm text-slate-900">
              <div className="text-center font-bold">{ticketTitle.trim() || DEFAULT_FRONTEND_TICKET_SETTINGS.ticketTitle}</div>
              <div className="mt-2 text-center font-bold tracking-widest" style={{ fontSize: `${ticketCodeFontSize}px` }}>
                LKMN8-VY4XG
              </div>
              <div className="mt-3 text-center">Multiplicador: 80x</div>
              {(footerNote.trim() || DEFAULT_FRONTEND_TICKET_SETTINGS.footerNote)
                .split('\n')
                .filter(Boolean)
                .map((line, index) => (
                  <div key={`${line}-${index}`} className="text-center text-xs text-slate-600">
                    {line}
                  </div>
                ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={handleReset} disabled={loading || saving}>Restablecer</Button>
            <Button onClick={handleSave} loading={saving} disabled={loading || saving}>Guardar configuración</Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}