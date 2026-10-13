import { Router } from 'express';
import {
  assignmentCreateSchema,
  assignmentUpdateSchema,
  getParentIds,
  type AssignmentCreateInput,
  type AssignmentUpdateInput,
} from '@gantt/shared';
import { prisma } from '../db.js';
import { requireOwnedAssignment, requireOwnedTask } from '../middleware/access.js';
import { asyncHandler, conflict, notFound, unprocessable } from '../middleware/error.js';
import { currentUserId, requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { toAssignmentDto } from '../services/snapshot.js';

export const assignmentRouter = Router();

assignmentRouter.use(requireAuth);

assignmentRouter.post(
  '/tasks/:id/assignments',
  validateBody(assignmentCreateSchema),
  asyncHandler(async (req, res) => {
    const task = await requireOwnedTask(req.params.id, currentUserId(req));
    const input = req.body as AssignmentCreateInput;

    const projectTasks = await prisma.task.findMany({ where: { projectId: task.projectId } });
    if (getParentIds(projectTasks).has(task.id)) {
      throw unprocessable(
        'ASSIGNMENT_ON_PARENT_TASK',
        'Alokasi anggota hanya boleh diberikan pada tugas daun, bukan tugas induk.',
      );
    }

    const resource = await prisma.resource.findFirst({
      where: { id: input.resourceId, projectId: task.projectId },
    });
    if (!resource) throw notFound('Anggota tim tidak ditemukan pada proyek ini.');

    const duplicate = await prisma.assignment.findFirst({
      where: { taskId: task.id, resourceId: resource.id },
    });
    if (duplicate) {
      throw conflict(
        'ASSIGNMENT_EXISTS',
        'Anggota ini sudah dialokasikan pada tugas tersebut. Silakan ubah persentase alokasinya.',
      );
    }

    const assignment = await prisma.assignment.create({
      data: {
        taskId: task.id,
        resourceId: resource.id,
        allocationPercent: input.allocationPercent ?? 100,
      },
    });
    res.status(201).json({ assignment: toAssignmentDto(assignment) });
  }),
);

assignmentRouter.patch(
  '/assignments/:id',
  validateBody(assignmentUpdateSchema),
  asyncHandler(async (req, res) => {
    const assignment = await requireOwnedAssignment(req.params.id, currentUserId(req));
    const input = req.body as AssignmentUpdateInput;
    const updated = await prisma.assignment.update({
      where: { id: assignment.id },
      data: { allocationPercent: input.allocationPercent },
    });
    res.json({ assignment: toAssignmentDto(updated) });
  }),
);

assignmentRouter.delete(
  '/assignments/:id',
  asyncHandler(async (req, res) => {
    const assignment = await requireOwnedAssignment(req.params.id, currentUserId(req));
    await prisma.assignment.delete({ where: { id: assignment.id } });
    res.status(204).send();
  }),
);
