import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { AnalysisResult, ProjectDto, TaskDto } from '@gantt/shared';
import {
  authHeader,
  createProject,
  createResource,
  createTask,
  findTask,
  makeApp,
  registerUser,
  type TestUser,
} from './helpers.js';

const app = makeApp();
let token: string;
let project: ProjectDto;
const ids: Record<string, string> = {};

beforeAll(async () => {
  const user: TestUser = await registerUser(app);
  token = user.token;
  project = await createProject(app, token, { name: 'Proyek Analisis' });

  const plan: Array<[string, number]> = [
    ['A', 3],
    ['B', 2],
    ['C', 5],
    ['D', 1],
  ];
  for (const [name, duration] of plan) {
    const task = await createTask(app, token, project.id, {
      name,
      durationDays: duration,
      startDate: '2026-10-19',
    });
    ids[name] = task.id;
  }

  const links: Array<[string, string]> = [
    ['A', 'B'],
    ['A', 'C'],
    ['B', 'D'],
    ['C', 'D'],
  ];
  for (const [predecessor, successor] of links) {
    await request(app)
      .post(`/api/tasks/${ids[successor]}/dependencies`)
      .set(authHeader(token))
      .send({ predecessorId: ids[predecessor], type: 'FS', lagDays: 0 })
      .expect(201);
  }
});

async function fetchAnalysis(): Promise<AnalysisResult> {
  const response = await request(app)
    .get(`/api/projects/${project.id}/analysis`)
    .set(authHeader(token))
    .expect(200);
  return response.body as AnalysisResult;
}

describe('analisis proyek', () => {
  it('menghitung critical path: A, C, D kritis dan B punya float 3', async () => {
    const analysis = await fetchAnalysis();
    const byId = new Map(analysis.cpm.map((task) => [task.id, task]));

    expect(analysis.summary.criticalTaskCount).toBe(3);
    expect(byId.get(ids.A)?.critical).toBe(true);
    expect(byId.get(ids.C)?.critical).toBe(true);
    expect(byId.get(ids.D)?.critical).toBe(true);
    expect(byId.get(ids.B)?.critical).toBe(false);
    expect(byId.get(ids.B)?.totalFloat).toBe(3);
    expect(analysis.criticalPathNames[0]).toEqual(['A', 'C', 'D']);
  });

  it('meringkas tanggal mulai, selesai, dan total hari kerja', async () => {
    const analysis = await fetchAnalysis();
    expect(analysis.summary.startDate).toBe('2026-10-19');
    expect(analysis.summary.endDate).toBe('2026-10-29');
    expect(analysis.summary.totalWorkingDays).toBe(9);
  });

  it('membangun jaringan PERT dengan node kritis bertanda', async () => {
    const analysis = await fetchAnalysis();
    const nodes = analysis.pert.nodes;
    expect(nodes).toHaveLength(4);
    expect(nodes.filter((node) => node.critical)).toHaveLength(3);
    expect(nodes.find((node) => node.id === ids.D)?.column).toBe(2);
    expect(analysis.pert.edges).toHaveLength(4);
    expect(analysis.pert.edges.filter((edge) => edge.critical)).toHaveLength(2);
  });

  it('menghitung biaya proyek dari gaji anggota', async () => {
    const resource = await createResource(app, token, project.id, {
      name: 'Joko Susilo',
      salary: 22_000_000,
    });
    await request(app)
      .post(`/api/tasks/${ids.A}/assignments`)
      .set(authHeader(token))
      .send({ resourceId: resource.id, allocationPercent: 100 })
      .expect(201);

    const analysis = await fetchAnalysis();
    // Tarif harian 1.000.000 x 3 hari kerja = 3.000.000
    expect(analysis.costs.total).toBe(3_000_000);
    expect(analysis.costs.resources[0].totalCost).toBe(3_000_000);
  });

  it('menampilkan peringatan over-alokasi', async () => {
    const resource = await createResource(app, token, project.id, {
      name: 'Kartika Sari',
      salary: 9_000_000,
    });
    const first = await createTask(app, token, project.id, {
      name: 'Over 1',
      durationDays: 2,
      startDate: '2026-10-19',
    });
    const second = await createTask(app, token, project.id, {
      name: 'Over 2',
      durationDays: 2,
      startDate: '2026-10-19',
    });
    for (const task of [first, second]) {
      await request(app)
        .post(`/api/tasks/${task.id}/assignments`)
        .set(authHeader(token))
        .send({ resourceId: resource.id, allocationPercent: 60 })
        .expect(201);
    }

    const analysis = await fetchAnalysis();
    const warnings = analysis.overallocations.filter(
      (warning) => warning.resourceId === resource.id,
    );
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].totalPercent).toBe(120);
  });

  it('menolak analisis proyek milik pengguna lain', async () => {
    const other = await registerUser(app);
    await request(app)
      .get(`/api/projects/${project.id}/analysis`)
      .set(authHeader(other.token))
      .expect(404);
  });

  it('menghitung estimasi PERT bila optimistic dan pessimistic diisi', async () => {
    const estimated = await createTask(app, token, project.id, {
      name: 'Estimasi PERT',
      durationDays: 10,
      optimisticDays: 8,
      pessimisticDays: 15,
    });
    const analysis = await fetchAnalysis();
    const node = analysis.pert.nodes.find((item) => item.id === estimated.id);
    expect(node?.expectedDays).toBeCloseTo(10.5, 2);
    expect(node?.variance).toBeCloseTo(1.3611, 3);
  });
});

describe('konsistensi tugas setelah analisis', () => {
  it('menyimpan jadwal hasil hitung pada database', async () => {
    const snapshot = await request(app)
      .get(`/api/projects/${project.id}`)
      .set(authHeader(token))
      .expect(200);
    const taskD = findTask(snapshot.body.tasks as TaskDto[], 'D');
    expect(taskD.scheduledStart).toBe('2026-10-29');
    expect(taskD.scheduledEnd).toBe('2026-10-29');
  });
});
