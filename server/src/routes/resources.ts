import { Router } from 'express';
import {
  resourceCreateSchema,
  resourceUpdateSchema,
  type ResourceCreateInput,
  type ResourceUpdateInput,
} from '@gantt/shared';
import { prisma } from '../db.js';
import { requireOwnedProject, requireOwnedResource } from '../middleware/access.js';
import { asyncHandler } from '../middleware/error.js';
import { currentUserId, requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { toResourceDto } from '../services/snapshot.js';

export const resourceRouter = Router();

resourceRouter.use(requireAuth);

resourceRouter.get(
  '/projects/:id/resources',
  asyncHandler(async (req, res) => {
    const project = await requireOwnedProject(req.params.id, currentUserId(req));
    const resources = await prisma.resource.findMany({
      where: { projectId: project.id },
      orderBy: [{ name: 'asc' }],
    });
    res.json({ resources: resources.map(toResourceDto) });
  }),
);

resourceRouter.post(
  '/projects/:id/resources',
  validateBody(resourceCreateSchema),
  asyncHandler(async (req, res) => {
    const project = await requireOwnedProject(req.params.id, currentUserId(req));
    const input = req.body as ResourceCreateInput;
    const resource = await prisma.resource.create({
      data: {
        projectId: project.id,
        name: input.name,
        email: input.email,
        role: input.role,
        salary: input.salary,
      },
    });
    res.status(201).json({ resource: toResourceDto(resource) });
  }),
);

resourceRouter.patch(
  '/resources/:id',
  validateBody(resourceUpdateSchema),
  asyncHandler(async (req, res) => {
    const resource = await requireOwnedResource(req.params.id, currentUserId(req));
    const input = req.body as ResourceUpdateInput;
    const updated = await prisma.resource.update({
      where: { id: resource.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.role !== undefined ? { role: input.role } : {}),
        ...(input.salary !== undefined ? { salary: input.salary } : {}),
      },
    });
    res.json({ resource: toResourceDto(updated) });
  }),
);

resourceRouter.delete(
  '/resources/:id',
  asyncHandler(async (req, res) => {
    const resource = await requireOwnedResource(req.params.id, currentUserId(req));
    await prisma.resource.delete({ where: { id: resource.id } });
    res.status(204).send();
  }),
);
