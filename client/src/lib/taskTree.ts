import {
  createCalendar,
  getSubtreeIds,
  type CalendarConfig,
  type DependencyDto,
  type HolidayDto,
  type TaskDto,
} from '@gantt/shared';

export interface TaskRow {
  task: TaskDto;
  depth: number;
  hasChildren: boolean;
  collapsed: boolean;
  wbs: string;
}

export function sortByPosition(tasks: TaskDto[]): TaskDto[] {
  return [...tasks].sort((a, b) => a.position - b.position);
}

/** Menyusun daftar baris (WBS) sesuai urutan dan status lipat. */
export function buildTaskRows(tasks: TaskDto[], collapsedIds: Set<string>): TaskRow[] {
  const childrenOf = new Map<string | null, TaskDto[]>();
  for (const task of tasks) {
    const key = task.parentId ?? null;
    const list = childrenOf.get(key) ?? [];
    list.push(task);
    childrenOf.set(key, list);
  }

  const rows: TaskRow[] = [];
  const walk = (parentId: string | null, depth: number, prefix: string): void => {
    const siblings = sortByPosition(childrenOf.get(parentId) ?? []);
    siblings.forEach((task, index) => {
      const wbs = prefix ? `${prefix}.${index + 1}` : `${index + 1}`;
      const children = childrenOf.get(task.id) ?? [];
      const collapsed = collapsedIds.has(task.id);
      rows.push({ task, depth, hasChildren: children.length > 0, collapsed, wbs });
      if (children.length > 0 && !collapsed) walk(task.id, depth + 1, wbs);
    });
  };
  walk(null, 0, '');
  return rows;
}

/** Semua id tugas yang punya anak. */
export function parentIdSet(tasks: TaskDto[]): Set<string> {
  const ids = new Set(tasks.map((task) => task.id));
  const parents = new Set<string>();
  for (const task of tasks) {
    if (task.parentId && ids.has(task.parentId)) parents.add(task.parentId);
  }
  return parents;
}

export function isParentTask(tasks: TaskDto[], taskId: string): boolean {
  return parentIdSet(tasks).has(taskId);
}

/** CalendarConfig dari data proyek. */
export function buildCalendar(
  weekendDays: string | number[],
  holidays: Array<HolidayDto | string>,
): CalendarConfig {
  const holidayDates = holidays.map((holiday) =>
    typeof holiday === 'string' ? holiday : holiday.date,
  );
  return createCalendar(weekendDays, holidayDates);
}

/** Tugas yang tidak boleh menjadi induk bagi `taskId` (dirinya dan keturunannya). */
export function forbiddenParentIds(tasks: TaskDto[], taskId: string): Set<string> {
  return new Set(getSubtreeIds(tasks, taskId));
}

/** Ringkasan milik tugas seperti "2/5 selesei". */
export function countCompleted(children: TaskDto[]): number {
  return children.filter((child) => child.progress >= 100).length;
}

export function dependenciesOf(dependencies: DependencyDto[], successorId: string): DependencyDto[] {
  return dependencies.filter((dependency) => dependency.successorId === successorId);
}
