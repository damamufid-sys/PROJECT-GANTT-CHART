import { addDays, formatDate, getDayOfWeek, toUTCDate } from '@gantt/shared';
import { WEEKDAY_LABELS } from '../../lib/format';

interface MiniCalendarProps {
  month: string;
  weekendDays: number[];
  holidays: string[];
  onChangeMonth: (month: string) => void;
}

export function MiniCalendar({ month, weekendDays, holidays, onChangeMonth }: MiniCalendarProps) {
  const first = toUTCDate(month);
  const monthLabel = new Intl.DateTimeFormat('id-ID', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(first);
  const offset = getDayOfWeek(first);
  const daysInMonth = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const holidaySet = new Set(holidays);

  const shift = (delta: number): void => {
    const next = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + delta, 1));
    onChangeMonth(formatDate(next));
  };

  const cells: Array<{ key: string; date: string | null; day: number }> = [];
  for (let index = 0; index < offset; index += 1) {
    cells.push({ key: `empty-${index}`, date: null, day: 0 });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = formatDate(addDays(first, day - 1));
    cells.push({ key: date, date, day });
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={() => shift(-1)}>
          ‹
        </button>
        <span className="text-sm font-medium capitalize text-slate-800">{monthLabel}</span>
        <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={() => shift(1)}>
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-slate-500">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((cell) => {
          if (!cell.date) return <span key={cell.key} />;
          const date = toUTCDate(cell.date);
          const isHoliday = holidaySet.has(cell.date);
          const isWeekend = weekendDays.includes(getDayOfWeek(date));
          const className = isHoliday
            ? 'bg-red-100 text-red-700 font-semibold'
            : isWeekend
              ? 'bg-slate-100 text-slate-400'
              : 'bg-white text-slate-700 border border-slate-200';
          return (
            <span
              key={cell.key}
              title={isHoliday ? 'Hari libur' : isWeekend ? 'Akhir pekan' : 'Hari kerja'}
              data-testid={`mini-calendar-${cell.date}`}
              className={`flex h-7 items-center justify-center rounded text-xs ${className}`}
            >
              {cell.day}
            </span>
          );
        })}
      </div>
      <p className="mt-2 text-[10px] text-slate-500">
        Abu-abu = akhir pekan, merah = hari libur.
      </p>
    </div>
  );
}
