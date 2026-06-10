export type DateRange = 'today' | 'last7' | 'week' | 'month' | 'custom';

export const COMMON_DATE_RANGES: Array<{ key: DateRange; label: string }> = [
  { key: 'today', label: 'Hoy' },
  { key: 'week', label: 'Esta semana' },
  { key: 'month', label: 'Este mes' },
  { key: 'custom', label: 'Custom' },
];

export function isDateRange(value: string): value is DateRange {
  return COMMON_DATE_RANGES.some((range) => range.key === value);
}

export function toISODateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDateRange(range: DateRange): { fromDate: string; toDate: string } {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  if (range === 'today') {
    return { fromDate: toISODateLocal(now), toDate: toISODateLocal(now) };
  }

  if (range === 'last7') {
    start.setDate(now.getDate() - 6);
    return { fromDate: toISODateLocal(start), toDate: toISODateLocal(now) };
  }

  if (range === 'week') {
    const mondayOffset = (now.getDay() + 6) % 7;
    start.setDate(now.getDate() - mondayOffset);
    end.setDate(start.getDate() + 6);
    return { fromDate: toISODateLocal(start), toDate: toISODateLocal(end) };
  }

  start.setDate(1);
  end.setMonth(now.getMonth() + 1, 0);
  return { fromDate: toISODateLocal(start), toDate: toISODateLocal(end) };
}
