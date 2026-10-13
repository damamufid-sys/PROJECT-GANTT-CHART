import { describe, expect, it } from 'vitest';
import { createCalendar } from './calendar.js';
import { computeCpm, workingDayOrdinal } from './cpm.js';
import { computeSchedule, type SchedulableTask } from './scheduler.js';

const calendar = createCalendar([0, 6]);

function leaf(id: string, durationDays: number, startDate: string, name = id): SchedulableTask {
  return { id, parentId: null, position: 0, durationDays, startDate, name };
}

describe('vektor CPM wajib (bagian 6.11)', () => {
  const tasks = [
    leaf('A', 3, '2026-10-19', 'A'),
    leaf('B', 2, '2026-10-19', 'B'),
    leaf('C', 5, '2026-10-19', 'C'),
    leaf('D', 1, '2026-10-19', 'D'),
  ];
  const dependencies = [
    { predecessorId: 'A', successorId: 'B', type: 'FS' as const, lagDays: 0 },
    { predecessorId: 'A', successorId: 'C', type: 'FS' as const, lagDays: 0 },
    { predecessorId: 'B', successorId: 'D', type: 'FS' as const, lagDays: 0 },
    { predecessorId: 'C', successorId: 'D', type: 'FS' as const, lagDays: 0 },
  ];

  it('menandai A, C, D kritis, B punya float 3, dan PE = 8', () => {
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

    expect(cpm.projectEndOrdinal).toBe(8);
    expect(cpm.byId.get('A')?.critical).toBe(true);
    expect(cpm.byId.get('C')?.critical).toBe(true);
    expect(cpm.byId.get('D')?.critical).toBe(true);
    expect(cpm.byId.get('B')?.critical).toBe(false);
    expect(cpm.byId.get('B')?.totalFloat).toBe(3);
    expect(cpm.criticalPaths.map((path) => path.join('-'))).toEqual(['A-C-D']);
  });

  it('menghitung ordinal hari kerja', () => {
    expect(workingDayOrdinal('2026-10-19', '2026-10-19', calendar)).toBe(0);
    expect(workingDayOrdinal('2026-10-19', '2026-10-23', calendar)).toBe(4);
    expect(workingDayOrdinal('2026-10-19', '2026-10-26', calendar)).toBe(5);
  });
});
