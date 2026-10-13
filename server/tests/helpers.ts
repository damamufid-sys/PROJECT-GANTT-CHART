import type { Express } from 'express';
import request from 'supertest';
import type { ProjectDto, ResourceDto, TaskDto } from '@gantt/shared';
import { createApp } from '../src/app.js';

let sequence = 0;

export function makeApp(): Express {
  return createApp();
}

export function authHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

export function uniqueEmail(prefix = 'user'): string {
  sequence += 1;
  return `${prefix}${Date.now()}-${sequence}@example.com`;
}

export interface TestUser {
  token: string;
  userId: string;
  email: string;
  password: string;
}

export async function registerUser(app: Express, name = 'Pengguna Uji'): Promise<TestUser> {
  const email = uniqueEmail();
  const password = 'Password123';
  const response = await request(app)
    .post('/api/auth/register')
    .send({ name, email, password })
    .expect(201);
  return { token: response.body.token, userId: response.body.user.id, email, password };
}

export async function createProject(
  app: Express,
  token: string,
  overrides: Partial<{ name: string; startDate: string; weekendDays: number[] }> = {},
): Promise<ProjectDto> {
  const response = await request(app)
    .post('/api/projects')
    .set(authHeader(token))
    .send({
      name: 'Proyek Uji',
      startDate: '2026-10-19',
      ...overrides,
    })
    .expect(201);
  return response.body.project as ProjectDto;
}

export interface CreateTaskOptions {
  name: string;
  durationDays: number;
  startDate?: string;
  parentId?: string | null;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  color?: string;
  progress?: number;
  optimisticDays?: number;
  pessimisticDays?: number;
  position?: number;
}

export async function createTask(
  app: Express,
  token: string,
  projectId: string,
  options: CreateTaskOptions,
): Promise<TaskDto> {
  const response = await request(app)
    .post(`/api/projects/${projectId}/tasks`)
    .set(authHeader(token))
    .send({ startDate: '2026-10-19', ...options })
    .expect(201);
  return response.body.task as TaskDto;
}

export async function createResource(
  app: Express,
  token: string,
  projectId: string,
  overrides: Partial<{ name: string; email: string; role: string; salary: number }> = {},
): Promise<ResourceDto> {
  const response = await request(app)
    .post(`/api/projects/${projectId}/resources`)
    .set(authHeader(token))
    .send({
      name: 'Anggota Uji',
      email: uniqueEmail('anggota'),
      role: 'Developer',
      salary: 10_000_000,
      ...overrides,
    })
    .expect(201);
  return response.body.resource as ResourceDto;
}

export function findTask(tasks: TaskDto[], name: string): TaskDto {
  const task = tasks.find((item) => item.name === name);
  if (!task) throw new Error(`Tugas ${name} tidak ditemukan dalam respons.`);
  return task;
}
