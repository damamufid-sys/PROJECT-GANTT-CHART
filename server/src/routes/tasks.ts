import { Router } from 'express';
import {
  MAX_HIERARCHY_DEPTH,
  getSubtreeExtraDepth,
  getSubtreeIds,
  getTaskDepth,
  taskCreateSchema,
  taskMoveSchema,
  taskUpdateSchema,
  type TaskCreateInput,
  type TaskMoveInput,
  type TaskUpdateInput,
} from '@gantt/shared';
import { prisma } from '../db.js';
import { requireOwnedProject, requireOwnedTask } from '../middleware/access.js';
import { asyncHandler, badRequest, conflict, notFound, unprocessable } from '../middleware/error.js';
import { currentUserId, requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { recomputeProject } from '../services/recompute.js';

export const taskRouter = Router();

taskRouter.use(requireAuth);

const PARENT_READ_ONLY_FIELDS = [
  'durationDays',
  'startDate',
  'progress',
  'optimisticDays',
  'pessimisticDays',
] as const;

async function assertParentCanHostChildren(taskIds: string[]): Promise<void> {
  const [dependencyCount, assignmentCount] = await Promise.all([
    prisma.dependency.count({
      where: { OR: [{ predecessorId: { in: taskIds } }, { successorId: { in: taskIds } }] },
    }),
    prisma.assignment.count({ where: { taskId: { in: taskIds } } }),
  ]);
  if (dependencyCount > 0 || assignmentCount > 0) {
    throw conflict(
      'PARENT_HAS_RELATIONS',
      'Tugas yang sudah punya dependensi atau alokasi tidak boleh dijadikan tugas induk.',
    );
  }
}

taskRouter.post(
  '/projects/:id/tasks',
  validateBody(taskCreateSchema),
  asyncHandler(async (req, res) => {
    const userId = currentUserId(req);
    const project = await requireOwnedProject(req.params.id, userId);
    const input = req.body as TaskCreateInput;
    const tasks = await prisma.task.findMany({ where: { projectId: project.id } });

    const parentId = input.parentId ?? null;
    if (parentId) {
      const parent = tasks.find((task) => task.id === parentId);
      if (!parent) throw notFound('Tugas induk tidak ditemukan.');
      if (getTaskDepth(tasks, parentId) + 1 > MAX_HIERARCHY_DEPTH) {
        throw unprocessable(
          'MAX_DEPTH_EXCEEDED',
          `Kedalaman sub-tugas maksimal ${MAX_HIERARCHY_DEPTH} level.`,
        );
      }
      await assertParentCanHostChildren([parentId]);
    }

    const siblings = tasks.filter((task) => task.parentId === parentId);
    const position =
      input.position ??
      (siblings.length > 0 ? Math.max(...siblings.map((task) => task.position)) + 1 : 0);

    const created = await prisma.task.create({
      data: {
        projectId: project.id,
        parentId,
        position,
        name: input.name,
        description: input.description ?? null,
        durationDays: input.durationDays,
        startDate: input.startDate,
        scheduledStart: input.startDate,
        scheduledEnd: input.startDate,
        priority: input.priority ?? 'MEDIUM',
        color: input.color ?? '#2563eb',
        progress: input.progress ?? 0,
        optimisticDays: input.optimisticDays ?? null,
        pessimisticDays: input.pessimisticDays ?? null,
      },
    });

    const updated = await recomputeProject(project.id);
    res.status(201).json({
      tasks: updated,
      task: updated.find((task) => task.id === created.id) ?? null,
    });
  }),
);

taskRouter.patch(
  '/tasks/:id',
  validateBody(taskUpdateSchema),
  asyncHandler(async (req, res) => {
    const task = await requireOwnedTask(req.params.id, currentUserId(req));
    const input = req.body as TaskUpdateInput;

    const childrenCount = await prisma.task.count({ where: { parentId: task.id } });
    if (childrenCount > 0) {
      const attempted = PARENT_READ_ONLY_FIELDS.filter((field) => input[field] !== undefined);
      if (attempted.length > 0) {
        throw conflict(
          'PARENT_TASK_READ_ONLY',
          'Tugas induk hanya boleh diubah nama, deskripsi, warna, dan prioritasnya.',
        );
      }
    }

    const optimisticDays =
      input.optimisticDays !== undefined ? input.optimisticDays : task.optimisticDays;
    const pessimisticDays =
      input.pessimisticDays !== undefined ? input.pessimisticDays : task.pessimisticDays;
    if (
      typeof optimisticDays === 'number' &&
      typeof pessimisticDays === 'number' &&
      pessimisticDays < optimisticDays
    ) {
      throw badRequest('Estimasi pesimistis tidak boleh lebih kecil dari optimistis.', {
        issues: [{ path: 'pessimisticDays', message: 'Nilai terlalu kecil.' }],
      });
    }

    await prisma.task.update({
      where: { id: task.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description ?? null } : {}),
        ...(input.durationDays !== undefined ? { durationDays: input.durationDays } : {}),
        ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.color !== undefined ? { color: input.color } : {}),
        ...(input.progress !== undefined ? { progress: input.progress } : {}),
        ...(input.optimisticDays !== undefined ? { optimisticDays: input.optimisticDays ?? null } : {}),
        ...(input.pessimisticDays !== undefined
          ? { pessimisticDays: input.pessimisticDays ?? null }
          : {}),
        ...(input.position !== undefined ? { position: input.position } : {}),
      },
    });

    res.json({ tasks: await recomputeProject(task.projectId) });
  }),
);

taskRouter.delete(
  '/tasks/:id',
  asyncHandler(async (req, res) => {
    const task = await requireOwnedTask(req.params.id, currentUserId(req));
    const all = await prisma.task.findMany({ where: { projectId: task.projectId } });
    const subtree = getSubtreeIds(all, task.id);
    const ordered = subtree
      .map((id) => ({ id, depth: getTaskDepth(all, id) }))
      .sort((a, b) => b.depth - a.depth);

    await prisma.$transaction(ordered.map((item) => prisma.task.delete({ where: { id: item.id } })));
    res.json({ tasks: await recomputeProject(task.projectId) });
  }),
);

taskRouter.post(
  '/tasks/:id/move',
  validateBody(taskMoveSchema),
  asyncHandler(async (req, res) => {
    const task = await requireOwnedTask(req.params.id, currentUserId(req));
    const input = req.body as TaskMoveInput;
    const all = await prisma.task.findMany({ where: { projectId: task.projectId } });
    const newParentId = input.parentId ?? null;

    if (newParentId === task.id) {
      throw unprocessable('INVALID_PARENT', 'Tugas tidak bisa dijadikan induk bagi dirinya sendiri.');
    }

    if (newParentId) {
      const newParent = all.find((item) => item.id === newParentId);
      if (!newParent) throw notFound('Tugas induk tidak ditemukan.');
      const subtreeIds = getSubtreeIds(all, task.id);
      if (subtreeIds.includes(newParentId)) {
        throw unprocessable(
          'INVALID_PARENT',
          'Tugas tidak bisa dipindah ke dalam sub-tugasnya sendiri.',
        );
      }
      const depth = getTaskDepth(all, newParentId) + 1 + getSubtreeExtraDepth(all, task.id);
      if (depth > MAX_HIERARCHY_DEPTH) {
        throw unprocessable(
          'MAX_DEPTH_EXCEEDED',
          `Kedalaman sub-tugas maksimal ${MAX_HIERARCHY_DEPTH} level.`,
        );
      }
      await assertParentCanHostChildren([newParentId]);
    }

    const siblings = all
      .filter((item) => item.parentId === newParentId && item.id !== task.id)
      .sort((a, b) => a.position - b.position);
    const index = Math.max(0, Math.min(input.position, siblings.length));
    const orderedIds = [
      ...siblings.slice(0, index).map((item) => item.id),
      task.id,
      ...siblings.slice(index).map((item) => item.id),
    ];

    await prisma.$transaction(
      orderedIds.map((id, position) =>
        prisma.task.update({
          where: { id },
          data: id === task.id ? { parentId: newParentId, position } : { position },
        }),
      ),
    );

    res.json({ tasks: await recomputeProject(task.projectId) });
  }),
);