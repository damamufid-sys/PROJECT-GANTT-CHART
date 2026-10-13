/**
 * Diagram PERT / activity-on-node (bagian 6.9).
 * Estimasi te dan variansi bersifat informasi tambahan, tidak mengubah jadwal.
 */

import type { CpmDependencyInput, CpmResult } from './cpm.js';
import type { DependencyType } from './types.js';

export interface PertTaskInput {
  id: string;
  name: string;
  optimisticDays?: number | null;
  pessimisticDays?: number | null;
}

export interface PertNode {
  id: string;
  name: string;
  durationDays: number;
  es: number;
  ef: number;
  ls: number;
  lf: number;
  slack: number;
  critical: boolean;
  /** Kolom tata letak = kedalaman jalur terpanjang dari node awal. */
  column: number;
  optimisticDays: number | null;
  pessimisticDays: number | null;
  expectedDays: number | null;
  variance: number | null;
}

export interface PertEdge {
  from: string;
  to: string;
  type: DependencyType;
  lagDays: number;
  critical: boolean;
}

export interface PertNetwork {
  nodes: PertNode[];
  edges: PertEdge[];
  totalVariance: number | null;
  stdDeviation: number | null;
}

/** Estimasi PERT: te = (o + 4m + p) / 6, variansi = ((p - o) / 6)^2. */
export function pertEstimate(
  optimisticDays: number,
  mostLikelyDays: number,
  pessimisticDays: number,
): { expectedDays: number; variance: number } {
  const expectedDays = (optimisticDays + 4 * mostLikelyDays + pessimisticDays) / 6;
  const variance = ((pessimisticDays - optimisticDays) / 6) ** 2;
  return { expectedDays, variance };
}

export function buildPertNetwork(
  tasks: PertTaskInput[],
  dependencies: CpmDependencyInput[],
  cpm: CpmResult,
): PertNetwork {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const cpmNodes = cpm.tasks;
  const nodeIds = new Set(cpmNodes.map((task) => task.id));

  const edges: PertEdge[] = dependencies
    .filter((dependency) => nodeIds.has(dependency.predecessorId) && nodeIds.has(dependency.successorId))
    .map((dependency) => ({
      from: dependency.predecessorId,
      to: dependency.successorId,
      type: dependency.type,
      lagDays: dependency.lagDays,
      critical:
        (cpm.byId.get(dependency.predecessorId)?.critical ?? false) &&
        (cpm.byId.get(dependency.successorId)?.critical ?? false),
    }));

  const predecessors = new Map<string, string[]>();
  for (const edge of edges) {
    const list = predecessors.get(edge.to) ?? [];
    list.push(edge.from);
    predecessors.set(edge.to, list);
  }

  const columnCache = new Map<string, number>();
  const columnOf = (id: string, guard = new Set<string>()): number => {
    const cached = columnCache.get(id);
    if (cached !== undefined) return cached;
    if (guard.has(id)) return 0;
    guard.add(id);
    const preds = predecessors.get(id) ?? [];
    const column = preds.length === 0 ? 0 : Math.max(...preds.map((pred) => columnOf(pred, guard) + 1));
    guard.delete(id);
    columnCache.set(id, column);
    return column;
  };

  const nodes: PertNode[] = cpmNodes.map((task) => {
    const input = taskById.get(task.id);
    const optimistic = input?.optimisticDays ?? null;
    const pessimistic = input?.pessimisticDays ?? null;
    const hasEstimate =
      typeof optimistic === 'number' &&
      typeof pessimistic === 'number' &&
      optimistic > 0 &&
      pessimistic >= optimistic;
    const estimate = hasEstimate
      ? pertEstimate(optimistic, task.durationDays, pessimistic)
      : null;
    return {
      id: task.id,
      name: task.name,
      durationDays: task.durationDays,
      es: task.es,
      ef: task.ef,
      ls: task.ls,
      lf: task.lf,
      slack: task.totalFloat,
      critical: task.critical,
      column: columnOf(task.id),
      optimisticDays: hasEstimate ? optimistic : null,
      pessimisticDays: hasEstimate ? pessimistic : null,
      expectedDays: estimate ? round(estimate.expectedDays, 3) : null,
      variance: estimate ? round(estimate.variance, 4) : null,
    };
  });

  const criticalNodes = nodes.filter((node) => node.critical);
  const hasAnyEstimate = criticalNodes.some((node) => node.variance !== null);
  const totalVariance = hasAnyEstimate
    ? round(
        criticalNodes.reduce((sum, node) => sum + (node.variance ?? 0), 0),
        4,
      )
    : null;
  const stdDeviation = totalVariance === null ? null : round(Math.sqrt(totalVariance), 4);

  return { nodes, edges, totalVariance, stdDeviation };
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
