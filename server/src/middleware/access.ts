import type {
  Assignment,
  Dependency,
  Holiday,
  Project,
  Resource,
  Task,
} from '@prisma/client';
import { prisma } from '../db.js';
import { notFound } from './error.js';

/**
 * Setiap data dicek kepemilikannya: hanya pemilik proyek yang boleh mengakses.
 * Data milik pengguna lain dibalas 404 agar keberadaannya tidak terbocor.
 */
export async function requireOwnedProject(projectId: string, userId: string): Promise<Project> {
  const project = await prisma.project.findFirst({ where: { id: projectId, ownerId: userId } });
  if (!project) throw notFound('Proyek tidak ditemukan.');
  return project;
}

export async function requireOwnedTask(taskId: string, userId: string): Promise<Task> {
  const task = await prisma.task.findFirst({
    where: { id: taskId, project: { ownerId: userId } },
  });
  if (!task) throw notFound('Tugas tidak ditemukan.');
  return task;
}

export async function requireOwnedDependency(
  dependencyId: string,
  userId: string,
): Promise<Dependency> {
  const dependency = await prisma.dependency.findFirst({
    where: { id: dependencyId, predecessor: { project: { ownerId: userId } } },
  });
  if (!dependency) throw notFound('Dependensi tidak ditemukan.');
  return dependency;
}

export async function requireOwnedResource(
  resourceId: string,
  userId: string,
): Promise<Resource> {
  const resource = await prisma.resource.findFirst({
    where: { id: resourceId, project: { ownerId: userId } },
  });
  if (!resource) throw notFound('Anggota tim tidak ditemukan.');
  return resource;
}

export async function requireOwnedAssignment(
  assignmentId: string,
  userId: string,
): Promise<Assignment> {
  const assignment = await prisma.assignment.findFirst({
    where: { id: assignmentId, task: { project: { ownerId: userId } } },
  });
  if (!assignment) throw notFound('Alokasi tidak ditemukan.');
  return assignment;
}

export async function requireOwnedHoliday(holidayId: string, userId: string): Promise<Holiday> {
  const holiday = await prisma.holiday.findFirst({
    where: { id: holidayId, project: { ownerId: userId } },
  });
  if (!holiday) throw notFound('Hari libur tidak ditemukan.');
  return holiday;
}
