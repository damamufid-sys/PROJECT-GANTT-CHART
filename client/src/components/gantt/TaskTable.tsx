import type { RefObject } from 'react';
import type { TaskRow } from '../../lib/taskTree';
import { PRIORITY_BADGE_CLASSES, PRIORITY_LABELS, formatDisplayDate } from '../../lib/format';

export const ROW_HEIGHT = 36;
export const HEADER_HEIGHT = 32;

interface TaskTableProps {
  rows: TaskRow[];
  selectedId: string | null;
  assigneeLabel: (taskId: string) => string;
  onSelect: (taskId: string) => void;
  onToggle: (taskId: string) => void;
  innerRef: RefObject<HTMLDivElement>;
}

export function TaskTable({
  rows,
  selectedId,
  assigneeLabel,
  onSelect,
  onToggle,
  innerRef,
}: TaskTableProps) {
  return (
    <div className="flex h-full min-h-0 w-[300px] shrink-0 flex-col border-r border-slate-200 bg-white sm:w-[420px] lg:w-[480px]">
      <div
        className="grid shrink-0 grid-cols-[56px_1fr_64px_92px_92px] items-center border-b border-slate-200 bg-slate-50 px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 lg:grid-cols-[56px_1fr_96px_92px_92px_96px_88px]"
        style={{ height: HEADER_HEIGHT }}
      >
        <span>WBS</span>
        <span>Nama tugas</span>
        <span className="hidden lg:block">Durasi</span>
        <span className="text-right">Mulai</span>
        <span className="text-right">Selesai</span>
        <span className="hidden lg:block">Prioritas</span>
        <span className="hidden text-right lg:block">Progres</span>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <div ref={innerRef}>
          {rows.map((row) => (
            <div
              key={row.task.id}
              data-testid={`gantt-row-${row.task.id}`}
              onClick={() => onSelect(row.task.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter') onSelect(row.task.id);
              }}
              className={`grid cursor-pointer grid-cols-[56px_1fr_64px_92px_92px] items-center border-b border-slate-100 px-2 text-xs lg:grid-cols-[56px_1fr_96px_92px_92px_96px_88px] ${
                selectedId === row.task.id ? 'bg-brand-50' : 'hover:bg-slate-50'
              }`}
              style={{ height: ROW_HEIGHT }}
              title={`${assigneeLabel(row.task.id)}`}
            >
              <span className="text-slate-500">{row.wbs}</span>
              <span className="flex min-w-0 items-center gap-1">
                {row.hasChildren ? (
                  <button
                    type="button"
                    aria-label={row.collapsed ? 'Buka sub-tugas' : 'Lipat sub-tugas'}
                    className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-[10px] text-slate-500 hover:bg-slate-200"
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggle(row.task.id);
                    }}
                  >
                    {row.collapsed ? '▶' : '▼'}
                  </button>
                ) : (
                  <span className="w-4 shrink-0" />
                )}
                <span
                  className={`truncate ${row.hasChildren ? 'font-semibold text-slate-800' : 'text-slate-700'}`}
                  style={{ paddingLeft: row.depth * 4 }}
                >
                  {row.task.name}
                </span>
              </span>
              <span className="hidden text-slate-600 lg:block">{row.task.durationDays} hari</span>
              <span className="text-right text-slate-600">{formatDisplayDate(row.task.scheduledStart)}</span>
              <span className="text-right text-slate-600">{formatDisplayDate(row.task.scheduledEnd)}</span>
              <span className="hidden lg:block">
                <span className={`badge ${PRIORITY_BADGE_CLASSES[row.task.priority]}`}>
                  {PRIORITY_LABELS[row.task.priority]}
                </span>
              </span>
              <span className="hidden text-right text-slate-600 lg:block">{row.task.progress}%</span>
            </div>
          ))}
          {rows.length === 0 ? (
            <p className="p-4 text-xs text-slate-500">Belum ada tugas pada proyek ini.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
