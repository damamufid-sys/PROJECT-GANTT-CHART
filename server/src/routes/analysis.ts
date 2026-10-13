import { Router } from 'express';
import {
  buildPertNetwork,
  computeCpm,
  computeResourceCosts,
  computeTaskCosts,
  createCalendar,
  findOverallocations,
  type AnalysisResult,
  type DependencyType,
} from '@gantt/shared';
import { prisma } from '../db.js';
import { requireOwnedProject } from '../middleware/access.js';
import { asyncHandler } from '../middleware/error.js';
import { currentUserId, requireAuth } from '../middleware/auth.js';

export const analysisRouter = Router();

analysisRouter.use(requireAuth);

analysisRouter.get(
  '/projects/:id/analysis',
  asyncHandler(async (req, res) => {
    const project = await requireOwnedProject(req.params.id, currentUserId(req));
    const [tasks, dependencies, resources, assignments, holidays] = await Promise.all([
      prisma.task.findMany({ where: { projectId: project.id }, orderBy: { position: 'asc' } }),
      prisma.dependency.findMany({ where: { predecessor: { projectId: project.id } } }),
      prisma.resource.findMany({ where: { projectId: project.id }, orderBy: { name: 'asc' } }),
      prisma.assignment.findMany({ where: { task: { projectId: project.id } } }),
      prisma.holiday.findMany({ where: { projectId: project.id } }),
    ]);

    const calendar = createCalendar(
      project.weekendDays,
      holidays.map((holiday) => holiday.date),
    );
    const deps = dependencies.map((dependency) => ({
      predecessorId: dependency.predecessorId,
      successorId: dependency.successorId,
      type: (dependency.type === 'SS' ? 'SS' : 'FS') as DependencyType,
      lagDays: dependency.lagDays,
    }));

    const cpm = computeCpm(
      tasks.map((task) => ({
        id: task.id,
        name: task.name,
        parentId: task.parentId,
        durationDays: task.durationDays,
        scheduledStart: task.scheduledStart,
        scheduledEnd: task.scheduledEnd,
      })),
      deps,
      calendar,
      project.startDate,
    );

    const pert = buildPertNetwork(
      tasks.map((task) => ({
        id: task.id,
        name: task.name,
        optimisticDays: task.optimisticDays,
        pessimisticDays: task.pessimisticDays,
      })),
      deps,
      cpm,
    );

    const costTasks = tasks.map((task) => ({
      id: task.id,
      name: task.name,
      parentId: task.parentId,
      durationDays: task.durationDays,
      scheduledStart: task.scheduledStart,
      scheduledEnd: task.scheduledEnd,
    }));
    const costAssignments = assignments.map((assignment) => ({
      id: assignment.id,
      taskId: assignment.taskId,
      resourceId: assignment.resourceId,
      allocationPercent: assignment.allocationPercent,
    }));
    const costResources = resources.map((resource) => ({
      id: resource.id,
      name: resource.name,
      salary: resource.salary,
    }));

    const taskCosts = computeTaskCosts(costTasks, costAssignments, costResources);
    const resourceCosts = computeResourceCosts(costTasks, costAssignments, costResources);
    const resourceById = new Map(resources.map((resource) => [resource.id, resource]));

    const result: AnalysisResult = {
      summary: {
        startDate: cpm.projectStartDate,
        endDate: cpm.projectEndDate,
        totalWorkingDays: cpm.totalWorkingDays,
        totalCost: taskCosts.reduce((sum, item) => sum + item.cost, 0),
        totalTasks: cpm.tasks.length,
        criticalTaskCount: cpm.criticalTasks.length,
      },
      cpm: cpm.tasks,
      criticalPaths: cpm.criticalPaths,
      criticalPathNames: cpm.criticalPaths.map((path) =>
        path.map((id) => cpm.byId.get(id)?.name ?? id),
      ),
      pert,
      costs: {
        total: taskCosts.reduce((sum, item) => sum + item.cost, 0),
        tasks: taskCosts,
        resources: resourceCosts.map((cost) => {
          const resource = resourceById.get(cost.resourceId);
          return {
            ...cost,
            name: resource?.name ?? '',
            email: resource?.email ?? '',
            role: resource?.role ?? '',
          };
        }),
      },
      overallocations: findOverallocations(costTasks, costAssignments, costResources, calendar),
    };

    res.json(result);
  }),
);
