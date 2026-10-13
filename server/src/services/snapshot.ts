import type {
  Assignment as PrismaAssignment,
  Dependency as PrismaDependency,
  Holiday as PrismaHoliday,
  Project as PrismaProject,
  Resource as PrismaResource,
  Task as PrismaTask,
  User as PrismaUser,
} from '@prisma/client';
import type {
  AssignmentDto,
  DependencyDto,
  HolidayDto,
  Priority,
  ProjectDto,
  ProjectSnapshot,
  ResourceDto,
  TaskDto,
  UserDto,
} from '@gantt/shared';
import { prisma } from '../db.js';
import { notFound } from '../middleware/error.js';

const PRIORITIES: Priority[] = ['LOW', 'MEDIUM', 'HIGH'];

export function toPriority(value: string): Priority {
  return PRIORITIES.includes(value as Priority) ? (value as Priority) : 'MEDIUM';
}

export function toUserDto(user: PrismaUser): UserDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
  };
}

export function toProjectDto(project: PrismaProject): ProjectDto {
  return {
    id: project.id,
    ownerId: project.ownerId,
    name: project.name,
    description: project.description,
    startDate: project.startDate,
    weekendDays: project.weekendDays,
    createdAt: project.createdAt.toISOString(),
  };
}

export function toTaskDto(task: PrismaTask): TaskDto {
  return {
    id: task.id,
    projectId: task.projectId,
    parentId: task.parentId,
    position: task.position,
    name: task.name,
    description: task.description,
    durationDays: task.durationDays,
    startDate: task.startDate,
    scheduledStart: task.scheduledStart,
    scheduledEnd: task.scheduledEnd,
    priority: toPriority(task.priority),
    color: task.color,
    progress: task.progress,
    optimisticDays: task.optimisticDays,
    pessimisticDays: task.pessimisticDays,
  };
}

export function toDependencyDto(dependency: PrismaDependency): DependencyDto {
  return {
    id: dependency.id,
    predecessorId: dependency.predecessorId,
    successorId: dependency.successorId,
    type: dependency.type === 'SS' ? 'SS' : 'FS',
    lagDays: dependency.lagDays,
  };
}

export function toResourceDto(resource: PrismaResource): ResourceDto {
  return {
    id: resource.id,
    projectId: resource.projectId,
    name: resource.name,
    email: resource.email,
    role: resource.role,
    salary: resource.salary,
  };
}

export function toAssignmentDto(assignment: PrismaAssignment): AssignmentDto {
  return {
    id: assignment.id,
    taskId: assignment.taskId,
    resourceId: assignment.resourceId,
    allocationPercent: assignment.allocationPercent,
  };
}

export function toHolidayDto(holiday: PrismaHoliday): HolidayDto {
  return {
    id: holiday.id,
    projectId: holiday.projectId,
    date: holiday.date,
    name: holiday.name,
  };
}

/** Snapshot lengkap satu proyek beserta seluruh datanya. */
export async function buildSnapshot(projectId: string): Promise<ProjectSnapshot> {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw notFound('Proyek tidak ditemukan.');

  const [tasks, dependencies, resources, assignments, holidays] = await Promise.all([
    prisma.task.findMany({ where: { projectId }, orderBy: [{ position: 'asc' }] }),
    prisma.dependency.findMany({
      where: { predecessor: { projectId } },
      orderBy: [{ id: 'asc' }],
    }),
    prisma.resource.findMany({ where: { projectId }, orderBy: [{ name: 'asc' }] }),
    prisma.assignment.findMany({ where: { task: { projectId } }, orderBy: [{ id: 'asc' }] }),
    prisma.holiday.findMany({ where: { projectId }, orderBy: [{ date: 'asc' }] }),
  ]);

  return {
    project: toProjectDto(project),
    tasks: tasks.map(toTaskDto),
    dependencies: dependencies.map(toDependencyDto),
    resources: resources.map(toResourceDto),
    assignments: assignments.map(toAssignmentDto),
    holidays: holidays.map(toHolidayDto),
  };
}
