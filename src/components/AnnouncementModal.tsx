import { useEffect, useState, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, BellRing } from 'lucide-react';
import { announcementsApi } from '@/services/api';
import { Announcement } from '@/types';

const BASE_URL = (import.meta.env['VITE_API_URL'] as string | undefined) ?? 'http://localhost:4000';

export function AnnouncementModal() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    announcementsApi.active().then((data) => {
      if (data.length > 0) {
        setItems(data);
        setIndex(0);
        setVisible(true);
      }
    }).catch(() => { /* silent fail — don't block the UI */ });
  }, []);

  const current = items[index] ?? null;

  const close = useCallback(() => setVisible(false), []);

  const dismiss = useCallback(async () => {
    if (!current) return;
    // Optimistically remove from list
    const remaining = items.filter((_, i) => i !== index);
    if (remaining.length === 0) {
      setVisible(false);
    } else {
      setItems(remaining);
      setIndex(Math.min(index, remaining.length - 1));
    }
    try {
      await announcementsApi.dismiss(current.id);
    } catch { /* silent */ }
  }, [current, index, items]);

  const prev = () => setIndex((i) => Math.max(0, i - 1));
  const next = () => setIndex((i) => Math.min(items.length - 1, i + 1));

  if (!visible || !current) return null;

  const hasImage = !!current.imageUrl;
  const hasMessage = !!current.message?.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={close} />

      {/* Dialog */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <BellRing size={16} className="text-blue-600" />
            </div>
            <span className="font-semibold text-slate-800 leading-tight">{current.name}</span>
          </div>
          <button
            onClick={close}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            title="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {hasImage && (
            <div className="w-full bg-slate-50">
              <img
                src={`${BASE_URL}${current.imageUrl}`}
                alt={current.name}
                className="w-full max-h-72 object-contain"
              />
            </div>
          )}

          {hasMessage && (
            <div className="px-5 py-4">
              <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">
                {current.message}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between gap-3">
          {/* Pagination */}
          <div className="flex items-center gap-2">
            {items.length > 1 && (
              <>
                <button
                  onClick={prev}
                  disabled={index === 0}
                  className="p-1.5 text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed rounded transition-colors"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="text-xs text-slate-500 font-medium">
                  {index + 1} de {items.length}
                </span>
                <button
                  onClick={next}
                  disabled={index === items.length - 1}
                  className="p-1.5 text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed rounded transition-colors"
                >
                  <ChevronRight size={18} />
                </button>
              </>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={close}
              className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cerrar
            </button>
            <button
              onClick={dismiss}
              className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              No volver a mostrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
