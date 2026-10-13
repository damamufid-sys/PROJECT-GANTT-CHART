import type { TaskDto } from '@gantt/shared';
import { computeSchedule, createCalendar } from '@gantt/shared';
import { prisma } from '../db.js';
import { toTaskDto } from './snapshot.js';

/**
 * Menghitung ulang jadwal seluruh tugas proyek lalu menyimpannya.
 * Dipakai setiap kali tugas, dependensi, durasi, atau kalender berubah.
 */
export async function recomputeProject(projectId: string): Promise<TaskDto[]> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { tasks: true, holidays: true },
  });
  if (!project) return [];

  const dependencies = await prisma.dependency.findMany({
    where: { predecessor: { projectId } },
  });

  const calendar = createCalendar(
    project.weekendDays,
    project.holidays.map((holiday) => holiday.date),
  );

  const schedule = computeSchedule(
    project.tasks.map((task) => ({
      id: task.id,
      parentId: task.parentId,
      position: task.position,
      durationDays: task.durationDays,
      startDate: task.startDate,
      progress: task.progress,
    })),
    dependencies.map((dependency) => ({
      predecessorId: dependency.predecessorId,
      successorId: dependency.successorId,
      type: dependency.type === 'SS' ? ('SS' as const) : ('FS' as const),
      lagDays: dependency.lagDays,
    })),
    calendar,
  );

  const updates = schedule.tasks
    .filter((task) => {
      const stored = project.tasks.find((item) => item.id === task.id);
      if (!stored) return false;
      return (
        stored.scheduledStart !== task.scheduledStart ||
        stored.scheduledEnd !== task.scheduledEnd ||
        stored.durationDays !== task.durationDays ||
        stored.progress !== task.progress
      );
    })
    .map((task) =>
      prisma.task.update({
        where: { id: task.id },
        data: {
          scheduledStart: task.scheduledStart,
          scheduledEnd: task.scheduledEnd,
          durationDays: task.durationDays,
          progress: task.progress,
        },
      }),
    );

  if (updates.length > 0) {
    await prisma.$transaction(updates);
  }

  return listProjectTasks(projectId);
}

/** Daftar tugas proyek yang sudah dalam bentuk DTO. */
export async function listProjectTasks(projectId: string): Promise<TaskDto[]> {
  const tasks = await prisma.task.findMany({
    where: { projectId },
    orderBy: [{ position: 'asc' }],
  });
  return tasks.map(toTaskDto);
}
