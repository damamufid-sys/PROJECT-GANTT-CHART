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
let task: TaskDto;

beforeAll(async () => {
  const user: TestUser = await registerUser(app);
  token = user.token;
  project = await createProject(app, token, { name: 'Proyek Kalender' });
  task = await createTask(app, token, project.id, {
    name: 'Tugas Kalender',
    durationDays: 5,
    startDate: '2026-10-19',
  });
});

describe('kalender proyek', () => {
  it('durasi tidak menghitung akhir pekan', async () => {
    expect(task.scheduledStart).toBe('2026-10-19');
    expect(task.scheduledEnd).toBe('2026-10-23');
  });

  it('menggeser jadwal saat akhir pekan diubah', async () => {
    const response = await request(app)
      .put(`/api/projects/${project.id}/calendar`)
      .set(authHeader(token))
      .send({ weekendDays: [0, 5, 6] })
      .expect(200);

    expect(response.body.project.weekendDays).toBe('0,5,6');
    const updated = findTask(response.body.tasks as TaskDto[], 'Tugas Kalender');
    // Jumat menjadi hari libur -> 5 hari kerja dari Senin 19 berakhir Senin 26.
    expect(updated.scheduledEnd).toBe('2026-10-26');
  });

  it('menggeser jadwal saat hari libur ditambahkan', async () => {
    const response = await request(app)
      .post(`/api/projects/${project.id}/holidays`)
      .set(authHeader(token))
      .send({ date: '2026-10-20', name: 'Cuti bersama' })
      .expect(201);

    const updated = findTask(response.body.tasks as TaskDto[], 'Tugas Kalender');
    expect(updated.scheduledEnd).toBe('2026-10-27');
    expect(response.body.holiday.date).toBe('2026-10-20');
  });

  it('menolak hari libur duplikat', async () => {
    const response = await request(app)
      .post(`/api/projects/${project.id}/holidays`)
      .set(authHeader(token))
      .send({ date: '2026-10-20', name: 'Duplikat' })
      .expect(409);
    expect(response.body.error.code).toBe('HOLIDAY_EXISTS');
  });

  it('menolak akhir pekan yang berisi ketujuh hari', async () => {
    const response = await request(app)
      .put(`/api/projects/${project.id}/calendar`)
      .set(authHeader(token))
      .send({ weekendDays: [0, 1, 2, 3, 4, 5, 6] })
      .expect(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('mengembalikan jadwal setelah hari libur dihapus dan akhir pekan dikembalikan', async () => {
    const holidays = await request(app)
      .get(`/api/projects/${project.id}`)
      .set(authHeader(token))
      .expect(200);
    const holidayId = holidays.body.holidays[0].id as string;

    await request(app).delete(`/api/holidays/${holidayId}`).set(authHeader(token)).expect(200);
    const response = await request(app)
      .put(`/api/projects/${project.id}/calendar`)
      .set(authHeader(token))
      .send({ weekendDays: [0, 6] })
      .expect(200);

    const updated = findTask(response.body.tasks as TaskDto[], 'Tugas Kalender');
    expect(updated.scheduledEnd).toBe('2026-10-23');
  });

  it('menolak akses kalender proyek milik pengguna lain', async () => {
    const other = await registerUser(app);
    await request(app)
      .put(`/api/projects/${project.id}/calendar`)
      .set(authHeader(other.token))
      .send({ weekendDays: [0, 6] })
      .expect(404);
  });
});
