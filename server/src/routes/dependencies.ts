import { Router } from 'express';
import {
  detectCycle,
  getParentIds,
  dependencyCreateSchema,
  dependencyUpdateSchema,
  type DependencyCreateInput,
  type DependencyUpdateInput,
  type DependencyType,
} from '@gantt/shared';
import { prisma } from '../db.js';
import { requireOwnedDependency, requireOwnedTask } from '../middleware/access.js';
import { asyncHandler, notFound, unprocessable } from '../middleware/error.js';
import { currentUserId, requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { recomputeProject } from '../services/recompute.js';
import { toDependencyDto } from '../services/snapshot.js';

export const dependencyRouter = Router();

dependencyRouter.use(requireAuth);

function normalizedType(value: string): DependencyType {
  return value === 'SS' ? 'SS' : 'FS';
}

async function loadProjectDependencies(projectId: string) {
  return prisma.dependency.findMany({ where: { predecessor: { projectId } } });
}

dependencyRouter.post(
  '/tasks/:id/dependencies',
  validateBody(dependencyCreateSchema),
  asyncHandler(async (req, res) => {
    const successor = await requireOwnedTask(req.params.id, currentUserId(req));
    const input = req.body as DependencyCreateInput;

    if (input.predecessorId === successor.id) {
      throw unprocessable(
        'SELF_DEPENDENCY',
        'Sebuah tugas tidak boleh bergantung pada dirinya sendiri.',
      );
    }

    const predecessor = await prisma.task.findFirst({
      where: { id: input.predecessorId, projectId: successor.projectId },
    });
    if (!predecessor) throw notFound('Tugas predecessor tidak ditemukan.');

    const projectTasks = await prisma.task.findMany({ where: { projectId: successor.projectId } });
    const parentIds = getParentIds(projectTasks);
    if (parentIds.has(successor.id) || parentIds.has(predecessor.id)) {
      throw unprocessable(
        'DEPENDENCY_ON_PARENT_TASK',
        'Dependensi hanya boleh ditambahkan pada tugas daun, bukan tugas induk.',
      );
    }

    const duplicate = await prisma.dependency.findFirst({
      where: { predecessorId: input.predecessorId, successorId: successor.id },
    });
    if (duplicate) {
      throw unprocessable('DUPLICATE_DEPENDENCY', 'Dependensi pasangan tugas ini sudah ada.');
    }

    const existing = await loadProjectDependencies(successor.projectId);
    const candidate = {
      predecessorId: input.predecessorId,
      successorId: successor.id,
      type: normalizedType(input.type ?? 'FS'),
      lagDays: input.lagDays ?? 0,
    };
    const cycle = detectCycle([
      ...existing.map((dependency) => ({
        predecessorId: dependency.predecessorId,
        successorId: dependency.successorId,
        type: normalizedType(dependency.type),
        lagDays: dependency.lagDays,
      })),
      candidate,
    ]);
    if (cycle) {
      throw unprocessable(
        'CYCLE_DETECTED',
        `Dependensi ini akan membentuk siklus (${cycle.join(' → ')}) sehingga ditolak.`,
        { cycle },
      );
    }

    const dependency = await prisma.dependency.create({ data: candidate });
    res.status(201).json({
      tasks: await recomputeProject(successor.projectId),
      dependency: toDependencyDto(dependency),
    });
  }),
);

dependencyRouter.patch(
  '/dependencies/:id',
  validateBody(dependencyUpdateSchema),
  asyncHandler(async (req, res) => {
    const dependency = await requireOwnedDependency(req.params.id, currentUserId(req));
    const input = req.body as DependencyUpdateInput;
    const updated = await prisma.dependency.update({
      where: { id: dependency.id },
      data: {
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.lagDays !== undefined ? { lagDays: input.lagDays } : {}),
      },
    });
    const predecessor = await prisma.task.findUniqueOrThrow({
      where: { id: dependency.predecessorId },
    });
    res.json({
      tasks: await recomputeProject(predecessor.projectId),
      dependency: toDependencyDto(updated),
    });
  }),
);

dependencyRouter.delete(
  '/dependencies/:id',
  asyncHandler(async (req, res) => {
    const dependency = await requireOwnedDependency(req.params.id, currentUserId(req));
    const predecessor = await prisma.task.findUniqueOrThrow({
      where: { id: dependency.predecessorId },
    });
    await prisma.dependency.delete({ where: { id: dependency.id } });
    res.json({ tasks: await recomputeProject(predecessor.projectId) });
  }),
);
