import { describe, expect, it } from 'vitest';
import { createCalendar } from './calendar.js';
import {
  ScheduleCycleError,
  computeSchedule,
  detectCycle,
  getSubtreeExtraDepth,
  getTaskDepth,
  type SchedulableTask,
} from './scheduler.js';

const calendar = createCalendar([0, 6]);

function task(partial: Partial<SchedulableTask> & { id: string }): SchedulableTask {
  return {
    parentId: null,
    position: 0,
    durationDays: 1,
    startDate: '2026-10-19',
    ...partial,
  };
}

describe('vektor uji wajib (bagian 6.11)', () => {
  it('mulai Jumat 2026-10-23 durasi 3 berakhir Selasa 2026-10-27', () => {
    const result = computeSchedule(
      [task({ id: 'a', durationDays: 3, startDate: '2026-10-23' })],
      [],
      calendar,
    );
    expect(result.byId.get('a')?.scheduledStart).toBe('2026-10-23');
    expect(result.byId.get('a')?.scheduledEnd).toBe('2026-10-27');
  });

  it('FS lag 0 dari tugas tersebut membuat penerus mulai Rabu 2026-10-28', () => {
    const result = computeSchedule(
      [
        task({ id: 'a', durationDays: 3, startDate: '2026-10-23' }),
        task({ id: 'b', durationDays: 2, startDate: '2026-10-19' }),
      ],
      [{ predecessorId: 'a', successorId: 'b', type: 'FS', lagDays: 0 }],
      calendar,
    );
    expect(result.byId.get('b')?.scheduledStart).toBe('2026-10-28');
    expect(result.byId.get('b')?.scheduledEnd).toBe('2026-10-29');
  });

  it('SS lag 2 dari tugas tersebut membuat penerus mulai Selasa 2026-10-27', () => {
    const result = computeSchedule(
      [
        task({ id: 'a', durationDays: 3, startDate: '2026-10-23' }),
        task({ id: 'b', durationDays: 2, startDate: '2026-10-19' }),
      ],
      [{ predecessorId: 'a', successorId: 'b', type: 'SS', lagDays: 2 }],
      calendar,
    );
    expect(result.byId.get('b')?.scheduledStart).toBe('2026-10-27');
  });

  it('dengan libur Senin 2026-10-26 tugas berakhir Rabu 2026-10-28', () => {
    const holidayCalendar = createCalendar([0, 6], ['2026-10-26']);
    const result = computeSchedule(
      [task({ id: 'a', durationDays: 3, startDate: '2026-10-23' })],
      [],
      holidayCalendar,
    );
    expect(result.byId.get('a')?.scheduledEnd).toBe('2026-10-28');
  });
});

describe('penjadwalan', () => {
  it('memajukan tanggal mulai ke hari kerja', () => {
    const result = computeSchedule([task({ id: 'a', startDate: '2026-10-24' })], [], calendar);
    expect(result.byId.get('a')?.scheduledStart).toBe('2026-10-26');
  });

  it('memakai tanggal paling lambat bila ada beberapa predecessor', () => {
    const result = computeSchedule(
      [
        task({ id: 'a', durationDays: 3, startDate: '2026-10-19' }),
        task({ id: 'b', durationDays: 5, startDate: '2026-10-19' }),
        task({ id: 'c', durationDays: 1, startDate: '2026-10-19' }),
      ],
      [
        { predecessorId: 'a', successorId: 'c', type: 'FS', lagDays: 0 },
        { predecessorId: 'b', successorId: 'c', type: 'FS', lagDays: 0 },
      ],
      calendar,
    );
    expect(result.byId.get('a')?.scheduledEnd).toBe('2026-10-21');
    expect(result.byId.get('b')?.scheduledEnd).toBe('2026-10-23');
    expect(result.byId.get('c')?.scheduledStart).toBe('2026-10-26');
  });

  it('menghitung lag positif dan negatif dalam hari kerja', () => {
    const result = computeSchedule(
      [
        task({ id: 'a', durationDays: 3, startDate: '2026-10-19' }),
        task({ id: 'b', durationDays: 1, startDate: '2026-10-19' }),
      ],
      [{ predecessorId: 'a', successorId: 'b', type: 'FS', lagDays: 2 }],
      calendar,
    );
    // a berakhir 2026-10-21 (Rabu) -> +1 hari kerja + 2 lag = Senin 2026-10-26.
    expect(result.byId.get('b')?.scheduledStart).toBe('2026-10-26');
  });

  it('memperlakukan startDate sebagai batas mulai paling awal', () => {
    const result = computeSchedule(
      [
        task({ id: 'a', durationDays: 1, startDate: '2026-10-19' }),
        task({ id: 'b', durationDays: 1, startDate: '2026-11-02' }),
      ],
      [{ predecessorId: 'a', successorId: 'b', type: 'FS', lagDays: 0 }],
      calendar,
    );
    expect(result.byId.get('b')?.scheduledStart).toBe('2026-11-02');
  });

  it('menggulung jadwal dan progres tugas induk dari anaknya', () => {
    const tasks: SchedulableTask[] = [
      task({ id: 'p', durationDays: 1, startDate: '2026-10-19' }),
      task({ id: 'c1', parentId: 'p', position: 0, durationDays: 5, startDate: '2026-10-19', progress: 100 }),
      task({ id: 'c2', parentId: 'p', position: 1, durationDays: 3, startDate: '2026-10-19', progress: 0 }),
    ];
    const result = computeSchedule(
      tasks,
      [{ predecessorId: 'c1', successorId: 'c2', type: 'FS', lagDays: 0 }],
      calendar,
    );
    const parent = result.byId.get('p');
    expect(parent?.isParent).toBe(true);
    expect(parent?.scheduledStart).toBe('2026-10-19');
    expect(parent?.scheduledEnd).toBe('2026-10-28');
    expect(parent?.durationDays).toBe(8);
    expect(parent?.progress).toBe(63);
  });

  it('menolak siklus dependensi', () => {
    const tasks = [
      task({ id: 'a', startDate: '2026-10-19' }),
      task({ id: 'b', startDate: '2026-10-19' }),
    ];
    const dependencies = [
      { predecessorId: 'a', successorId: 'b', type: 'FS' as const, lagDays: 0 },
      { predecessorId: 'b', successorId: 'a', type: 'FS' as const, lagDays: 0 },
    ];
    expect(detectCycle(dependencies)).not.toBeNull();
    expect(() => computeSchedule(tasks, dependencies, calendar)).toThrow(ScheduleCycleError);
  });
});

describe('hierarki tugas', () => {
  it('menghitung kedalaman dan kedalaman subtree', () => {
    const tasks = [
      task({ id: 'a' }),
      task({ id: 'b', parentId: 'a' }),
      task({ id: 'c', parentId: 'b' }),
    ];
    expect(getTaskDepth(tasks, 'a')).toBe(1);
    expect(getTaskDepth(tasks, 'b')).toBe(2);
    expect(getTaskDepth(tasks, 'c')).toBe(3);
    expect(getSubtreeExtraDepth(tasks, 'a')).toBe(2);
    expect(getSubtreeExtraDepth(tasks, 'c')).toBe(0);
  });
});
