import { formatDisplayDate, formatIDR, type Priority } from '@gantt/shared';

export { formatDisplayDate, formatIDR };

export const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: 'Rendah',
  MEDIUM: 'Sedang',
  HIGH: 'Tinggi',
};

export const PRIORITY_BADGE_CLASSES: Record<Priority, string> = {
  LOW: 'bg-slate-100 text-slate-600',
  MEDIUM: 'bg-amber-100 text-amber-700',
  HIGH: 'bg-red-100 text-red-700',
};

export const WEEKDAY_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'] as const;

export function parseNumber(value: string): number {
  const normalized = value.replace(/[^\d-]/g, '');
  return Number(normalized);
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}
