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
  project = await createProject(app, token, {
    name: 'Proyek Vektor 6.11',
    startDate: '2026-10-23',
  });
});

describe('vektor uji 6.11 lewat REST API', () => {
  it('FS lag 0 dan SS lag 2 menggeser bar penerus', async () => {
    const a = await createTask(app, token, project.id, {
      name: 'Vektor A',
      durationDays: 3,
      startDate: '2026-10-23',
    });
    expect(a.scheduledStart).toBe('2026-10-23');
    expect(a.scheduledEnd).toBe('2026-10-27');

    const b = await createTask(app, token, project.id, {
      name: 'Vektor B (FS lag 0)',
      durationDays: 2,
      startDate: '2026-10-23',
    });
    const afterFs = await request(app)
      .post(`/api/tasks/${b.id}/dependencies`)
      .set(authHeader(token))
      .send({ predecessorId: a.id, type: 'FS', lagDays: 0 })
      .expect(201);
    expect(findTask(afterFs.body.tasks as TaskDto[], 'Vektor B (FS lag 0)').scheduledStart).toBe(
      '2026-10-28',
    );

    const c = await createTask(app, token, project.id, {
      name: 'Vektor C (SS lag 2)',
      durationDays: 2,
      startDate: '2026-10-23',
    });
    const afterSs = await request(app)
      .post(`/api/tasks/${c.id}/dependencies`)
      .set(authHeader(token))
      .send({ predecessorId: a.id, type: 'SS', lagDays: 2 })
      .expect(201);
    expect(findTask(afterSs.body.tasks as TaskDto[], 'Vektor C (SS lag 2)').scheduledStart).toBe(
      '2026-10-27',
    );
  });

  it('menyimpan tipe FS dan SS beserta lag', async () => {
    const snapshot = await request(app)
      .get(`/api/projects/${project.id}`)
      .set(authHeader(token))
      .expect(200);
    const fs = snapshot.body.dependencies.find(
      (dep: { type: string; lagDays: number }) => dep.type === 'FS' && dep.lagDays === 0,
    );
    const ss = snapshot.body.dependencies.find(
      (dep: { type: string; lagDays: number }) => dep.type === 'SS' && dep.lagDays === 2,
    );
    expect(fs).toBeTruthy();
    expect(ss).toBeTruthy();
  });
});

describe('validasi dependensi', () => {
  it('menolak dependensi ke diri sendiri', async () => {
    const task = await createTask(app, token, project.id, { name: 'Diri Sendiri', durationDays: 2 });
    const response = await request(app)
      .post(`/api/tasks/${task.id}/dependencies`)
      .set(authHeader(token))
      .send({ predecessorId: task.id, type: 'FS', lagDays: 0 })
      .expect(422);
    expect(response.body.error.code).toBe('SELF_DEPENDENCY');
  });

  it('menolak pasangan dependensi duplikat', async () => {
    const first = await createTask(app, token, project.id, { name: 'Duplikat 1', durationDays: 2 });
    const second = await createTask(app, token, project.id, { name: 'Duplikat 2', durationDays: 2 });
    await request(app)
      .post(`/api/tasks/${second.id}/dependencies`)
      .set(authHeader(token))
      .send({ predecessorId: first.id, type: 'FS', lagDays: 0 })
      .expect(201);

    const response = await request(app)
      .post(`/api/tasks/${second.id}/dependencies`)
      .set(authHeader(token))
      .send({ predecessorId: first.id, type: 'SS', lagDays: 1 })
      .expect(422);
    expect(response.body.error.code).toBe('DUPLICATE_DEPENDENCY');
  });

  it('menolak siklus dependensi dengan kode CYCLE_DETECTED', async () => {
    const one = await createTask(app, token, project.id, { name: 'Siklus 1', durationDays: 2 });
    const two = await createTask(app, token, project.id, { name: 'Siklus 2', durationDays: 2 });
    const three = await createTask(app, token, project.id, { name: 'Siklus 3', durationDays: 2 });

    await request(app)
      .post(`/api/tasks/${two.id}/dependencies`)
      .set(authHeader(token))
      .send({ predecessorId: one.id, type: 'FS', lagDays: 0 })
      .expect(201);
    await request(app)
      .post(`/api/tasks/${three.id}/dependencies`)
      .set(authHeader(token))
      .send({ predecessorId: two.id, type: 'FS', lagDays: 0 })
      .expect(201);

    const response = await request(app)
      .post(`/api/tasks/${one.id}/dependencies`)
      .set(authHeader(token))
      .send({ predecessorId: three.id, type: 'FS', lagDays: 0 })
      .expect(422);
    expect(response.body.error.code).toBe('CYCLE_DETECTED');
    expect(response.body.error.details.cycle).toBeTruthy();
  });

  it('menolak dependensi pada tugas induk', async () => {
    const parent = await createTask(app, token, project.id, { name: 'Induk Dep', durationDays: 1 });
    await createTask(app, token, project.id, {
      name: 'Anak Induk Dep',
      durationDays: 2,
      parentId: parent.id,
    });
    const leaf = await createTask(app, token, project.id, { name: 'Daun Dep', durationDays: 2 });

    const response = await request(app)
      .post(`/api/tasks/${leaf.id}/dependencies`)
      .set(authHeader(token))
      .send({ predecessorId: parent.id, type: 'FS', lagDays: 0 })
      .expect(422);
    expect(response.body.error.code).toBe('DEPENDENCY_ON_PARENT_TASK');
  });

  it('menolak lag di luar rentang -365 sampai 365', async () => {
    const first = await createTask(app, token, project.id, { name: 'Lag 1', durationDays: 2 });
    const second = await createTask(app, token, project.id, { name: 'Lag 2', durationDays: 2 });
    await request(app)
      .post(`/api/tasks/${second.id}/dependencies`)
      .set(authHeader(token))
      .send({ predecessorId: first.id, type: 'FS', lagDays: 400 })
      .expect(400);
  });
});

describe('ubah dan hapus dependensi', () => {
  it('mengubah lag dan menghapus dependensi', async () => {
    const predecessor = await createTask(app, token, project.id, {
      name: 'Ubah Dep Pred',
      durationDays: 3,
      startDate: '2026-10-23',
    });
    const successor = await createTask(app, token, project.id, {
      name: 'Ubah Dep Succ',
      durationDays: 2,
      startDate: '2026-10-23',
    });

    const created = await request(app)
      .post(`/api/tasks/${successor.id}/dependencies`)
      .set(authHeader(token))
      .send({ predecessorId: predecessor.id, type: 'FS', lagDays: 0 })
      .expect(201);
    const dependencyId = created.body.dependency.id as string;
    expect(findTask(created.body.tasks as TaskDto[], 'Ubah Dep Succ').scheduledStart).toBe('2026-10-28');

    const patched = await request(app)
      .patch(`/api/dependencies/${dependencyId}`)
      .set(authHeader(token))
      .send({ lagDays: 2 })
      .expect(200);
    expect(findTask(patched.body.tasks as TaskDto[], 'Ubah Dep Succ').scheduledStart).toBe('2026-10-30');

    const removed = await request(app)
      .delete(`/api/dependencies/${dependencyId}`)
      .set(authHeader(token))
      .expect(200);
    expect(findTask(removed.body.tasks as TaskDto[], 'Ubah Dep Succ').scheduledStart).toBe('2026-10-23');
  });

  it('membalas 404 saat dependensi milik pengguna lain', async () => {
    const other = await registerUser(app);
    const otherProject = await createProject(app, other.token);
    const a = await createTask(app, other.token, otherProject.id, { name: 'Dep Lain A', durationDays: 2 });
    const b = await createTask(app, other.token, otherProject.id, { name: 'Dep Lain B', durationDays: 2 });
    const created = await request(app)
      .post(`/api/tasks/${b.id}/dependencies`)
      .set(authHeader(other.token))
      .send({ predecessorId: a.id, type: 'FS', lagDays: 0 })
      .expect(201);

    await request(app)
      .delete(`/api/dependencies/${created.body.dependency.id}`)
      .set(authHeader(token))
      .expect(404);
  });
});
