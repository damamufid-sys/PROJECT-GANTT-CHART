import {
  buildPertNetwork,
  computeCpm,
  computeSchedule,
  createCalendar,
  type AnalysisResult,
  type DependencyDto,
  type HolidayDto,
  type PertNetwork,
  type ProjectDto,
  type ProjectSnapshot,
  type TaskDto,
} from '@gantt/shared';

interface FixtureChild {
  key: string;
  name: string;
  duration: number;
  deps: Array<{ from: string; type: 'FS' | 'SS'; lag: number }>;
}

const GROUPS: Array<{ key: string; name: string; color: string; children: FixtureChild[] }> = [
  {
    key: 'g1',
    name: 'Perencanaan',
    color: '#2563eb',
    children: [
      { key: '1.1', name: 'Kickoff dan kebutuhan', duration: 3, deps: [] },
      {
        key: '1.2',
        name: 'Penyusunan spesifikasi',
        duration: 4,
        deps: [{ from: '1.1', type: 'FS', lag: 0 }],
      },
    ],
  },
  {
    key: 'g2',
    name: 'Desain',
    color: '#7c3aed',
    children: [
      {
        key: '2.1',
        name: 'Riset dan wireframe',
        duration: 5,
        deps: [{ from: '1.2', type: 'SS', lag: 2 }],
      },
      {
        key: '2.2',
        name: 'Desain UI high-fidelity',
        duration: 6,
        deps: [{ from: '2.1', type: 'FS', lag: 0 }],
      },
    ],
  },
  {
    key: 'g3',
    name: 'Pengembangan',
    color: '#059669',
    children: [
      {
        key: '3.1',
        name: 'Rancang database dan API',
        duration: 5,
        deps: [{ from: '1.2', type: 'FS', lag: 0 }],
      },
      {
        key: '3.2',
        name: 'Implementasi backend',
        duration: 10,
        deps: [{ from: '3.1', type: 'FS', lag: 0 }],
      },
      {
        key: '3.3',
        name: 'Implementasi frontend mobile',
        duration: 12,
        deps: [
          { from: '2.2', type: 'FS', lag: 0 },
          { from: '3.2', type: 'SS', lag: 3 },
        ],
      },
    ],
  },
  {
    key: 'g4',
    name: 'Pengujian',
    color: '#d97706',
    children: [
      { key: '4.1', name: 'Skenario uji', duration: 3, deps: [{ from: '3.2', type: 'SS', lag: 4 }] },
      {
        key: '4.2',
        name: 'Integrasi dan uji sistem',
        duration: 6,
        deps: [
          { from: '3.2', type: 'FS', lag: 0 },
          { from: '3.3', type: 'FS', lag: 0 },
        ],
      },
      { key: '4.3', name: 'Perbaikan bug', duration: 4, deps: [{ from: '4.2', type: 'FS', lag: 0 }] },
    ],
  },
  {
    key: 'g5',
    name: 'Peluncuran',
    color: '#dc2626',
    children: [
      {
        key: '5.1',
        name: 'Persiapan rilis',
        duration: 2,
        deps: [{ from: '4.3', type: 'FS', lag: 1 }],
      },
      {
        key: '5.2',
        name: 'Rilis dan serah terima',
        duration: 1,
        deps: [{ from: '5.1', type: 'FS', lag: 0 }],
      },
    ],
  },
];

export const FIXTURE_START_DATE = '2026-10-19';
export const FIXTURE_WEEKEND_DAYS = '0,6';
export const FIXTURE_HOLIDAYS: HolidayDto[] = [
  { id: 'holiday-1', projectId: 'project-1', date: '2026-11-11', name: 'Libur internal (contoh)' },
  { id: 'holiday-2', projectId: 'project-1', date: '2026-12-25', name: 'Hari Raya Natal' },
];

export interface SnapshotFixture {
  snapshot: ProjectSnapshot;
  calendar: ReturnType<typeof createCalendar>;
}

/** Membangun data proyek menyerupai hasil seed untuk pengujian komponen. */
export function buildSnapshotFixture(): SnapshotFixture {
  const calendar = createCalendar(
    FIXTURE_WEEKEND_DAYS,
    FIXTURE_HOLIDAYS.map((holiday) => holiday.date),
  );

  const tasks: TaskDto[] = GROUPS.map((group, index) => ({
    id: group.key,
    projectId: 'project-1',
    parentId: null,
    position: index,
    name: group.name,
    description: null,
    durationDays: 1,
    startDate: FIXTURE_START_DATE,
    scheduledStart: FIXTURE_START_DATE,
    scheduledEnd: FIXTURE_START_DATE,
    priority: 'MEDIUM',
    color: group.color,
    progress: 0,
    optimisticDays: null,
    pessimisticDays: null,
  }));

  for (const group of GROUPS) {
    group.children.forEach((child, index) => {
      tasks.push({
        id: child.key,
        projectId: 'project-1',
        parentId: group.key,
        position: index,
        name: child.name,
        description: null,
        durationDays: child.duration,
        startDate: FIXTURE_START_DATE,
        scheduledStart: FIXTURE_START_DATE,
        scheduledEnd: FIXTURE_START_DATE,
        priority: 'MEDIUM',
        color: group.color,
        progress: child.key === '1.1' ? 100 : child.key === '1.2' ? 60 : 0,
        optimisticDays: child.key === '3.2' ? 8 : null,
        pessimisticDays: child.key === '3.2' ? 15 : null,
      });
    });
  }

  const dependencyInputs = GROUPS.flatMap((group) =>
    group.children.flatMap((child) =>
      child.deps.map((dependency) => ({
        predecessorId: dependency.from,
        successorId: child.key,
        type: dependency.type,
        lagDays: dependency.lag,
      })),
    ),
  );

  const schedule = computeSchedule(
    tasks.map((task) => ({
      id: task.id,
      parentId: task.parentId,
      position: task.position,
      durationDays: task.durationDays,
      startDate: task.startDate,
      progress: task.progress,
    })),
    dependencyInputs,
    calendar,
  );

  const scheduledTasks = tasks.map((task) => {
    const scheduled = schedule.byId.get(task.id);
    return scheduled
      ? {
          ...task,
          scheduledStart: scheduled.scheduledStart,
          scheduledEnd: scheduled.scheduledEnd,
          durationDays: scheduled.durationDays,
          progress: scheduled.progress,
        }
      : task;
  });

  const dependencies: DependencyDto[] = dependencyInputs.map((dependency, index) => ({
    id: `dep-${index + 1}`,
    predecessorId: dependency.predecessorId,
    successorId: dependency.successorId,
    type: dependency.type,
    lagDays: dependency.lagDays,
  }));

  const project: ProjectDto = {
    id: 'project-1',
    ownerId: 'user-1',
    name: 'Pengembangan Aplikasi Mobile Toko Online',
    description: 'Contoh proyek',
    startDate: FIXTURE_START_DATE,
    weekendDays: FIXTURE_WEEKEND_DAYS,
    createdAt: '2026-10-01T00:00:00.000Z',
  };

  return {
    calendar,
    snapshot: {
      project,
      tasks: scheduledTasks,
      dependencies,
      resources: [],
      assignments: [],
      holidays: FIXTURE_HOLIDAYS,
    },
  };
}

export interface AnalysisFixture {
  analysis: AnalysisResult;
  pert: PertNetwork;
}

/** Analisis dari data fixture (CPM + PERT + biaya kosong). */
export function buildAnalysisFixture(): AnalysisFixture {
  const { snapshot, calendar } = buildSnapshotFixture();
  const cpm = computeCpm(
    snapshot.tasks.map((task) => ({
      id: task.id,
      name: task.name,
      parentId: task.parentId,
      durationDays: task.durationDays,
      scheduledStart: task.scheduledStart,
      scheduledEnd: task.scheduledEnd,
    })),
    snapshot.dependencies,
    calendar,
    FIXTURE_START_DATE,
  );
  const pert = buildPertNetwork(
    snapshot.tasks.map((task) => ({
      id: task.id,
      name: task.name,
      optimisticDays: task.optimisticDays,
      pessimisticDays: task.pessimisticDays,
    })),
    snapshot.dependencies,
    cpm,
  );

  return {
    pert,
    analysis: {
      summary: {
        startDate: cpm.projectStartDate,
        endDate: cpm.projectEndDate,
        totalWorkingDays: cpm.totalWorkingDays,
        totalCost: 0,
        totalTasks: cpm.tasks.length,
        criticalTaskCount: cpm.criticalTasks.length,
      },
      cpm: cpm.tasks,
      criticalPaths: cpm.criticalPaths,
      criticalPathNames: cpm.criticalPaths.map((path) =>
        path.map((id) => cpm.byId.get(id)?.name ?? id),
      ),
      pert,
      costs: { total: 0, tasks: [], resources: [] },
      overallocations: [],
    },
  };
}
