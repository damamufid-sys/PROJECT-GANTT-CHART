/**
 * Mesin penjadwalan (bagian 6.4 - 6.6).
 * Fungsi murni: dipakai server sebagai sumber kebenaran dan client untuk pratinjau drag.
 */

import {
  type CalendarConfig,
  nextWorkingDay,
  shiftWorkingDays,
  workingDaysBetween,
} from './calendar.js';
import { compareDates, formatDate, maxDate, toUTCDate } from './dates.js';
import type { DependencyType } from './types.js';

export interface SchedulableTask {
  id: string;
  parentId: string | null;
  position: number;
  durationDays: number;
  startDate: string;
  progress?: number;
  priority?: string;
  name?: string;
}

export interface SchedulableDependency {
  predecessorId: string;
  successorId: string;
  type: DependencyType;
  lagDays: number;
}

export interface ScheduledTask {
  id: string;
  scheduledStart: string;
  scheduledEnd: string;
  durationDays: number;
  progress: number;
  isParent: boolean;
}

export interface ScheduleOutput {
  tasks: ScheduledTask[];
  byId: Map<string, ScheduledTask>;
}

export const MAX_HIERARCHY_DEPTH = 3;

export class ScheduleCycleError extends Error {
  readonly cycle: string[];

  constructor(cycle: string[]) {
    super(`Siklus dependensi terdeteksi: ${cycle.join(' -> ')}`);
    this.name = 'ScheduleCycleError';
    this.cycle = cycle;
  }
}

/** Batas mulai penerus menurut satu dependensi (bagian 6.4). */
export function dependencyBound(
  predecessor: { scheduledStart: string; scheduledEnd: string },
  dependency: SchedulableDependency,
  calendar: CalendarConfig,
): Date {
  if (dependency.type === 'FS') {
    return shiftWorkingDays(
      toUTCDate(predecessor.scheduledEnd),
      1 + dependency.lagDays,
      calendar,
    );
  }
  return shiftWorkingDays(
    toUTCDate(predecessor.scheduledStart),
    dependency.lagDays,
    calendar,
  );
}

/** Bentuk minimal data hierarki tugas. */
export interface HierarchicalTask {
  id: string;
  parentId: string | null;
}

/** Parent (summary) adalah tugas yang memiliki minimal satu anak. */
export function getParentIds(tasks: HierarchicalTask[]): Set<string> {
  const parents = new Set<string>();
  const ids = new Set(tasks.map((task) => task.id));
  for (const task of tasks) {
    if (task.parentId && ids.has(task.parentId)) parents.add(task.parentId);
  }
  return parents;
}

/** Hanya tugas daun yang boleh punya dependensi dan assignment. */
export function getLeafTaskIds(tasks: HierarchicalTask[]): Set<string> {
  const parents = getParentIds(tasks);
  return new Set(tasks.filter((task) => !parents.has(task.id)).map((task) => task.id));
}

/** Kedalaman tugas, 1 untuk tugas akar. */
export function getTaskDepth(tasks: HierarchicalTask[], taskId: string): number {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  let depth = 1;
  let current = byId.get(taskId);
  const guard = new Set<string>();
  while (current?.parentId) {
    if (guard.has(current.id)) break;
    guard.add(current.id);
    const parent = byId.get(current.parentId);
    if (!parent) break;
    depth += 1;
    current = parent;
  }
  return depth;
}

/** Jumlah level maksimal di bawah tugas (0 bila tidak punya anak). */
export function getSubtreeExtraDepth(tasks: HierarchicalTask[], taskId: string): number {
  const childrenOf = new Map<string, string[]>();
  for (const task of tasks) {
    if (!task.parentId) continue;
    const list = childrenOf.get(task.parentId) ?? [];
    list.push(task.id);
    childrenOf.set(task.parentId, list);
  }
  let extra = 0;
  const stack: Array<{ id: string; level: number }> = [{ id: taskId, level: 0 }];
  while (stack.length > 0) {
    const node = stack.pop() as { id: string; level: number };
    extra = Math.max(extra, node.level);
    for (const childId of childrenOf.get(node.id) ?? []) {
      stack.push({ id: childId, level: node.level + 1 });
    }
  }
  return extra;
}

/** Semua keturunan sebuah tugas (termasuk dirinya sendiri). */
export function getSubtreeIds(tasks: HierarchicalTask[], taskId: string): string[] {
  const childrenOf = new Map<string, string[]>();
  for (const task of tasks) {
    if (!task.parentId) continue;
    const list = childrenOf.get(task.parentId) ?? [];
    list.push(task.id);
    childrenOf.set(task.parentId, list);
  }
  const result: string[] = [];
  const stack = [taskId];
  while (stack.length > 0) {
    const id = stack.pop() as string;
    result.push(id);
    for (const childId of childrenOf.get(id) ?? []) stack.push(childId);
  }
  return result;
}

/**
 * Mendeteksi siklus pada graf ketergantungan.
 * Mengembalikan lintasan siklus (mis. `[a, b, a]`) atau null bila bebas siklus.
 */
export function detectCycle(
  dependencies: SchedulableDependency[],
  taskIds?: Iterable<string>,
): string[] | null {
  const adjacency = new Map<string, string[]>();
  const nodes = new Set<string>(taskIds ? [...taskIds] : []);
  for (const dependency of dependencies) {
    nodes.add(dependency.predecessorId);
    nodes.add(dependency.successorId);
    const list = adjacency.get(dependency.predecessorId) ?? [];
    list.push(dependency.successorId);
    adjacency.set(dependency.predecessorId, list);
  }

  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  for (const node of nodes) color.set(node, WHITE);
  const path: string[] = [];

  const visit = (node: string): string[] | null => {
    color.set(node, GRAY);
    path.push(node);
    for (const next of adjacency.get(node) ?? []) {
      const state = color.get(next) ?? WHITE;
      if (state === GRAY) {
        const start = path.indexOf(next);
        return [...path.slice(start), next];
      }
      if (state === WHITE) {
        const found = visit(next);
        if (found) return found;
      }
    }
    path.pop();
    color.set(node, BLACK);
    return null;
  };

  for (const node of nodes) {
    if ((color.get(node) ?? WHITE) === WHITE) {
      const found = visit(node);
      if (found) return found;
    }
  }
  return null;
}

/** Urutan topologis tugas daun memakai algoritma Kahn. */
export function topologicalOrder(
  tasks: SchedulableTask[],
  dependencies: SchedulableDependency[],
): string[] {
  const leaves = getLeafTaskIds(tasks);
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const adjacency = new Map<string, SchedulableDependency[]>();
  const indegree = new Map<string, number>();
  for (const id of leaves) {
    adjacency.set(id, []);
    indegree.set(id, 0);
  }
  for (const dependency of dependencies) {
    if (!leaves.has(dependency.predecessorId) || !leaves.has(dependency.successorId)) {
      continue;
    }
    adjacency.get(dependency.predecessorId)?.push(dependency);
    indegree.set(dependency.successorId, (indegree.get(dependency.successorId) ?? 0) + 1);
  }

  const compareByPosition = (a: string, b: string): number => {
    const taskA = byId.get(a);
    const taskB = byId.get(b);
    if (!taskA || !taskB) return 0;
    if (taskA.position !== taskB.position) return taskA.position - taskB.position;
    return a < b ? -1 : a > b ? 1 : 0;
  };

  const ready = [...leaves].filter((id) => (indegree.get(id) ?? 0) === 0).sort(compareByPosition);
  const order: string[] = [];
  while (ready.length > 0) {
    const id = ready.shift() as string;
    order.push(id);
    for (const dependency of adjacency.get(id) ?? []) {
      const remaining = (indegree.get(dependency.successorId) ?? 0) - 1;
      indegree.set(dependency.successorId, remaining);
      if (remaining === 0) {
        ready.push(dependency.successorId);
        ready.sort(compareByPosition);
      }
    }
  }

  if (order.length !== leaves.size) {
    const cycle = detectCycle(dependencies, leaves) ?? [];
    throw new ScheduleCycleError(cycle);
  }
  return order;
}

/**
 * Menghitung `scheduledStart` dan `scheduledEnd` seluruh tugas,
 * lalu menggulung (roll-up) tugas induk dari bawah ke atas.
 */
export function computeSchedule(
  tasks: SchedulableTask[],
  dependencies: SchedulableDependency[],
  calendar: CalendarConfig,
): ScheduleOutput {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const parents = getParentIds(tasks);
  const order = topologicalOrder(tasks, dependencies);

  const predecessorsOf = new Map<string, SchedulableDependency[]>();
  for (const dependency of dependencies) {
    if (parents.has(dependency.predecessorId) || parents.has(dependency.successorId)) continue;
    const list = predecessorsOf.get(dependency.successorId) ?? [];
    list.push(dependency);
    predecessorsOf.set(dependency.successorId, list);
  }

  const byIdResult = new Map<string, ScheduledTask>();

  for (const id of order) {
    const task = byId.get(id);
    if (!task) continue;
    let bound: Date | null = null;
    for (const dependency of predecessorsOf.get(id) ?? []) {
      const predecessor = byIdResult.get(dependency.predecessorId);
      if (!predecessor) continue;
      const candidate = dependencyBound(predecessor, dependency, calendar);
      bound = bound === null ? candidate : maxDate(bound, candidate);
    }
    const earliestStart = toUTCDate(task.startDate);
    const rawStart = bound === null ? earliestStart : maxDate(earliestStart, bound);
    const start = nextWorkingDay(rawStart, calendar);
    const durationDays = Math.max(1, Math.trunc(task.durationDays));
    const end = shiftWorkingDays(start, durationDays - 1, calendar);
    byIdResult.set(id, {
      id,
      scheduledStart: formatDate(start),
      scheduledEnd: formatDate(end),
      durationDays,
      progress: clampProgress(task.progress),
      isParent: false,
    });
  }

  const parentsByDepth = [...parents]
    .map((id) => ({ id, depth: getTaskDepth(tasks, id) }))
    .sort((a, b) => b.depth - a.depth);

  for (const { id } of parentsByDepth) {
    const children = tasks
      .filter((task) => task.parentId === id)
      .map((task) => byIdResult.get(task.id))
      .filter((task): task is ScheduledTask => Boolean(task));
    if (children.length === 0) continue;
    let start = toUTCDate(children[0].scheduledStart);
    let end = toUTCDate(children[0].scheduledEnd);
    for (const child of children) {
      start = compareDates(start, toUTCDate(child.scheduledStart)) <= 0 ? start : toUTCDate(child.scheduledStart);
      end = compareDates(end, toUTCDate(child.scheduledEnd)) >= 0 ? end : toUTCDate(child.scheduledEnd);
    }
    const totalDuration = children.reduce((sum, child) => sum + child.durationDays, 0);
    const weightedProgress =
      totalDuration > 0
        ? children.reduce((sum, child) => sum + child.progress * child.durationDays, 0) /
          totalDuration
        : 0;
    byIdResult.set(id, {
      id,
      scheduledStart: formatDate(start),
      scheduledEnd: formatDate(end),
      durationDays: workingDaysBetween(start, end, calendar),
      progress: Math.round(weightedProgress),
      isParent: true,
    });
  }

  return { tasks: tasks.map((task) => byIdResult.get(task.id) as ScheduledTask), byId: byIdResult };
}

function clampProgress(value: number | undefined): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}
