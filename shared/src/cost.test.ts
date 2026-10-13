import { describe, expect, it } from 'vitest';
import { createCalendar } from './calendar.js';
import {
  computeResourceCosts,
  computeTaskCost,
  computeTaskCosts,
  dailyRate,
  findOverallocations,
  formatIDR,
  totalProjectCost,
  type CostTask,
} from './cost.js';

const calendar = createCalendar([0, 6]);

const resource = { id: 'r1', name: 'Andi', salary: 22_000_000 };
const otherResource = { id: 'r2', name: 'Budi', salary: 11_000_000 };

describe('biaya', () => {
  it('menghitung tarif harian dari gaji bulanan dibagi 22', () => {
    expect(dailyRate(22_000_000)).toBe(1_000_000);
  });

  it('menghitung biaya tugas menurut durasi dan persentase alokasi', () => {
    const task: CostTask = {
      id: 't1',
      parentId: null,
      durationDays: 5,
      scheduledStart: '2026-10-19',
      scheduledEnd: '2026-10-23',
    };
    expect(computeTaskCost(task, [{ taskId: 't1', resourceId: 'r1', allocationPercent: 100 }], [resource])).toBe(
      5_000_000,
    );
    expect(computeTaskCost(task, [{ taskId: 't1', resourceId: 'r2', allocationPercent: 50 }], [otherResource])).toBe(
      1_250_000,
    );
  });

  it('tidak menghitung biaya tugas induk dua kali', () => {
    const tasks: CostTask[] = [
      { id: 'p', parentId: null, durationDays: 3, scheduledStart: '2026-10-19', scheduledEnd: '2026-10-21' },
      { id: 'c', parentId: 'p', durationDays: 3, scheduledStart: '2026-10-19', scheduledEnd: '2026-10-21' },
    ];
    const assignments = [{ taskId: 'c', resourceId: 'r1', allocationPercent: 100 }];
    expect(computeTaskCosts(tasks, assignments, [resource])).toHaveLength(1);
    expect(totalProjectCost(tasks, assignments, [resource])).toBe(3_000_000);
  });

  it('menghitung total biaya per anggota', () => {
    const tasks: CostTask[] = [
      { id: 't1', parentId: null, durationDays: 2, scheduledStart: '2026-10-19', scheduledEnd: '2026-10-20' },
      { id: 't2', parentId: null, durationDays: 4, scheduledStart: '2026-10-21', scheduledEnd: '2026-10-26' },
    ];
    const assignments = [
      { taskId: 't1', resourceId: 'r1', allocationPercent: 100 },
      { taskId: 't2', resourceId: 'r1', allocationPercent: 50 },
    ];
    const costs = computeResourceCosts(tasks, assignments, [resource]);
    expect(costs[0].totalCost).toBe(2_000_000 + 2_000_000);
    expect(costs[0].totalWorkingDays).toBe(4);
  });

  it('memformat rupiah', () => {
    expect(formatIDR(15_000_000)).toBe('Rp 15.000.000');
    expect(formatIDR(0)).toBe('Rp 0');
  });
});

describe('peringatan over-alokasi', () => {
  it('menandai anggota yang dialokasikan lebih dari 100 persen pada satu hari', () => {
    const tasks: CostTask[] = [
      { id: 't1', parentId: null, durationDays: 2, scheduledStart: '2026-10-19', scheduledEnd: '2026-10-20' },
      { id: 't2', parentId: null, durationDays: 2, scheduledStart: '2026-10-19', scheduledEnd: '2026-10-20' },
    ];
    const assignments = [
      { taskId: 't1', resourceId: 'r1', allocationPercent: 60 },
      { taskId: 't2', resourceId: 'r1', allocationPercent: 60 },
    ];
    const warnings = findOverallocations(tasks, assignments, [resource], calendar);
    expect(warnings).toHaveLength(2);
    expect(warnings[0].totalPercent).toBe(120);
    expect(warnings[0].date).toBe('2026-10-19');
  });

  it('tidak memperingatkan bila masih di bawah 100 persen', () => {
    const tasks: CostTask[] = [
      { id: 't1', parentId: null, durationDays: 2, scheduledStart: '2026-10-19', scheduledEnd: '2026-10-20' },
    ];
    const assignments = [{ taskId: 't1', resourceId: 'r1', allocationPercent: 80 }];
    expect(findOverallocations(tasks, assignments, [resource], calendar)).toHaveLength(0);
  });
});
