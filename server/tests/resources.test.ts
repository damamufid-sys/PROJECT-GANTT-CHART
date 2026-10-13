import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { ProjectDto, TaskDto } from '@gantt/shared';
import {
  authHeader,
  createProject,
  createResource,
  createTask,
  makeApp,
  registerUser,
  uniqueEmail,
  type TestUser,
} from './helpers.js';

const app = makeApp();
let token: string;
let project: ProjectDto;

beforeAll(async () => {
  const user: TestUser = await registerUser(app);
  token = user.token;
  project = await createProject(app, token, { name: 'Proyek Tim' });
});

describe('anggota tim', () => {
  it('menambah, mengubah, menghapus, dan mendaftar anggota', async () => {
    const resource = await createResource(app, token, project.id, {
      name: 'Eka Wulandari',
      role: 'Business Analyst',
      salary: 11_000_000,
    });
    expect(resource.name).toBe('Eka Wulandari');
    expect(resource.salary).toBe(11_000_000);

    const list = await request(app)
      .get(`/api/projects/${project.id}/resources`)
      .set(authHeader(token))
      .expect(200);
    expect(list.body.resources).toHaveLength(1);

    const patched = await request(app)
      .patch(`/api/resources/${resource.id}`)
      .set(authHeader(token))
      .send({ role: 'Product Owner', salary: 12_500_000 })
      .expect(200);
    expect(patched.body.resource.role).toBe('Product Owner');
    expect(patched.body.resource.salary).toBe(12_500_000);

    await request(app).delete(`/api/resources/${resource.id}`).set(authHeader(token)).expect(204);
    const afterDelete = await request(app)
      .get(`/api/projects/${project.id}/resources`)
      .set(authHeader(token))
      .expect(200);
    expect(afterDelete.body.resources).toHaveLength(0);
  });

  it('menolak gaji negatif dan email tidak valid', async () => {
    await request(app)
      .post(`/api/projects/${project.id}/resources`)
      .set(authHeader(token))
      .send({ name: 'Salah', email: 'bukan-email', role: 'QA', salary: -1 })
      .expect(400);
  });

  it('menolak akses anggota milik pengguna lain', async () => {
    const other = await registerUser(app);
    const otherProject = await createProject(app, other.token);
    const resource = await createResource(app, other.token, otherProject.id);

    await request(app).patch(`/api/resources/${resource.id}`).set(authHeader(token)).send({ salary: 1 }).expect(404);
    await request(app).delete(`/api/resources/${resource.id}`).set(authHeader(token)).expect(404);
  });
});

describe('alokasi anggota ke tugas', () => {
  it('mengalokasikan anggota, mengubah persentase, dan menghapusnya', async () => {
    const resource = await createResource(app, token, project.id, { name: 'Fajar Nugroho' });
    const task = await createTask(app, token, project.id, { name: 'Tugas Alokasi', durationDays: 3 });

    const created = await request(app)
      .post(`/api/tasks/${task.id}/assignments`)
      .set(authHeader(token))
      .send({ resourceId: resource.id, allocationPercent: 50 })
      .expect(201);
    expect(created.body.assignment.allocationPercent).toBe(50);

    const duplicate = await request(app)
      .post(`/api/tasks/${task.id}/assignments`)
      .set(authHeader(token))
      .send({ resourceId: resource.id, allocationPercent: 50 })
      .expect(409);
    expect(duplicate.body.error.code).toBe('ASSIGNMENT_EXISTS');

    const patched = await request(app)
      .patch(`/api/assignments/${created.body.assignment.id}`)
      .set(authHeader(token))
      .send({ allocationPercent: 80 })
      .expect(200);
    expect(patched.body.assignment.allocationPercent).toBe(80);

    await request(app)
      .delete(`/api/assignments/${created.body.assignment.id}`)
      .set(authHeader(token))
      .expect(204);
  });

  it('menolak alokasi pada tugas induk', async () => {
    const resource = await createResource(app, token, project.id, { name: 'Gita Pramesti' });
    const parent = await createTask(app, token, project.id, { name: 'Induk Alokasi', durationDays: 1 });
    await createTask(app, token, project.id, {
      name: 'Anak Alokasi',
      durationDays: 2,
      parentId: parent.id,
    });

    const response = await request(app)
      .post(`/api/tasks/${parent.id}/assignments`)
      .set(authHeader(token))
      .send({ resourceId: resource.id, allocationPercent: 100 })
      .expect(422);
    expect(response.body.error.code).toBe('ASSIGNMENT_ON_PARENT_TASK');
  });

  it('menolak anggota dari proyek lain', async () => {
    const other = await registerUser(app);
    const otherProject = await createProject(app, other.token);
    const foreignResource = await createResource(app, other.token, otherProject.id, {
      email: uniqueEmail('asing'),
    });
    const task = await createTask(app, token, project.id, { name: 'Tugas Asing', durationDays: 2 });

    await request(app)
      .post(`/api/tasks/${task.id}/assignments`)
      .set(authHeader(token))
      .send({ resourceId: foreignResource.id, allocationPercent: 100 })
      .expect(404);
  });

  it('menolak alokasi di luar 1-100 persen', async () => {
    const resource = await createResource(app, token, project.id, { name: 'Hesti Rahayu' });
    const task = await createTask(app, token, project.id, { name: 'Tugas Persen', durationDays: 2 });

    await request(app)
      .post(`/api/tasks/${task.id}/assignments`)
      .set(authHeader(token))
      .send({ resourceId: resource.id, allocationPercent: 150 })
      .expect(400);
  });

  it('menghapus alokasi ketika anggota dihapus', async () => {
    const resource = await createResource(app, token, project.id, { name: 'Irfan Maulana' });
    const task = await createTask(app, token, project.id, { name: 'Tugas Hapus Anggota', durationDays: 2 });
    await request(app)
      .post(`/api/tasks/${task.id}/assignments`)
      .set(authHeader(token))
      .send({ resourceId: resource.id, allocationPercent: 100 })
      .expect(201);

    await request(app).delete(`/api/resources/${resource.id}`).set(authHeader(token)).expect(204);

    const snapshot = await request(app)
      .get(`/api/projects/${project.id}`)
      .set(authHeader(token))
      .expect(200);
    const remaining = (snapshot.body.assignments as Array<{ resourceId: string }>).filter(
      (assignment) => assignment.resourceId === resource.id,
    );
    expect(remaining).toHaveLength(0);
  });
});

describe('snapshot proyek', () => {
  it('mengembalikan proyek, tugas, dependensi, anggota, alokasi, dan hari libur', async () => {
    const snapshot = await request(app)
      .get(`/api/projects/${project.id}`)
      .set(authHeader(token))
      .expect(200);
    expect(snapshot.body.project.id).toBe(project.id);
    expect(Array.isArray(snapshot.body.tasks)).toBe(true);
    expect(Array.isArray(snapshot.body.dependencies)).toBe(true);
    expect(Array.isArray(snapshot.body.resources)).toBe(true);
    expect(Array.isArray(snapshot.body.assignments)).toBe(true);
    expect(Array.isArray(snapshot.body.holidays)).toBe(true);
    expect((snapshot.body.tasks as TaskDto[]).length).toBeGreaterThan(0);
  });
});
