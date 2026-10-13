import bcrypt from 'bcryptjs';
import { prisma } from '../src/db.js';
import { recomputeProject } from '../src/services/recompute.js';

type PriorityValue = 'LOW' | 'MEDIUM' | 'HIGH';
type DependencyKind = 'FS' | 'SS';

interface SeedAssignment {
  resource: string;
  percent: number;
}

interface SeedTask {
  key: string;
  name: string;
  durationDays: number;
  priority: PriorityValue;
  progress: number;
  assignments: SeedAssignment[];
  optimisticDays?: number;
  pessimisticDays?: number;
  dependencies?: Array<{ from: string; type: DependencyKind; lagDays: number }>;
}

interface SeedGroup {
  name: string;
  color: string;
  children: SeedTask[];
}

const DEMO_EMAIL = 'demo@example.com';
const DEMO_PASSWORD = 'Demo12345';
const PROJECT_NAME = 'Pengembangan Aplikasi Mobile Toko Online';

const RESOURCES = [
  { name: 'Andi Pratama', email: 'andi.pratama@example.com', role: 'Project Manager', salary: 15_000_000 },
  { name: 'Budi Santoso', email: 'budi.santoso@example.com', role: 'Backend Developer', salary: 12_000_000 },
  { name: 'Citra Lestari', email: 'citra.lestari@example.com', role: 'UI/UX Designer', salary: 10_000_000 },
  { name: 'Dewi Anggraini', email: 'dewi.angraini@example.com', role: 'QA Engineer', salary: 9_000_000 },
];

const GROUPS: SeedGroup[] = [
  {
    name: 'Perencanaan',
    color: '#2563eb',
    children: [
      {
        key: '1.1',
        name: 'Kickoff dan kebutuhan',
        durationDays: 3,
        priority: 'HIGH',
        progress: 100,
        assignments: [{ resource: 'Andi Pratama', percent: 100 }],
      },
      {
        key: '1.2',
        name: 'Penyusunan spesifikasi',
        durationDays: 4,
        priority: 'HIGH',
        progress: 60,
        assignments: [{ resource: 'Andi Pratama', percent: 100 }],
        dependencies: [{ from: '1.1', type: 'FS', lagDays: 0 }],
      },
    ],
  },
  {
    name: 'Desain',
    color: '#7c3aed',
    children: [
      {
        key: '2.1',
        name: 'Riset dan wireframe',
        durationDays: 5,
        priority: 'MEDIUM',
        progress: 0,
        assignments: [{ resource: 'Citra Lestari', percent: 100 }],
        dependencies: [{ from: '1.2', type: 'SS', lagDays: 2 }],
      },
      {
        key: '2.2',
        name: 'Desain UI high-fidelity',
        durationDays: 6,
        priority: 'MEDIUM',
        progress: 0,
        assignments: [{ resource: 'Citra Lestari', percent: 100 }],
        dependencies: [{ from: '2.1', type: 'FS', lagDays: 0 }],
      },
    ],
  },
  {
    name: 'Pengembangan',
    color: '#059669',
    children: [
      {
        key: '3.1',
        name: 'Rancang database dan API',
        durationDays: 5,
        priority: 'HIGH',
        progress: 0,
        assignments: [{ resource: 'Budi Santoso', percent: 100 }],
        dependencies: [{ from: '1.2', type: 'FS', lagDays: 0 }],
      },
      {
        key: '3.2',
        name: 'Implementasi backend',
        durationDays: 10,
        priority: 'HIGH',
        progress: 0,
        optimisticDays: 8,
        pessimisticDays: 15,
        assignments: [{ resource: 'Budi Santoso', percent: 100 }],
        dependencies: [{ from: '3.1', type: 'FS', lagDays: 0 }],
      },
      {
        key: '3.3',
        name: 'Implementasi frontend mobile',
        durationDays: 12,
        priority: 'HIGH',
        progress: 0,
        assignments: [
          { resource: 'Budi Santoso', percent: 50 },
          { resource: 'Citra Lestari', percent: 50 },
        ],
        dependencies: [
          { from: '2.2', type: 'FS', lagDays: 0 },
          { from: '3.2', type: 'SS', lagDays: 3 },
        ],
      },
    ],
  },
  {
    name: 'Pengujian',
    color: '#d97706',
    children: [
      {
        key: '4.1',
        name: 'Skenario uji',
        durationDays: 3,
        priority: 'MEDIUM',
        progress: 0,
        assignments: [{ resource: 'Dewi Anggraini', percent: 100 }],
        dependencies: [{ from: '3.2', type: 'SS', lagDays: 4 }],
      },
      {
        key: '4.2',
        name: 'Integrasi dan uji sistem',
        durationDays: 6,
        priority: 'HIGH',
        progress: 0,
        assignments: [{ resource: 'Dewi Anggraini', percent: 100 }],
        dependencies: [
          { from: '3.2', type: 'FS', lagDays: 0 },
          { from: '3.3', type: 'FS', lagDays: 0 },
        ],
      },
      {
        key: '4.3',
        name: 'Perbaikan bug',
        durationDays: 4,
        priority: 'MEDIUM',
        progress: 0,
        assignments: [{ resource: 'Budi Santoso', percent: 100 }],
        dependencies: [{ from: '4.2', type: 'FS', lagDays: 0 }],
      },
    ],
  },
  {
    name: 'Peluncuran',
    color: '#dc2626',
    children: [
      {
        key: '5.1',
        name: 'Persiapan rilis',
        durationDays: 2,
        priority: 'MEDIUM',
        progress: 0,
        assignments: [{ resource: 'Andi Pratama', percent: 100 }],
        dependencies: [{ from: '4.3', type: 'FS', lagDays: 1 }],
      },
      {
        key: '5.2',
        name: 'Rilis dan serah terima',
        durationDays: 1,
        priority: 'HIGH',
        progress: 0,
        assignments: [{ resource: 'Andi Pratama', percent: 100 }],
        dependencies: [{ from: '5.1', type: 'FS', lagDays: 0 }],
      },
    ],
  },
];

const HOLIDAYS = [
  { date: '2026-11-11', name: 'Libur internal (contoh)' },
  { date: '2026-12-25', name: 'Hari Raya Natal' },
];

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { name: 'Demo Pengguna', passwordHash },
    create: { name: 'Demo Pengguna', email: DEMO_EMAIL, passwordHash },
  });

  // Idempoten: hapus proyek demo lama (cascade menghapus semua turunannya).
  await prisma.project.deleteMany({ where: { ownerId: user.id, name: PROJECT_NAME } });

  const project = await prisma.project.create({
    data: {
      ownerId: user.id,
      name: PROJECT_NAME,
      description: 'Contoh proyek pengembangan aplikasi mobile toko online.',
      startDate: '2026-10-19',
      weekendDays: '0,6',
    },
  });

  await prisma.holiday.createMany({
    data: HOLIDAYS.map((holiday) => ({ ...holiday, projectId: project.id })),
  });

  const resourceIds = new Map<string, string>();
  for (const resource of RESOURCES) {
    const created = await prisma.resource.create({
      data: { ...resource, projectId: project.id },
    });
    resourceIds.set(resource.name, created.id);
  }

  const taskIds = new Map<string, string>();
  for (const [groupIndex, group] of GROUPS.entries()) {
    const parent = await prisma.task.create({
      data: {
        projectId: project.id,
        name: group.name,
        position: groupIndex,
        durationDays: 1,
        startDate: project.startDate,
        scheduledStart: project.startDate,
        scheduledEnd: project.startDate,
        priority: 'MEDIUM',
        color: group.color,
        progress: 0,
      },
    });
    taskIds.set(`group-${groupIndex}`, parent.id);

    for (const [childIndex, child] of group.children.entries()) {
      const created = await prisma.task.create({
        data: {
          projectId: project.id,
          parentId: parent.id,
          position: childIndex,
          name: child.name,
          durationDays: child.durationDays,
          startDate: project.startDate,
          scheduledStart: project.startDate,
          scheduledEnd: project.startDate,
          priority: child.priority,
          color: group.color,
          progress: child.progress,
          optimisticDays: child.optimisticDays ?? null,
          pessimisticDays: child.pessimisticDays ?? null,
        },
      });
      taskIds.set(child.key, created.id);
    }
  }

  for (const group of GROUPS) {
    for (const child of group.children) {
      const successorId = taskIds.get(child.key) as string;
      for (const dependency of child.dependencies ?? []) {
        const predecessorId = taskIds.get(dependency.from);
        if (!predecessorId) continue;
        await prisma.dependency.create({
          data: {
            predecessorId,
            successorId,
            type: dependency.type,
            lagDays: dependency.lagDays,
          },
        });
      }
      for (const assignment of child.assignments) {
        const resourceId = resourceIds.get(assignment.resource);
        if (!resourceId) continue;
        await prisma.assignment.create({
          data: { taskId: successorId, resourceId, allocationPercent: assignment.percent },
        });
      }
    }
  }

  await recomputeProject(project.id);

  const [taskCount, dependencyCount, assignmentCount] = await Promise.all([
    prisma.task.count({ where: { projectId: project.id } }),
    prisma.dependency.count({ where: { predecessor: { projectId: project.id } } }),
    prisma.assignment.count({ where: { task: { projectId: project.id } } }),
  ]);

  console.log('[seed] Selesai.');
  console.log(`[seed] Akun demo: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`[seed] Proyek: ${project.name} (${project.id})`);
  console.log(
    `[seed] ${taskCount} tugas, ${dependencyCount} dependensi, ${assignmentCount} alokasi, ${RESOURCES.length} anggota tim.`,
  );
}

main()
  .catch((error) => {
    console.error('[seed] Gagal:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
