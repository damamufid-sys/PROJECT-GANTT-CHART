import { Router } from 'express';
import {
  calendarUpdateSchema,
  holidayCreateSchema,
  weekendDaysToString,
  type CalendarUpdateInput,
  type HolidayCreateInput,
} from '@gantt/shared';
import { prisma } from '../db.js';
import { requireOwnedHoliday, requireOwnedProject } from '../middleware/access.js';
import { asyncHandler, conflict } from '../middleware/error.js';
import { currentUserId, requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { recomputeProject } from '../services/recompute.js';
import { toHolidayDto, toProjectDto } from '../services/snapshot.js';

export const calendarRouter = Router();

calendarRouter.use(requireAuth);

calendarRouter.put(
  '/projects/:id/calendar',
  validateBody(calendarUpdateSchema),
  asyncHandler(async (req, res) => {
    const project = await requireOwnedProject(req.params.id, currentUserId(req));
    const input = req.body as CalendarUpdateInput;
    const updated = await prisma.project.update({
      where: { id: project.id },
      data: { weekendDays: weekendDaysToString(input.weekendDays) },
    });
    res.json({
      project: toProjectDto(updated),
      tasks: await recomputeProject(project.id),
    });
  }),
);

calendarRouter.post(
  '/projects/:id/holidays',
  validateBody(holidayCreateSchema),
  asyncHandler(async (req, res) => {
    const project = await requireOwnedProject(req.params.id, currentUserId(req));
    const input = req.body as HolidayCreateInput;
    const duplicate = await prisma.holiday.findFirst({
      where: { projectId: project.id, date: input.date },
    });
    if (duplicate) {
      throw conflict('HOLIDAY_EXISTS', 'Hari libur pada tanggal tersebut sudah ada.');
    }
    const holiday = await prisma.holiday.create({
      data: { projectId: project.id, date: input.date, name: input.name },
    });
    res.status(201).json({
      holiday: toHolidayDto(holiday),
      tasks: await recomputeProject(project.id),
    });
  }),
);

calendarRouter.delete(
  '/holidays/:id',
  asyncHandler(async (req, res) => {
    const holiday = await requireOwnedHoliday(req.params.id, currentUserId(req));
    await prisma.holiday.delete({ where: { id: holiday.id } });
    res.json({ tasks: await recomputeProject(holiday.projectId) });
  }),
);
