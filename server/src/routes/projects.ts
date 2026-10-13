import { Router } from 'express';
import {
  DEFAULT_WEEKEND_DAYS,
  projectCreateSchema,
  projectUpdateSchema,
  weekendDaysToString,
  type ProjectCreateInput,
  type ProjectUpdateInput,
} from '@gantt/shared';
import { prisma } from '../db.js';
import { requireOwnedProject } from '../middleware/access.js';
import { asyncHandler } from '../middleware/error.js';
import { currentUserId, requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { buildSnapshot, toProjectDto } from '../services/snapshot.js';

export const projectRouter = Router();

projectRouter.use(requireAuth);

projectRouter.get(
  '/projects',
  asyncHandler(async (req, res) => {
    const userId = currentUserId(req);
    const projects = await prisma.project.findMany({
      where: { ownerId: userId },
      orderBy: [{ createdAt: 'desc' }],
    });
    res.json({ projects: projects.map(toProjectDto) });
  }),
);

projectRouter.post(
  '/projects',
  validateBody(projectCreateSchema),
  asyncHandler(async (req, res) => {
    const userId = currentUserId(req);
    const input = req.body as ProjectCreateInput;
    const project = await prisma.project.create({
      data: {
        ownerId: userId,
        name: input.name,
        description: input.description ?? null,
        startDate: input.startDate,
        weekendDays: weekendDaysToString(input.weekendDays ?? DEFAULT_WEEKEND_DAYS),
      },
    });
    res.status(201).json({ project: toProjectDto(project) });
  }),
);

projectRouter.get(
  '/projects/:id',
  asyncHandler(async (req, res) => {
    const project = await requireOwnedProject(req.params.id, currentUserId(req));
    res.json(await buildSnapshot(project.id));
  }),
);

projectRouter.patch(
  '/projects/:id',
  validateBody(projectUpdateSchema),
  asyncHandler(async (req, res) => {
    const project = await requireOwnedProject(req.params.id, currentUserId(req));
    const input = req.body as ProjectUpdateInput;
    const updated = await prisma.project.update({
      where: { id: project.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description ?? null } : {}),
        ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
      },
    });
    res.json({ project: toProjectDto(updated) });
  }),
);

projectRouter.delete(
  '/projects/:id',
  asyncHandler(async (req, res) => {
    const project = await requireOwnedProject(req.params.id, currentUserId(req));
    await prisma.project.delete({ where: { id: project.id } });
    res.status(204).send();
  }),
);
