import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { ProjectDto, TaskDto } from '@gantt/shared';
import {
  authHeader,
  createProject,
  createTask,
  findTask,
  makeApp,
  registerUser,
  type TestUser,
} from './helpers.js';

const app = makeApp();
let token: string;
let project: ProjectDto;

beforeAll(async () => {
  const user: TestUser = await registerUser(app);
  token = user.token;
  project = await createProject(app, token, { name: 'Proyek Tugas' });
});

describe('CRUD tugas', () => {
  it('menambah, mengubah, dan menghapus tugas', async () => {
    const created = await createTask(app, token, project.id, {
      name: 'Tugas A',
      durationDays: 4,
      priority: 'HIGH',
      color: '#ff0000',
      startDate: '2026-10-19',
    });
    expect(created.name).toBe('Tugas A');
    expect(created.scheduledStart).toBe('2026-10-19');
    expect(created.scheduledEnd).toBe('2026-10-22');

    const patched = await request(app)
      .patch(`/api/tasks/${created.id}`)
      .set(authHeader(token))
      .send({ name: 'Tugas A Revisi', durationDays: 2, priority: 'LOW', color: '#00ff00', progress: 50 })
      .expect(200);

    const updated = findTask(patched.body.tasks as TaskDto[], 'Tugas A Revisi');
    expect(updated.durationDays).toBe(2);
    expect(updated.priority).toBe('LOW');
    expect(updated.color).toBe('#00ff00');
    expect(updated.progress).toBe(50);
    expect(updated.scheduledEnd).toBe('2026-10-20');

    const deleted = await request(app)
      .delete(`/api/tasks/${created.id}`)
      .set(authHeader(token))
      .expect(200);
    expect((deleted.body.tasks as TaskDto[]).some((task) => task.id === created.id)).toBe(false);
  });

  it('menyimpan durasi, tanggal mulai, prioritas, dan warna', async () => {
    const created = await createTask(app, token, project.id, {
      name: 'Tugas Tersimpan',
      durationDays: 7,
      startDate: '2026-11-02',
      priority: 'MEDIUM',
      color: '#123456',
      progress: 25,
    });
    const snapshot = await request(app)
      .get(`/api/projects/${project.id}`)
      .set(authHeader(token))
      .expect(200);
    const stored = findTask(snapshot.body.tasks as TaskDto[], 'Tugas Tersimpan');
    expect(stored).toMatchObject({
      id: created.id,
      durationDays: 7,
      startDate: '2026-11-02',
      priority: 'MEDIUM',
      color: '#123456',
      progress: 25,
    });
  });

  it('menolak durasi nol dan warna yang tidak valid', async () => {
    await request(app)
      .post(`/api/projects/${project.id}/tasks`)
      .set(authHeader(token))
      .send({ name: 'Salah', durationDays: 0, startDate: '2026-10-19' })
      .expect(400);

    await request(app)
      .post(`/api/projects/${project.id}/tasks`)
      .set(authHeader(token))
      .send({ name: 'Salah', durationDays: 1, startDate: '2026-10-19', color: 'merah' })
      .expect(400);
  });
});

describe('sub-tugas', () => {
  it('membuat parent-child dan menggulung rentang serta progres induk', async () => {
    const parent = await createTask(app, token, project.id, {
      name: 'Induk Roll-up',
      durationDays: 1,
      startDate: '2026-10-19',
      priority: 'MEDIUM',
    });
    const childOne = await createTask(app, token, project.id, {
      name: 'Anak Satu',
      durationDays: 5,
      startDate: '2026-10-19',
      parentId: parent.id,
      progress: 100,
    });
    const childTwo = await createTask(app, token, project.id, {
      name: 'Anak Dua',
      durationDays: 3,
      startDate: '2026-10-19',
      parentId: parent.id,
      progress: 0,
    });

    await request(app)
      .post(`/api/tasks/${childTwo.id}/dependencies`)
      .set(authHeader(token))
      .send({ predecessorId: childOne.id, type: 'FS', lagDays: 0 })
      .expect(201);

    const snapshot = await request(app)
      .get(`/api/projects/${project.id}`)
      .set(authHeader(token))
      .expect(200);
    const tasks = snapshot.body.tasks as TaskDto[];
    const parentAfter = tasks.find((task) => task.id === parent.id) as TaskDto;
    const secondAfter = tasks.find((task) => task.id === childTwo.id) as TaskDto;

    expect(secondAfter.scheduledStart).toBe('2026-10-26');
    expect(parentAfter.scheduledStart).toBe('2026-10-19');
    expect(parentAfter.scheduledEnd).toBe('2026-10-28');
    expect(parentAfter.durationDays).toBe(8);
    expect(parentAfter.progress).toBe(63);
  });

  it('menolak sub-tugas lebih dari 3 level', async () => {
    const level1 = await createTask(app, token, project.id, {
      name: 'Level 1',
      durationDays: 1,
      parentId: null,
    });
    const level2 = await createTask(app, token, project.id, {
      name: 'Level 2',
      durationDays: 1,
      parentId: level1.id,
    });
    const level3 = await createTask(app, token, project.id, {
      name: 'Level 3',
      durationDays: 1,
      parentId: level2.id,
    });
    const response = await request(app)
      .post(`/api/projects/${project.id}/tasks`)
      .set(authHeader(token))
      .send({ name: 'Level 4', durationDays: 1, startDate: '2026-10-19', parentId: level3.id })
      .expect(422);
    expect(response.body.error.code).toBe('MAX_DEPTH_EXCEEDED');
  });

  it('membuat kolom yang dihitung otomatis read-only untuk tugas induk', async () => {
    const parent = await createTask(app, token, project.id, {
      name: 'Induk Read Only',
      durationDays: 1,
    });
    await createTask(app, token, project.id, {
      name: 'Anak dari Induk Read Only',
      durationDays: 2,
      parentId: parent.id,
    });

    const response = await request(app)
      .patch(`/api/tasks/${parent.id}`)
      .set(authHeader(token))
      .send({ durationDays: 9 })
      .expect(409);
    expect(response.body.error.code).toBe('PARENT_TASK_READ_ONLY');

    await request(app)
      .patch(`/api/tasks/${parent.id}`)
      .set(authHeader(token))
      .send({ name: 'Induk Diubah', priority: 'HIGH' })
      .expect(200);
  });

  it('menolak memberi anak pada tugas yang sudah punya dependensi', async () => {
    const predecessor = await createTask(app, token, project.id, { name: 'Pred Anak', durationDays: 2 });
    const successor = await createTask(app, token, project.id, { name: 'Succ Anak', durationDays: 2 });
    await request(app)
      .post(`/api/tasks/${successor.id}/dependencies`)
      .set(authHeader(token))
      .send({ predecessorId: predecessor.id, type: 'FS', lagDays: 0 })
      .expect(201);

    const response = await request(app)
      .post(`/api/projects/${project.id}/tasks`)
      .set(authHeader(token))
      .send({ name: 'Anak Terlarang', durationDays: 1, startDate: '2026-10-19', parentId: successor.id })
      .expect(409);
    expect(response.body.error.code).toBe('PARENT_HAS_RELATIONS');
  });

  it('menghapus tugas beserta anak dan dependensinya', async () => {
    const parent = await createTask(app, token, project.id, { name: 'Induk Dihapus', durationDays: 1 });
    const child = await createTask(app, token, project.id, {
      name: 'Anak Dihapus',
      durationDays: 2,
      parentId: parent.id,
    });
    const other = await createTask(app, token, project.id, { name: 'Tugas Lain', durationDays: 2 });
    await request(app)
      .post(`/api/tasks/${other.id}/dependencies`)
      .set(authHeader(token))
      .send({ predecessorId: child.id, type: 'FS', lagDays: 0 })
      .expect(201);

    const response = await request(app)
      .delete(`/api/tasks/${parent.id}`)
      .set(authHeader(token))
      .expect(200);

    const remaining = response.body.tasks as TaskDto[];
    expect(remaining.some((task) => task.id === parent.id)).toBe(false);
    expect(remaining.some((task) => task.id === child.id)).toBe(false);

    const snapshot = await request(app)
      .get(`/api/projects/${project.id}`)
      .set(authHeader(token))
      .expect(200);
    expect(snapshot.body.dependencies.some((dep: { predecessorId: string }) => dep.predecessorId === child.id)).toBe(
      false,
    );
  });
});

describe('memindahkan tugas', () => {
  it('mengubah induk dan urutan tugas', async () => {
    const newParent = await createTask(app, token, project.id, { name: 'Induk Pindah', durationDays: 1 });
    const a = await createTask(app, token, project.id, { name: 'Pindah A', durationDays: 1 });
    const b = await createTask(app, token, project.id, { name: 'Pindah B', durationDays: 1 });
    const moved = await createTask(app, token, project.id, { name: 'Pindah C', durationDays: 1 });

    const response = await request(app)
      .post(`/api/tasks/${moved.id}/move`)
      .set(authHeader(token))
      .send({ parentId: newParent.id, position: 0 })
      .expect(200);

    const tasks = response.body.tasks as TaskDto[];
    const movedAfter = tasks.find((task) => task.id === moved.id) as TaskDto;
    expect(movedAfter.parentId).toBe(newParent.id);
    expect(movedAfter.position).toBe(0);
    expect(tasks.find((task) => task.id === a.id)?.parentId).toBeNull();
    expect(tasks.find((task) => task.id === b.id)?.parentId).toBeNull();
  });

  it('menolak memindahkan tugas ke dalam sub-tugasnya sendiri', async () => {
    const parent = await createTask(app, token, project.id, { name: 'Siklus Hierarki', durationDays: 1 });
    const child = await createTask(app, token, project.id, {
      name: 'Anak Siklus Hierarki',
      durationDays: 1,
      parentId: parent.id,
    });

    const response = await request(app)
      .post(`/api/tasks/${parent.id}/move`)
      .set(authHeader(token))
      .send({ parentId: child.id, position: 0 })
      .expect(422);
    expect(response.body.error.code).toBe('INVALID_PARENT');
  });
});
