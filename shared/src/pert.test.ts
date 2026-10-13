import { describe, expect, it } from 'vitest';
import { createCalendar } from './calendar.js';
import { computeCpm } from './cpm.js';
import { buildPertNetwork, pertEstimate } from './pert.js';
import { computeSchedule, type SchedulableTask } from './scheduler.js';

const calendar = createCalendar([0, 6]);

const tasks: SchedulableTask[] = [
  { id: 'A', parentId: null, position: 0, durationDays: 3, startDate: '2026-10-19', name: 'A' },
  { id: 'B', parentId: null, position: 1, durationDays: 2, startDate: '2026-10-19', name: 'B' },
  { id: 'C', parentId: null, position: 2, durationDays: 5, startDate: '2026-10-19', name: 'C' },
  { id: 'D', parentId: null, position: 3, durationDays: 1, startDate: '2026-10-19', name: 'D' },
];
const dependencies = [
  { predecessorId: 'A', successorId: 'B', type: 'FS' as const, lagDays: 0 },
  { predecessorId: 'A', successorId: 'C', type: 'FS' as const, lagDays: 0 },
  { predecessorId: 'B', successorId: 'D', type: 'FS' as const, lagDays: 0 },
  { predecessorId: 'C', successorId: 'D', type: 'FS' as const, lagDays: 0 },
];

describe('diagram PERT', () => {
  it('menghitung kolom berdasarkan jalur terpanjang dan menandai jalur kritis', () => {
    const schedule = computeSchedule(tasks, dependencies, calendar);
    const cpm = computeCpm(
      tasks.map((task) => {
        const scheduled = schedule.byId.get(task.id);
        return {
          id: task.id,
          name: task.name ?? task.id,
          parentId: task.parentId,
          durationDays: task.durationDays,
          scheduledStart: scheduled?.scheduledStart as string,
          scheduledEnd: scheduled?.scheduledEnd as string,
        };
      }),
      dependencies,
      calendar,
      '2026-10-19',
    );
    const network = buildPertNetwork(
      tasks.map((task) => ({ id: task.id, name: task.name ?? task.id })),
      dependencies,
      cpm,
    );
    const columnOf = (id: string): number =>
      network.nodes.find((node) => node.id === id)?.column ?? -1;

    expect(columnOf('A')).toBe(0);
    expect(columnOf('B')).toBe(1);
    expect(columnOf('C')).toBe(1);
    expect(columnOf('D')).toBe(2);
    expect(network.nodes.find((node) => node.id === 'C')?.critical).toBe(true);
    expect(network.nodes.find((node) => node.id === 'B')?.critical).toBe(false);
    expect(network.edges).toHaveLength(4);
    expect(network.edges.filter((edge) => edge.critical)).toHaveLength(2);
  });

  it('menghitung estimasi te dan variansi', () => {
    const estimate = pertEstimate(8, 10, 15);
    expect(estimate.expectedDays).toBeCloseTo(10.5, 3);
    expect(estimate.variance).toBeCloseTo(1.3611, 3);
  });
});
