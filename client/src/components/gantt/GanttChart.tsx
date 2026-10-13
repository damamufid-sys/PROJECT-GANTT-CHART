import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addDays,
  computeCpm,
  computeSchedule,
  diffInCalendarDays,
  formatDate,
  getDayOfWeek,
  toUTCDate,
  workingDaysBetween,
  type DependencyDto,
  type HolidayDto,
  type TaskDto,
} from '@gantt/shared';
import { buildCalendar, buildTaskRows, parentIdSet } from '../../lib/taskTree';
import { formatDisplayDate } from '../../lib/format';
import { HEADER_HEIGHT, ROW_HEIGHT, TaskTable } from './TaskTable';

export type ZoomLevel = 'day' | 'week' | 'month';

const DAY_WIDTHS: Record<ZoomLevel, number> = { day: 36, week: 14, month: 5 };

interface GanttChartProps {
  tasks: TaskDto[];
  dependencies: DependencyDto[];
  holidays: HolidayDto[];
  weekendDays: string;
  projectStart: string;
  showCriticalPath: boolean;
  onToggleCriticalPath: () => void;
  assigneeLabel: (taskId: string) => string;
  onSelectTask: (task: TaskDto) => void;
  onOpenTask: (task: TaskDto) => void;
  onDragTask: (task: TaskDto, startDate: string, clamped: boolean) => void;
  onResizeTask: (task: TaskDto, durationDays: number) => void;
}

type Interaction = {
  kind: 'drag' | 'resize';
  taskId: string;
  startX: number;
  delta: number;
};

const WEEKDAY_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function todayString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

interface HeaderSegment {
  offset: number;
  width: number;
  label: string;
  sublabel?: string;
}

function buildHeaderSegments(fromDate: Date, days: number, zoom: ZoomLevel): HeaderSegment[] {
  const segments: HeaderSegment[] = [];
  if (zoom === 'day') {
    for (let index = 0; index < days; index += 1) {
      const date = addDays(fromDate, index);
      segments.push({
        offset: index * DAY_WIDTHS.day,
        width: DAY_WIDTHS.day,
        label: String(date.getUTCDate()),
        sublabel: WEEKDAY_SHORT[getDayOfWeek(date)],
      });
    }
    return segments;
  }
  if (zoom === 'week') {
    const step = 7;
    for (let index = 0; index < days; index += step) {
      const date = addDays(fromDate, index);
      const width = Math.min(step, days - index) * DAY_WIDTHS.week;
      segments.push({
        offset: index * DAY_WIDTHS.week,
        width,
        label: `${date.getUTCDate()} ${formatDisplayDate(formatDate(date)).split(' ')[1]}`,
      });
    }
    return segments;
  }
  let index = 0;
  while (index < days) {
    const date = addDays(fromDate, index);
    const month = date.getUTCMonth();
    let length = 0;
    while (index + length < days && addDays(fromDate, index + length).getUTCMonth() === month) {
      length += 1;
    }
    segments.push({
      offset: index * DAY_WIDTHS.month,
      width: length * DAY_WIDTHS.month,
      label: formatDisplayDate(formatDate(date)).split(' ').slice(1).join(' '),
    });
    index += length;
  }
  return segments;
}

export function GanttChart({
  tasks,
  dependencies,
  holidays,
  weekendDays,
  projectStart,
  showCriticalPath,
  onToggleCriticalPath,
  assigneeLabel,
  onSelectTask,
  onOpenTask,
  onDragTask,
  onResizeTask,
}: GanttChartProps) {
  const [zoom, setZoom] = useState<ZoomLevel>('day');
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [interaction, setInteraction] = useState<Interaction | null>(null);

  const dayWidth = DAY_WIDTHS[zoom];
  const calendar = useMemo(() => buildCalendar(weekendDays, holidays), [weekendDays, holidays]);
  const parents = useMemo(() => parentIdSet(tasks), [tasks]);

  const range = useMemo(() => {
    const starts = tasks.map((task) => task.scheduledStart);
    const ends = tasks.map((task) => task.scheduledEnd);
    const min = starts.length > 0 ? starts.reduce((a, b) => (a < b ? a : b)) : projectStart;
    const max = ends.length > 0 ? ends.reduce((a, b) => (a > b ? a : b)) : projectStart;
    const fromDate = addDays(toUTCDate(min), -3);
    const toDate = addDays(toUTCDate(max), 6);
    return { fromDate, toDate, days: diffInCalendarDays(fromDate, toDate) + 1 };
  }, [tasks, projectStart]);

  const xOf = useCallback(
    (date: string) => diffInCalendarDays(range.fromDate, toUTCDate(date)) * dayWidth,
    [range.fromDate, dayWidth],
  );
  const widthOf = useCallback(
    (start: string, end: string) => (diffInCalendarDays(toUTCDate(start), toUTCDate(end)) + 1) * dayWidth,
    [dayWidth],
  );

  const dependenciesInput = useMemo(
    () =>
      dependencies.map((dependency) => ({
        predecessorId: dependency.predecessorId,
        successorId: dependency.successorId,
        type: dependency.type,
        lagDays: dependency.lagDays,
      })),
    [dependencies],
  );

  /** Pratinjau memakai mesin `shared` selama drag, sesuai bagian 6.7. */
  const preview = useMemo(() => {
    if (!interaction || interaction.delta === 0) {
      return { tasks, clampedTo: null as string | null, requested: '' };
    }
    const original = tasks.find((task) => task.id === interaction.taskId);
    if (!original) return { tasks, clampedTo: null, requested: '' };

    const modified = tasks.map((task) => {
      if (task.id !== original.id) return task;
      if (interaction.kind === 'drag') {
        return { ...task, startDate: formatDate(addDays(toUTCDate(original.startDate), interaction.delta)) };
      }
      const targetEnd = addDays(toUTCDate(original.scheduledEnd), interaction.delta);
      const duration = Math.max(
        1,
        workingDaysBetween(toUTCDate(original.scheduledStart), targetEnd, calendar),
      );
      return { ...task, durationDays: duration };
    });

    const schedule = computeSchedule(
      modified.map((task) => ({
        id: task.id,
        parentId: task.parentId,
        position: task.position,
        durationDays: task.durationDays,
        startDate: task.startDate,
        progress: task.progress,
      })),
      dependenciesInput,
      calendar,
    );

    const requested =
      interaction.kind === 'drag'
        ? formatDate(addDays(toUTCDate(original.startDate), interaction.delta))
        : String(modified.find((task) => task.id === original.id)?.durationDays ?? original.durationDays);

    const nextTasks = tasks.map((task) => {
      const scheduled = schedule.byId.get(task.id);
      if (!scheduled) return task;
      return {
        ...task,
        scheduledStart: scheduled.scheduledStart,
        scheduledEnd: scheduled.scheduledEnd,
        durationDays: scheduled.durationDays,
        progress: scheduled.progress,
      };
    });
    const dragged = schedule.byId.get(original.id);
    const clampedTo =
      interaction.kind === 'drag' && dragged && dragged.scheduledStart !== requested
        ? dragged.scheduledStart
        : null;
    return { tasks: nextTasks, clampedTo, requested };
  }, [interaction, tasks, dependenciesInput, calendar]);

  const displayTasks = preview.tasks;
  const taskById = useMemo(() => new Map(displayTasks.map((task) => [task.id, task])), [displayTasks]);
  const rows = useMemo(() => buildTaskRows(displayTasks, collapsedIds), [displayTasks, collapsedIds]);
  const rowIndex = useMemo(() => new Map(rows.map((row, index) => [row.task.id, index])), [rows]);

  const criticalIds = useMemo(() => {
    if (!showCriticalPath) return new Set<string>();
    const cpm = computeCpm(
      displayTasks.map((task) => ({
        id: task.id,
        name: task.name,
        parentId: task.parentId,
        durationDays: task.durationDays,
        scheduledStart: task.scheduledStart,
        scheduledEnd: task.scheduledEnd,
      })),
      dependenciesInput,
      calendar,
      projectStart,
    );
    return new Set(cpm.criticalTasks);
  }, [showCriticalPath, displayTasks, dependenciesInput, calendar, projectStart]);

  const interactionRef = useRef<{ interaction: Interaction | null; preview: typeof preview; tasks: TaskDto[] }>({
    interaction: null,
    preview,
    tasks,
  });
  interactionRef.current = { interaction, preview, tasks };

  const commitInteraction = useCallback(() => {
    const current = interactionRef.current;
    if (!current.interaction || current.interaction.delta === 0) {
      setInteraction(null);
      return;
    }
    const task = current.tasks.find((item) => item.id === current.interaction?.taskId);
    setInteraction(null);
    if (!task) return;
    if (current.interaction.kind === 'drag') {
      onDragTask(task, current.preview.requested, Boolean(current.preview.clampedTo));
    } else {
      onResizeTask(task, Number(current.preview.requested));
    }
  }, [onDragTask, onResizeTask]);

  useEffect(() => {
    if (!interaction) return undefined;
    const handleMove = (event: PointerEvent): void => {
      setInteraction((current) =>
        current
          ? { ...current, delta: Math.round((event.clientX - current.startX) / dayWidth) }
          : current,
      );
    };
    const handleUp = (): void => commitInteraction();
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    const previousSelect = document.body.style.userSelect;
    document.body.style.userSelect = 'none';
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      document.body.style.userSelect = previousSelect;
    };
  }, [interaction, dayWidth, commitInteraction]);

  const rightRef = useRef<HTMLDivElement>(null);
  const leftInnerRef = useRef<HTMLDivElement>(null);

  const handleScroll = (): void => {
    if (leftInnerRef.current && rightRef.current) {
      leftInnerRef.current.style.transform = `translateY(-${rightRef.current.scrollTop}px)`;
    }
  };

  const totalWidth = range.days * dayWidth;
  const bodyHeight = Math.max(rows.length * ROW_HEIGHT, ROW_HEIGHT);
  const headerSegments = useMemo(
    () => buildHeaderSegments(range.fromDate, range.days, zoom),
    [range.fromDate, range.days, zoom],
  );
  const today = todayString();
  const todayX = xOf(today) + dayWidth / 2;
  const todayVisible = today >= formatDate(range.fromDate) && today <= formatDate(range.toDate);

  const scrollToToday = (): void => {
    if (!rightRef.current) return;
    rightRef.current.scrollLeft = Math.max(0, todayX - rightRef.current.clientWidth / 2);
  };

  const dayOffsets = useMemo(
    () => Array.from({ length: range.days }, (_, index) => addDays(range.fromDate, index)),
    [range.fromDate, range.days],
  );

  const handleToggle = (taskId: string): void => {
    setCollapsedIds((current) => {
      const next = new Set(current);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2">
        <div className="flex overflow-hidden rounded-md border border-slate-300">
          {(['day', 'week', 'month'] as ZoomLevel[]).map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setZoom(level)}
              className={`px-3 py-1 text-xs font-medium ${
                zoom === level ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {level === 'day' ? 'Hari' : level === 'week' ? 'Minggu' : 'Bulan'}
            </button>
          ))}
        </div>
        <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={scrollToToday}>
          Hari ini
        </button>
        <label className="flex items-center gap-1 text-xs text-slate-600">
          <input type="checkbox" checked={showCriticalPath} onChange={onToggleCriticalPath} />
          Sorot jalur kritis
        </label>
        <span className="ml-auto text-xs text-slate-500">
          Tarik bar untuk menggeser, tarik ujung kanan untuk mengubah durasi.
        </span>
      </div>

      <div className="flex min-h-0 flex-1">
        <TaskTable
          rows={rows}
          selectedId={selectedId}
          assigneeLabel={assigneeLabel}
          onSelect={(taskId) => {
            setSelectedId(taskId);
            const task = taskById.get(taskId);
            if (task) onSelectTask(task);
          }}
          onToggle={handleToggle}
          innerRef={leftInnerRef}
        />

        <div ref={rightRef} className="min-h-0 flex-1 overflow-auto" onScroll={handleScroll}>
          <div style={{ width: totalWidth }}>
            <div className="sticky top-0 z-10 bg-slate-50">
              <svg
                width={totalWidth}
                height={HEADER_HEIGHT}
                className="block"
                role="img"
                aria-label="Kepala linimasa"
              >
                {headerSegments.map((segment) => (
                  <g key={`${segment.offset}-${segment.label}`}>
                    <rect
                      x={segment.offset}
                      y={0}
                      width={segment.width}
                      height={HEADER_HEIGHT}
                      fill="#f8fafc"
                      stroke="#e2e8f0"
                    />
                    <text x={segment.offset + 4} y={segment.sublabel ? 12 : 20} fontSize={10} fill="#475569">
                      {segment.sublabel ?? ''}
                    </text>
                    <text
                      x={segment.offset + 4}
                      y={segment.sublabel ? 24 : 20}
                      fontSize={11}
                      fill="#0f172a"
                      fontWeight={segment.sublabel ? 500 : 600}
                    >
                      {segment.label}
                    </text>
                  </g>
                ))}
                {todayVisible ? (
                  <line x1={todayX} y1={0} x2={todayX} y2={HEADER_HEIGHT} stroke="#dc2626" strokeWidth={2} />
                ) : null}
              </svg>
            </div>

            <svg
              width={totalWidth}
              height={bodyHeight}
              className="block select-none"
              role="img"
              aria-label="Linimasa Gantt"
            >
              <defs>
                <marker id="gantt-arrow" viewBox="0 0 10 10" refX={9} refY={5} markerWidth={6} markerHeight={6} orient="auto">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" />
                </marker>
                <marker id="gantt-arrow-critical" viewBox="0 0 10 10" refX={9} refY={5} markerWidth={6} markerHeight={6} orient="auto">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#dc2626" />
                </marker>
              </defs>

              {dayOffsets.map((date, index) => {
                const dateString = formatDate(date);
                const isHoliday = holidays.some((holiday) => holiday.date === dateString);
                const weekend = calendar.weekendDays.includes(getDayOfWeek(date));
                const fill = isHoliday ? '#fee2e2' : weekend ? '#f1f5f9' : '#ffffff';
                return (
                  <rect
                    key={dateString}
                    x={index * dayWidth}
                    y={0}
                    width={dayWidth}
                    height={bodyHeight}
                    fill={fill}
                    data-testid={`gantt-day-${dateString}`}
                  />
                );
              })}

              {rows.map((row, index) => (
                <rect
                  key={`grid-${row.task.id}`}
                  x={0}
                  y={index * ROW_HEIGHT}
                  width={totalWidth}
                  height={ROW_HEIGHT}
                  fill="transparent"
                  stroke="#f1f5f9"
                />
              ))}

              {rows.map((row, index) => {
                const task = row.task;
                const y = index * ROW_HEIGHT + ROW_HEIGHT / 2;
                const x = xOf(task.scheduledStart);
                const width = Math.max(dayWidth - 2, widthOf(task.scheduledStart, task.scheduledEnd) - 2);
                const isParent = parents.has(task.id);
                const critical = criticalIds.has(task.id);
                const isDragging = interaction?.taskId === task.id;
                const barHeight = isParent ? 10 : 18;
                const barY = y - barHeight / 2;
                const progressWidth = Math.max(0, (width * task.progress) / 100);

                return (
                  <g key={task.id}>
                    {isParent ? (
                      <g>
                        <rect
                          x={x}
                          y={barY}
                          width={width}
                          height={barHeight}
                          fill={critical ? '#dc2626' : task.color}
                          opacity={0.55}
                          rx={2}
                          data-testid={`gantt-bar-${task.id}`}
                          data-parent="true"
                        />
                        <rect x={x} y={barY} width={3} height={barHeight} fill={task.color} />
                        <polygon
                          points={`${x + width - 6},${barY} ${x + width},${y} ${x + width - 6},${barY + barHeight}`}
                          fill={task.color}
                        />
                      </g>
                    ) : (
                      <g
                        onPointerDown={(event) => {
                          setSelectedId(task.id);
                          onSelectTask(task);
                          setInteraction({ kind: 'drag', taskId: task.id, startX: event.clientX, delta: 0 });
                        }}
                        onDoubleClick={() => onOpenTask(task)}
                        style={{ cursor: 'grab', touchAction: 'none' }}
                      >
                        <rect
                          x={x}
                          y={barY}
                          width={width}
                          height={barHeight}
                          rx={3}
                          fill={critical ? '#dc2626' : task.color}
                          stroke={isDragging ? '#0f172a' : critical ? '#b91c1c' : 'transparent'}
                          strokeWidth={isDragging ? 2 : 1}
                          data-testid={`gantt-bar-${task.id}`}
                          data-critical={critical ? 'true' : 'false'}
                        />
                        {task.progress > 0 ? (
                          <rect
                            x={x}
                            y={barY}
                            width={progressWidth}
                            height={barHeight}
                            rx={3}
                            fill="#0f172a"
                            opacity={0.35}
                            pointerEvents="none"
                          />
                        ) : null}
                        <rect
                          x={x + width - 6}
                          y={barY}
                          width={8}
                          height={barHeight}
                          fill="transparent"
                          style={{ cursor: 'ew-resize' }}
                          onPointerDown={(event) => {
                            event.stopPropagation();
                            setInteraction({ kind: 'resize', taskId: task.id, startX: event.clientX, delta: 0 });
                          }}
                          data-testid={`gantt-resize-${task.id}`}
                        />
                      </g>
                    )}
                    <text
                      x={x + width + 6}
                      y={y + 4}
                      fontSize={10}
                      fill="#475569"
                      pointerEvents="none"
                    >
                      {task.progress > 0 ? `${task.progress}%` : ''}
                    </text>
                  </g>
                );
              })}

              {dependencies.map((dependency) => {
                const predecessor = taskById.get(dependency.predecessorId);
                const successor = taskById.get(dependency.successorId);
                const fromRow = rowIndex.get(dependency.predecessorId);
                const toRow = rowIndex.get(dependency.successorId);
                if (!predecessor || !successor || fromRow === undefined || toRow === undefined) return null;
                const startX =
                  dependency.type === 'FS'
                    ? xOf(predecessor.scheduledEnd) + dayWidth
                    : xOf(predecessor.scheduledStart);
                const endX = xOf(successor.scheduledStart);
                const startY = fromRow * ROW_HEIGHT + ROW_HEIGHT / 2;
                const endY = toRow * ROW_HEIGHT + ROW_HEIGHT / 2;
                const midX = endX - 10;
                let path: string;
                if (midX > startX + 8) {
                  path = `M ${startX} ${startY} H ${midX} V ${endY} H ${endX}`;
                } else {
                  const laneX = Math.max(startX, endX) + 16;
                  const laneY = endY + (endY >= startY ? -9 : 9);
                  path = `M ${startX} ${startY} H ${laneX} V ${laneY} H ${endX - 10} V ${endY} H ${endX}`;
                }
                const critical = criticalIds.has(dependency.predecessorId) && criticalIds.has(dependency.successorId);
                return (
                  <path
                    key={dependency.id}
                    d={path}
                    fill="none"
                    stroke={critical ? '#dc2626' : '#64748b'}
                    strokeWidth={critical ? 2 : 1.25}
                    markerEnd={critical ? 'url(#gantt-arrow-critical)' : 'url(#gantt-arrow)'}
                    data-testid={`gantt-dependency-${dependency.id}`}
                    data-critical={critical ? 'true' : 'false'}
                  />
                );
              })}

              {todayVisible ? (
                <line
                  x1={todayX}
                  y1={0}
                  x2={todayX}
                  y2={bodyHeight}
                  stroke="#dc2626"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  data-testid="gantt-today-line"
                />
              ) : null}
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

export { HEADER_HEIGHT, ROW_HEIGHT };
