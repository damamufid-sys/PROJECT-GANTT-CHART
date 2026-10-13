import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { authHeader, createProject, makeApp, registerUser, uniqueEmail } from './helpers.js';

const app = makeApp();

describe('autentikasi', () => {
  it('mendaftarkan pengguna baru dan mengembalikan token', async () => {
    const email = uniqueEmail();
    const response = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Siti', email, password: 'Password123' })
      .expect(201);

    expect(response.body.token).toBeTypeOf('string');
    expect(response.body.user.email).toBe(email);
    expect(response.body.user).not.toHaveProperty('passwordHash');
    expect(response.body.user).not.toHaveProperty('password');
  });

  it('menolak email yang sudah terdaftar', async () => {
    const email = uniqueEmail();
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Siti', email, password: 'Password123' })
      .expect(201);

    const response = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Siti Lain', email, password: 'Password123' })
      .expect(409);

    expect(response.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('menolak kata sandi kurang dari 8 karakter', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Siti', email: uniqueEmail(), password: 'pendek' })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('login berhasil dan gagal dengan pesan yang jelas', async () => {
    const user = await registerUser(app);

    const ok = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: user.password })
      .expect(200);
    expect(ok.body.token).toBeTypeOf('string');

    const wrong = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'SalahSekali123' })
      .expect(401);
    expect(wrong.body.error.code).toBe('UNAUTHORIZED');
  });

  it('GET /auth/me butuh token', async () => {
    const user = await registerUser(app);
    const me = await request(app).get('/api/auth/me').set(authHeader(user.token)).expect(200);
    expect(me.body.user.id).toBe(user.userId);

    await request(app).get('/api/auth/me').expect(401);
  });

  it('rute proyek menolak request tanpa token', async () => {
    await request(app).get('/api/projects').expect(401);
    await request(app).post('/api/projects').send({ name: 'x', startDate: '2026-10-19' }).expect(401);
  });

  it('pengguna lain tidak bisa melihat atau mengubah data pengguna A', async () => {
    const owner = await registerUser(app);
    const intruder = await registerUser(app);
    const project = await createProject(app, owner.token, { name: 'Proyek Rahasia' });

    await request(app)
      .get(`/api/projects/${project.id}`)
      .set(authHeader(intruder.token))
      .expect(404);

    await request(app)
      .patch(`/api/projects/${project.id}`)
      .set(authHeader(intruder.token))
      .send({ name: 'Diretas' })
      .expect(404);

    await request(app)
      .post(`/api/projects/${project.id}/tasks`)
      .set(authHeader(intruder.token))
      .send({ name: 'Tugas Baru', durationDays: 1, startDate: '2026-10-19' })
      .expect(404);

    await request(app)
      .delete(`/api/projects/${project.id}`)
      .set(authHeader(intruder.token))
      .expect(404);

    const list = await request(app).get('/api/projects').set(authHeader(intruder.token)).expect(200);
    expect(list.body.projects).toHaveLength(0);
  });

  it('GET /health tersedia tanpa token', async () => {
    await request(app).get('/api/health').expect(200);
  });
});
