import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { frontendSettingsApi } from '@/services/api';
import { FrontendTicketVendorWidthRow } from '@/types';
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
  const [defaultTicketWidth, setDefaultTicketWidth] = useState<58 | 80>(currentSettings.defaultTicketWidth);
  const [sellerRows, setSellerRows] = useState<FrontendTicketVendorWidthRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    Promise.all([loadFrontendTicketSettings(true), frontendSettingsApi.getTicketVendorWidths()])
      .then(([settings, widths]) => {
        setTicketTitle(settings.ticketTitle);
        setFooterNote(settings.footerNote);
        setTicketCodeFontSize(settings.ticketCodeFontSize);
        setDefaultTicketWidth(settings.defaultTicketWidth);
        setSellerRows(widths.sellers);
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
      const sellerTicketWidths = sellerRows.reduce<Record<string, 58 | 80>>((acc, seller) => {
        if (seller.ticketWidth !== defaultTicketWidth) {
          acc[seller.id] = seller.ticketWidth;
        }
        return acc;
      }, {});

      const saved = await saveFrontendTicketSettings({
        ticketTitle,
        footerNote,
        ticketCodeFontSize,
        defaultTicketWidth,
        sellerTicketWidths,
      });
      setTicketTitle(saved.ticketTitle);
      setFooterNote(saved.footerNote);
      setTicketCodeFontSize(saved.ticketCodeFontSize);
      setDefaultTicketWidth(saved.defaultTicketWidth);
      setSellerRows((prev) =>
        prev.map((seller) => ({
          ...seller,
          ticketWidth: saved.sellerTicketWidths[seller.id] ?? saved.defaultTicketWidth,
        }))
      );
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
      setDefaultTicketWidth(reset.defaultTicketWidth);
      setSellerRows((prev) =>
        prev.map((seller) => ({
          ...seller,
          ticketWidth: reset.defaultTicketWidth,
        }))
      );
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

          <div className="flex flex-col gap-1">
            <label htmlFor="default-ticket-width" className="text-sm font-medium text-slate-700">
              Ancho predeterminado de impresora
            </label>
            <select
              id="default-ticket-width"
              value={defaultTicketWidth}
              onChange={(event) => {
                const width = Number(event.target.value) === 58 ? 58 : 80;
                setDefaultTicketWidth(width);
                setSuccess('');
                setError('');
              }}
              disabled={loading || saving}
              className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={58}>58 mm</option>
              <option value={80}>80 mm</option>
            </select>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-800">Ancho por vendedor</h3>
              <p className="mt-1 text-xs text-slate-500">Configura 58mm o 80mm por puesto. Si no hay override, se aplica el ancho predeterminado.</p>
            </div>
            <div className="max-h-72 overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2 text-left">Vendedor</th>
                    <th className="px-4 py-2 text-left">Usuario</th>
                    <th className="px-4 py-2 text-left">Ancho ticket</th>
                  </tr>
                </thead>
                <tbody>
                  {sellerRows.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-4 text-center text-slate-500">No hay vendedores disponibles.</td>
                    </tr>
                  ) : (
                    sellerRows.map((seller) => (
                      <tr key={seller.id} className="border-t border-slate-100">
                        <td className="px-4 py-2 text-slate-800">{seller.fullName}</td>
                        <td className="px-4 py-2 text-slate-500">{seller.username}</td>
                        <td className="px-4 py-2">
                          <select
                            value={seller.ticketWidth}
                            onChange={(event) => {
                              const width = Number(event.target.value) === 58 ? 58 : 80;
                              setSellerRows((prev) =>
                                prev.map((row) => (row.id === seller.id ? { ...row, ticketWidth: width } : row))
                              );
                              setSuccess('');
                              setError('');
                            }}
                            disabled={loading || saving}
                            className="rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                          >
                            <option value={58}>58 mm</option>
                            <option value={80}>80 mm</option>
                          </select>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            Vista rápida:
            <div className="mt-2 rounded-md border border-slate-200 bg-white px-4 py-3 font-mono text-sm text-slate-900">
              <div className="text-center font-bold">{ticketTitle.trim() || DEFAULT_FRONTEND_TICKET_SETTINGS.ticketTitle}</div>
              <div className="mt-2 text-center font-bold tracking-widest" style={{ fontSize: `${ticketCodeFontSize}px` }}>
                LKMN8-VY4XG
              </div>
              <div className="mt-2 text-center text-xs text-slate-600">Ancho predeterminado: {defaultTicketWidth}mm</div>
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