/**
 * Critical Path Method (bagian 6.8). Hanya tugas daun yang dihitung.
 */

import { type CalendarConfig, workingDaysBetween } from './calendar.js';
import { toUTCDate } from './dates.js';
import { getLeafTaskIds } from './scheduler.js';
import type { DependencyType } from './types.js';

export interface CpmTaskInput {
  id: string;
  name: string;
  parentId: string | null;
  durationDays: number;
  scheduledStart: string;
  scheduledEnd: string;
}

export interface CpmDependencyInput {
  predecessorId: string;
  successorId: string;
  type: DependencyType;
  lagDays: number;
}

export interface CpmTask {
  id: string;
  name: string;
  durationDays: number;
  scheduledStart: string;
  scheduledEnd: string;
  es: number;
  ef: number;
  ls: number;
  lf: number;
  totalFloat: number;
  critical: boolean;
}

export interface CpmResult {
  tasks: CpmTask[];
  byId: Map<string, CpmTask>;
  /** Ordinal hari kerja akhir proyek (PE). */
  projectEndOrdinal: number;
  projectStartDate: string;
  projectEndDate: string;
  totalWorkingDays: number;
  criticalTasks: string[];
  criticalPaths: string[][];
}

/** Ordinal hari kerja dari `projectStart` (inklusif) sampai `date`. */
export function workingDayOrdinal(
  projectStart: string,
  date: string,
  calendar: CalendarConfig,
): number {
  return workingDaysBetween(toUTCDate(projectStart), toUTCDate(date), calendar) - 1;
}

export function computeCpm(
  tasks: CpmTaskInput[],
  dependencies: CpmDependencyInput[],
  calendar: CalendarConfig,
  projectStart: string,
): CpmResult {
  const leaves = getLeafTaskIds(tasks);
  const leafTasks = tasks.filter((task) => leaves.has(task.id));
  const leafIds = new Set(leafTasks.map((task) => task.id));
  const taskById = new Map(leafTasks.map((task) => [task.id, task]));

  const deps = dependencies.filter(
    (dependency) =>
      leafIds.has(dependency.predecessorId) && leafIds.has(dependency.successorId),
  );

  const successorsOf = new Map<string, CpmDependencyInput[]>();
  const indegree = new Map<string, number>();
  for (const id of leafIds) indegree.set(id, 0);
  for (const dependency of deps) {
    const list = successorsOf.get(dependency.predecessorId) ?? [];
    list.push(dependency);
    successorsOf.set(dependency.predecessorId, list);
    indegree.set(dependency.successorId, (indegree.get(dependency.successorId) ?? 0) + 1);
  }

  const es = new Map<string, number>();
  const ef = new Map<string, number>();
  for (const task of leafTasks) {
    const start = workingDayOrdinal(projectStart, task.scheduledStart, calendar);
    const duration = Math.max(1, Math.trunc(task.durationDays));
    es.set(task.id, start);
    ef.set(task.id, start + duration - 1);
  }

  let projectEndOrdinal = 0;
  for (const value of ef.values()) projectEndOrdinal = Math.max(projectEndOrdinal, value);

  const ls = new Map<string, number>();
  const lf = new Map<string, number>();

  // Urutan topologis (Kahn), lalu diproses terbalik agar penerus selesai lebih dulu.
  const ready = [...leafIds].filter((id) => (indegree.get(id) ?? 0) === 0);
  const topological: string[] = [];
  while (ready.length > 0) {
    const id = ready.shift() as string;
    topological.push(id);
    for (const dependency of successorsOf.get(id) ?? []) {
      const remaining = (indegree.get(dependency.successorId) ?? 0) - 1;
      indegree.set(dependency.successorId, remaining);
      if (remaining === 0) ready.push(dependency.successorId);
    }
  }
  for (const id of leafIds) {
    if (!topological.includes(id)) topological.push(id);
  }

  for (const id of [...topological].reverse()) {
    const task = taskById.get(id);
    if (!task) continue;
    const duration = Math.max(1, Math.trunc(task.durationDays));
    const successors = successorsOf.get(id) ?? [];
    let latestFinish: number;
    if (successors.length === 0) {
      latestFinish = projectEndOrdinal;
    } else {
      latestFinish = Number.POSITIVE_INFINITY;
      for (const dependency of successors) {
        const successorLs = ls.get(dependency.successorId);
        if (successorLs === undefined) continue;
        const candidate =
          dependency.type === 'FS'
            ? successorLs - 1 - dependency.lagDays
            : successorLs - dependency.lagDays + duration - 1;
        latestFinish = Math.min(latestFinish, candidate);
      }
      if (!Number.isFinite(latestFinish)) latestFinish = projectEndOrdinal;
    }
    lf.set(id, latestFinish);
    ls.set(id, latestFinish - duration + 1);
  }

  const results: CpmTask[] = leafTasks.map((task) => {
    const taskEs = es.get(task.id) ?? 0;
    const taskEf = ef.get(task.id) ?? 0;
    const taskLs = ls.get(task.id) ?? 0;
    const taskLf = lf.get(task.id) ?? 0;
    const totalFloat = Math.max(0, taskLs - taskEs);
    return {
      id: task.id,
      name: task.name,
      durationDays: Math.max(1, Math.trunc(task.durationDays)),
      scheduledStart: task.scheduledStart,
      scheduledEnd: task.scheduledEnd,
      es: taskEs,
      ef: taskEf,
      ls: taskLs,
      lf: taskLf,
      totalFloat,
      critical: totalFloat === 0,
    };
  });

  const byId = new Map(results.map((task) => [task.id, task]));
  const criticalTasks = results
    .filter((task) => task.critical)
    .sort((a, b) => a.es - b.es)
    .map((task) => task.id);

  const criticalSet = new Set(criticalTasks);
  const criticalSuccessors = new Map<string, string[]>();
  const hasCriticalPredecessor = new Set<string>();
  for (const dependency of deps) {
    if (!criticalSet.has(dependency.predecessorId) || !criticalSet.has(dependency.successorId)) {
      continue;
    }
    const list = criticalSuccessors.get(dependency.predecessorId) ?? [];
    list.push(dependency.successorId);
    criticalSuccessors.set(dependency.predecessorId, list);
    hasCriticalPredecessor.add(dependency.successorId);
  }

  const pathStarts = criticalTasks.filter((id) => !hasCriticalPredecessor.has(id));
  const criticalPaths: string[][] = [];
  const walk = (current: string, path: string[], visited: Set<string>): void => {
    const nextNodes = (criticalSuccessors.get(current) ?? []).filter((id) => !visited.has(id));
    if (nextNodes.length === 0) {
      criticalPaths.push([...path]);
      return;
    }
    for (const next of nextNodes) {
      visited.add(next);
      path.push(next);
      walk(next, path, visited);
      path.pop();
      visited.delete(next);
    }
  };
  for (const start of pathStarts) {
    walk(start, [start], new Set([start]));
  }
  criticalPaths.sort((a, b) => (byId.get(a[0])?.es ?? 0) - (byId.get(b[0])?.es ?? 0));

  let projectEndDate = projectStart;
  for (const task of leafTasks) {
    if (task.scheduledEnd > projectEndDate) projectEndDate = task.scheduledEnd;
  }

  return {
    tasks: results,
    byId,
    projectEndOrdinal,
    projectStartDate: projectStart,
    projectEndDate,
    totalWorkingDays: workingDaysBetween(
      toUTCDate(projectStart),
      toUTCDate(projectEndDate),
      calendar,
    ),
    criticalTasks,
    criticalPaths,
  };
}
