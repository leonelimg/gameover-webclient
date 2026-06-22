import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Megaphone, CalendarDays } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { announcementsApi } from '@/services/api';
import { Announcement } from '@/types';
import { formatDate } from '@/utils/helpers';

const BASE_URL = (import.meta.env['VITE_API_URL'] as string | undefined) ?? 'http://localhost:4000';

export function ActiveAnnouncementsCard() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    announcementsApi
      .active()
      .then((data) => {
        setItems(data);
      })
      .catch((err) => {
        console.error('Error fetching active announcements:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // Autoplay cycle
  useEffect(() => {
    if (items.length <= 1 || isHovered) return;

    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % items.length);
    }, 6000); // changes every 6 seconds

    return () => clearInterval(interval);
  }, [items.length, isHovered]);

  if (loading) {
    return (
      <Card className="p-6 flex items-center justify-center min-h-[180px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-teal-600/30 border-t-teal-600 rounded-full animate-spin" />
          <p className="text-slate-500 text-sm font-medium animate-pulse">Cargando anuncios...</p>
        </div>
      </Card>
    );
  }

  if (items.length === 0) {
    return null; // Keep it clean, hide if empty
  }

  const current = items[currentIndex];

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === 0 ? items.length - 1 : prev - 1));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === items.length - 1 ? 0 : prev + 1));
  };

  return (
    <div
      className="bg-white rounded-xl shadow-sm border border-slate-200 relative overflow-hidden transition-all duration-300 hover:shadow-md border-teal-100 group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex flex-col md:flex-row min-h-[220px]">
        {/* Left/Banner Area: Image or elegant placeholder */}
        <div className="w-full md:w-2/5 shrink-0 bg-slate-50 relative flex items-center justify-center overflow-hidden border-b md:border-b-0 md:border-r border-slate-100">
          {current.imageUrl ? (
            <img
              src={`${BASE_URL}${current.imageUrl}`}
              alt={current.name}
              className="w-full h-full object-cover min-h-[160px] max-h-[220px] md:max-h-full transition-transform duration-700 hover:scale-105"
            />
          ) : (
            <div className="w-full h-full min-h-[160px] bg-gradient-to-tr from-slate-900 via-slate-800 to-teal-800 flex flex-col items-center justify-center p-6 text-white text-center select-none">
              <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center mb-3 animate-pulse">
                <Megaphone size={28} className="text-teal-300" />
              </div>
              <span className="text-[10px] font-bold tracking-wider uppercase text-teal-300/80">
                Anuncio Oficial
              </span>
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col justify-between p-6 md:p-8 relative">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-800 border border-teal-100">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-ping" />
                  Activo
                </span>
                <h3 className="text-xl font-bold text-slate-800 mt-2 leading-tight tracking-tight">
                  {current.name}
                </h3>
              </div>

              {items.length > 1 && (
                <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-1 rounded-md shrink-0">
                  {currentIndex + 1} de {items.length}
                </span>
              )}
            </div>

            {current.message && (
              <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap line-clamp-4 md:line-clamp-5">
                {current.message}
              </p>
            )}
          </div>

          {/* Footer Info */}
          <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-slate-400 font-medium">
            <span className="flex items-center gap-1.5">
              <CalendarDays size={14} className="text-slate-400" />
              Vigencia: {formatDate(current.startDate)} – {formatDate(current.endDate)}
            </span>
            {current.createdBy && (
              <span className="text-slate-500">Publicado por: {current.createdBy.fullName}</span>
            )}
          </div>

          {/* Nav arrows (only shown when multi-item on desktop hover, and always touchable on mobile) */}
          {items.length > 1 && (
            <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 flex justify-between px-2 pointer-events-none md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200">
              <button
                onClick={handlePrev}
                className="w-8 h-8 rounded-full bg-white/95 shadow-md flex items-center justify-center border border-slate-155 pointer-events-auto hover:bg-slate-50 text-slate-700 hover:text-teal-600 transition-all cursor-pointer select-none active:scale-95"
                title="Anterior"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={handleNext}
                className="w-8 h-8 rounded-full bg-white/95 shadow-md flex items-center justify-center border border-slate-155 pointer-events-auto hover:bg-slate-50 text-slate-700 hover:text-teal-600 transition-all cursor-pointer select-none active:scale-95"
                title="Siguiente"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}

          {/* Dot paginators */}
          {items.length > 1 && (
            <div className="absolute bottom-4 right-6 flex gap-1.5">
              {items.map((_, idx) => (
                <button
                  key={idx}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentIndex(idx);
                  }}
                  className={`w-1.5 h-1.5 rounded-full transition-all cursor-pointer ${
                    currentIndex === idx ? 'bg-teal-600 w-3' : 'bg-slate-350 hover:bg-slate-400'
                  }`}
                  title={`Ir a anuncio ${idx + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
