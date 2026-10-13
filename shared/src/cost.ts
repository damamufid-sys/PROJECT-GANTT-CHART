/**
 * Biaya dan beban kerja (bagian 6.10).
 * Tarif harian = gaji bulanan / 22 hari kerja.
 */

import { type CalendarConfig, isWorkingDay } from './calendar.js';
import { compareDates, toUTCDate } from './dates.js';
import { getLeafTaskIds } from './scheduler.js';

export const WORKING_DAYS_PER_MONTH = 22;

export interface CostTask {
  id: string;
  name?: string;
  parentId: string | null;
  durationDays: number;
  scheduledStart: string;
  scheduledEnd: string;
}

export interface CostAssignment {
  id?: string;
  taskId: string;
  resourceId: string;
  allocationPercent: number;
}

export interface CostResource {
  id: string;
  name: string;
  salary: number;
}

export interface TaskCost {
  taskId: string;
  cost: number;
}

export interface ResourceCost {
  resourceId: string;
  totalCost: number;
  totalWorkingDays: number;
}

export interface OverallocationWarning {
  resourceId: string;
  date: string;
  totalPercent: number;
  taskIds: string[];
}

/** Tarif harian seorang anggota tim. */
export function dailyRate(salary: number): number {
  return salary / WORKING_DAYS_PER_MONTH;
}

/** Biaya satu tugas = jumlah (tarif harian x durasi x persen alokasi). */
export function computeTaskCost(
  task: CostTask,
  assignments: CostAssignment[],
  resources: CostResource[],
): number {
  const salaryById = new Map(resources.map((resource) => [resource.id, resource.salary]));
  let total = 0;
  for (const assignment of assignments) {
    if (assignment.taskId !== task.id) continue;
    const salary = salaryById.get(assignment.resourceId);
    if (salary === undefined) continue;
    const percent = Math.min(100, Math.max(0, assignment.allocationPercent));
    total += dailyRate(salary) * task.durationDays * (percent / 100);
  }
  return total;
}

/** Biaya seluruh tugas daun (tugas induk tidak dihitung terpisah). */
export function computeTaskCosts(
  tasks: CostTask[],
  assignments: CostAssignment[],
  resources: CostResource[],
): TaskCost[] {
  const leaves = getLeafTaskIds(tasks);
  return tasks
    .filter((task) => leaves.has(task.id))
    .map((task) => ({
      taskId: task.id,
      cost: computeTaskCost(task, assignments, resources),
    }));
}

export function totalProjectCost(
  tasks: CostTask[],
  assignments: CostAssignment[],
  resources: CostResource[],
): number {
  return computeTaskCosts(tasks, assignments, resources).reduce((sum, item) => sum + item.cost, 0);
}

/** Total biaya per anggota tim beserta total hari kerja yang dialokasikan. */
export function computeResourceCosts(
  tasks: CostTask[],
  assignments: CostAssignment[],
  resources: CostResource[],
): ResourceCost[] {
  const leaves = getLeafTaskIds(tasks);
  const leafTasks = tasks.filter((task) => leaves.has(task.id));
  const taskById = new Map(leafTasks.map((task) => [task.id, task]));
  return resources.map((resource) => {
    let totalCost = 0;
    let totalWorkingDays = 0;
    for (const assignment of assignments) {
      if (assignment.resourceId !== resource.id) continue;
      const task = taskById.get(assignment.taskId);
      if (!task) continue;
      const percent = Math.min(100, Math.max(0, assignment.allocationPercent));
      const proportion = percent / 100;
      totalCost += dailyRate(resource.salary) * task.durationDays * proportion;
      totalWorkingDays += task.durationDays * proportion;
    }
    return { resourceId: resource.id, totalCost, totalWorkingDays };
  });
}

/**
 * Peringatan over-alokasi: seorang anggota dialokasikan lebih dari 100%
 * pada satu hari kerja karena tugas yang saling tumpang tindih.
 */
export function findOverallocations(
  tasks: CostTask[],
  assignments: CostAssignment[],
  resources: CostResource[],
  calendar: CalendarConfig,
): OverallocationWarning[] {
  const leaves = getLeafTaskIds(tasks);
  const leafTasks = tasks.filter((task) => leaves.has(task.id));
  const taskById = new Map(leafTasks.map((task) => [task.id, task]));
  const relevant = assignments.filter((assignment) => taskById.has(assignment.taskId));
  if (relevant.length === 0) return [];

  const sorted = [...relevant].sort((a, b) => {
    const taskA = taskById.get(a.taskId) as CostTask;
    const taskB = taskById.get(b.taskId) as CostTask;
    if (taskA.scheduledStart !== taskB.scheduledStart) {
      return taskA.scheduledStart < taskB.scheduledStart ? -1 : 1;
    }
    return a.resourceId < b.resourceId ? -1 : a.resourceId > b.resourceId ? 1 : 0;
  });

  const warnings = new Map<string, OverallocationWarning>();
  for (const assignment of sorted) {
    const task = taskById.get(assignment.taskId) as CostTask;
    const start = toUTCDate(task.scheduledStart);
    const end = toUTCDate(task.scheduledEnd);
    let cursor = start;
    while (compareDates(cursor, end) <= 0) {
      if (isWorkingDay(cursor, calendar)) {
        const date = cursor.toISOString().slice(0, 10);
        const key = `${assignment.resourceId}|${date}`;
        const existing = warnings.get(key) ?? {
          resourceId: assignment.resourceId,
          date,
          totalPercent: 0,
          taskIds: [],
        };
        existing.totalPercent += assignment.allocationPercent;
        if (!existing.taskIds.includes(assignment.taskId)) existing.taskIds.push(assignment.taskId);
        warnings.set(key, existing);
      }
      cursor = new Date(cursor.getTime() + 86_400_000);
    }
  }

  const resourceIds = new Set(resources.map((resource) => resource.id));
  return [...warnings.values()]
    .filter((warning) => warning.totalPercent > 100 && resourceIds.has(warning.resourceId))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

const idrFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

/** Format rupiah, mis. `Rp 15.000.000`. */
export function formatIDR(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return idrFormatter.format(Math.round(safe)).replace(/\u00a0/g, ' ');
}
