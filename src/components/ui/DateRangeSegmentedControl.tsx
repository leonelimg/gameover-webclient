import { CalendarDays } from 'lucide-react';
import { COMMON_DATE_RANGES, DateRange } from '@/utils/dateRanges';

interface DateRangeSegmentedControlProps {
  selectedRange: DateRange;
  onRangeChange: (range: DateRange) => void;
  customFromDate: string;
  customToDate: string;
  onCustomFromDateChange: (date: string) => void;
  onCustomToDateChange: (date: string) => void;
}

export function DateRangeSegmentedControl({
  selectedRange,
  onRangeChange,
  customFromDate,
  customToDate,
  onCustomFromDateChange,
  onCustomToDateChange,
}: DateRangeSegmentedControlProps) {
  const isCustomRangeInvalid = customFromDate > customToDate;

  return (
    <div className="rounded-xl border border-slate-200 bg-white/95 p-2 shadow-sm backdrop-blur">
      <div className="mb-2 flex items-center gap-2 px-2 text-xs font-medium uppercase tracking-wider text-slate-500">
        <CalendarDays size={13} />
        Filtro de fecha
      </div>

      {/* Segmented control buttons */}
      <div className="grid grid-cols-2 gap-1.5 md:grid-cols-5">
        {COMMON_DATE_RANGES.map((range) => {
          const isActive = selectedRange === range.key;
          return (
            <button
              key={range.key}
              type="button"
              onClick={() => onRangeChange(range.key)}
              className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition-all ${
                isActive
                  ? 'border-blue-200 bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-sm'
                  : 'border-slate-200 bg-slate-50/70 text-slate-700 hover:border-slate-300 hover:bg-slate-100'
              }`}
            >
              {range.label}
            </button>
          );
        })}
      </div>

      {/* Custom date inputs - shown when custom range is selected */}
      {selectedRange === 'custom' && (
        <div className="mt-2 grid grid-cols-1 gap-1.5 rounded-lg border border-slate-200 bg-slate-50/70 p-2 md:grid-cols-2">
          <label className="text-[11px] font-medium text-slate-600">
            Desde
            <input
              type="date"
              value={customFromDate}
              onChange={(e) => onCustomFromDateChange(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <label className="text-[11px] font-medium text-slate-600">
            Hasta
            <input
              type="date"
              value={customToDate}
              onChange={(e) => onCustomToDateChange(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          {isCustomRangeInvalid && (
            <p className="md:col-span-2 text-xs text-red-600">
              El rango es inválido: la fecha desde debe ser menor o igual que hasta.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
