/**
 * Skema validasi zod. Dipakai server (validasi input) dan client (validasi form).
 */

import { z } from 'zod';
import { isValidDateString } from './dates.js';
import { validateWeekendDays } from './calendar.js';

export const prioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH'], {
  errorMap: () => ({ message: 'Prioritas harus LOW, MEDIUM, atau HIGH.' }),
});

export const dependencyTypeSchema = z.enum(['FS', 'SS'], {
  errorMap: () => ({ message: 'Tipe dependensi harus FS atau SS.' }),
});

export const dateOnlySchema = z
  .string({ required_error: 'Tanggal wajib diisi.' })
  .refine(isValidDateString, { message: 'Tanggal harus berformat YYYY-MM-DD dan valid.' });

export const hexColorSchema = z
  .string({ required_error: 'Warna wajib diisi.' })
  .regex(/^#[0-9a-fA-F]{6}$/, 'Warna harus berupa kode hex, mis. #2563eb.');

export const weekendDaysSchema = z
  .array(z.number().int().min(0).max(6), {
    required_error: 'Daftar akhir pekan wajib diisi.',
  })
  .superRefine((days, ctx) => {
    const message = validateWeekendDays(days);
    if (message) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    }
  });

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Nama wajib diisi.').max(100, 'Nama maksimal 100 karakter.'),
  email: z.string().trim().toLowerCase().email('Email tidak valid.'),
  password: z.string().min(8, 'Kata sandi minimal 8 karakter.'),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email tidak valid.'),
  password: z.string().min(1, 'Kata sandi wajib diisi.'),
});

export const projectCreateSchema = z.object({
  name: z.string().trim().min(1, 'Nama proyek wajib diisi.').max(150),
  description: z.string().trim().max(2000).optional().nullable(),
  startDate: dateOnlySchema,
  weekendDays: weekendDaysSchema.optional(),
});

export const projectUpdateSchema = z.object({
  name: z.string().trim().min(1, 'Nama proyek wajib diisi.').max(150).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  startDate: dateOnlySchema.optional(),
});

export const taskCreateSchema = z
  .object({
    name: z.string().trim().min(1, 'Nama tugas wajib diisi.').max(200),
    description: z.string().trim().max(2000).optional().nullable(),
    parentId: z.string().min(1).optional().nullable(),
    durationDays: z
      .number({ required_error: 'Durasi wajib diisi.' })
      .int('Durasi harus bilangan bulat.')
      .min(1, 'Durasi minimal 1 hari kerja.')
      .max(3650, 'Durasi terlalu panjang.'),
    startDate: dateOnlySchema,
    priority: prioritySchema.default('MEDIUM'),
    color: hexColorSchema.default('#2563eb'),
    progress: z.number().int().min(0).max(100).default(0),
    optimisticDays: z.number().int().min(1).max(3650).optional().nullable(),
    pessimisticDays: z.number().int().min(1).max(3650).optional().nullable(),
    position: z.number().int().min(0).optional(),
  })
  .superRefine((value, ctx) => {
    if (
      typeof value.optimisticDays === 'number' &&
      typeof value.pessimisticDays === 'number' &&
      value.pessimisticDays < value.optimisticDays
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['pessimisticDays'],
        message: 'Estimasi pesimistis tidak boleh lebih kecil dari optimistis.',
      });
    }
  });

export const taskUpdateSchema = z
  .object({
    name: z.string().trim().min(1, 'Nama tugas wajib diisi.').max(200).optional(),
    description: z.string().trim().max(2000).optional().nullable(),
    durationDays: z.number().int().min(1).max(3650).optional(),
    startDate: dateOnlySchema.optional(),
    priority: prioritySchema.optional(),
    color: hexColorSchema.optional(),
    progress: z.number().int().min(0).max(100).optional(),
    optimisticDays: z.number().int().min(1).max(3650).optional().nullable(),
    pessimisticDays: z.number().int().min(1).max(3650).optional().nullable(),
    position: z.number().int().min(0).optional(),
  })
  .superRefine((value, ctx) => {
    if (
      typeof value.optimisticDays === 'number' &&
      typeof value.pessimisticDays === 'number' &&
      value.pessimisticDays < value.optimisticDays
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['pessimisticDays'],
        message: 'Estimasi pesimistis tidak boleh lebih kecil dari optimistis.',
      });
    }
  });

export const taskMoveSchema = z.object({
  parentId: z.string().min(1).nullable().optional(),
  position: z.number().int().min(0),
});

export const dependencyCreateSchema = z.object({
  predecessorId: z.string().min(1, 'Tugas predecessor wajib dipilih.'),
  type: dependencyTypeSchema.default('FS'),
  lagDays: z
    .number()
    .int('Jeda harus bilangan bulat.')
    .min(-365, 'Jeda minimal -365 hari.')
    .max(365, 'Jeda maksimal 365 hari.')
    .default(0),
});

export const dependencyUpdateSchema = z.object({
  type: dependencyTypeSchema.optional(),
  lagDays: z.number().int().min(-365).max(365).optional(),
});

export const resourceCreateSchema = z.object({
  name: z.string().trim().min(1, 'Nama anggota wajib diisi.').max(150),
  email: z.string().trim().toLowerCase().email('Email tidak valid.'),
  role: z.string().trim().min(1, 'Peran wajib diisi.').max(100),
  salary: z
    .number({ required_error: 'Gaji wajib diisi.' })
    .int('Gaji harus bilangan bulat.')
    .min(0, 'Gaji tidak boleh negatif.'),
});

export const resourceUpdateSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  email: z.string().trim().toLowerCase().email('Email tidak valid.').optional(),
  role: z.string().trim().min(1).max(100).optional(),
  salary: z.number().int().min(0).optional(),
});

export const assignmentCreateSchema = z.object({
  resourceId: z.string().min(1, 'Anggota wajib dipilih.'),
  allocationPercent: z
    .number()
    .int('Alokasi harus bilangan bulat.')
    .min(1, 'Alokasi minimal 1 persen.')
    .max(100, 'Alokasi maksimal 100 persen.')
    .default(100),
});

export const assignmentUpdateSchema = z.object({
  allocationPercent: z.number().int().min(1).max(100),
});

export const calendarUpdateSchema = z.object({
  weekendDays: weekendDaysSchema,
});

export const holidayCreateSchema = z.object({
  date: dateOnlySchema,
  name: z.string().trim().min(1, 'Nama hari libur wajib diisi.').max(150),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;
export type ProjectUpdateInput = z.infer<typeof projectUpdateSchema>;
export type TaskCreateInput = z.infer<typeof taskCreateSchema>;
export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>;
export type TaskMoveInput = z.infer<typeof taskMoveSchema>;
export type DependencyCreateInput = z.infer<typeof dependencyCreateSchema>;
export type DependencyUpdateInput = z.infer<typeof dependencyUpdateSchema>;
export type ResourceCreateInput = z.infer<typeof resourceCreateSchema>;
export type ResourceUpdateInput = z.infer<typeof resourceUpdateSchema>;
export type AssignmentCreateInput = z.infer<typeof assignmentCreateSchema>;
export type AssignmentUpdateInput = z.infer<typeof assignmentUpdateSchema>;
export type CalendarUpdateInput = z.infer<typeof calendarUpdateSchema>;
export type HolidayCreateInput = z.infer<typeof holidayCreateSchema>;
