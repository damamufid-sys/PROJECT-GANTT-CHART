import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { AssignmentDto, DependencyDto, ResourceDto, TaskDto } from '@gantt/shared';
import { dateOnlySchema, dependencyTypeSchema, hexColorSchema, prioritySchema } from '@gantt/shared';
import { Field } from '../ui/Field';
import { PRIORITY_LABELS } from '../../lib/format';
import { forbiddenParentIds, isParentTask } from '../../lib/taskTree';

export const taskFormSchema = z.object({
  name: z.string().trim().min(1, 'Nama tugas wajib diisi.').max(200, 'Nama maksimal 200 karakter.'),
  description: z.string().max(2000, 'Deskripsi maksimal 2000 karakter.').optional(),
  parentId: z.string().optional(),
  durationDays: z
    .number({ invalid_type_error: 'Durasi wajib diisi.' })
    .int('Durasi harus bilangan bulat.')
    .min(1, 'Durasi minimal 1 hari kerja.')
    .max(3650, 'Durasi terlalu panjang.'),
  startDate: dateOnlySchema,
  priority: prioritySchema,
  color: hexColorSchema,
  progress: z
    .number({ invalid_type_error: 'Progres wajib diisi.' })
    .int('Progres harus bilangan bulat.')
    .min(0, 'Progres minimal 0.')
    .max(100, 'Progres maksimal 100.'),
  optimisticDays: z.number().int('Harus bilangan bulat.').min(1, 'Minimal 1 hari.').max(3650).optional(),
  pessimisticDays: z.number().int('Harus bilangan bulat.').min(1, 'Minimal 1 hari.').max(3650).optional(),
  predecessors: z.array(
    z.object({
      predecessorId: z.string().min(1, 'Pilih tugas predecessor.'),
      type: dependencyTypeSchema,
      lagDays: z.number().int('Jeda harus bilangan bulat.').min(-365, 'Minimal -365.').max(365, 'Maksimal 365.'),
    }),
  ),
  assignees: z.array(
    z.object({
      resourceId: z.string().min(1, 'Pilih anggota tim.'),
      allocationPercent: z
        .number()
        .int('Alokasi harus bilangan bulat.')
        .min(1, 'Alokasi minimal 1%.')
        .max(100, 'Alokasi maksimal 100%.'),
    }),
  ),
});

export type TaskFormValues = z.infer<typeof taskFormSchema>;

interface TaskFormProps {
  formId: string;
  mode: 'create' | 'edit';
  task: TaskDto | null;
  defaultParentId: string | null;
  tasks: TaskDto[];
  dependencies: DependencyDto[];
  resources: ResourceDto[];
  assignments: AssignmentDto[];
  submitting: boolean;
  onSubmit: (values: TaskFormValues) => void;
}

const uniqueBy = <T,>(list: T[], keyOf: (item: T) => string): T[] => {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of list) {
    const key = keyOf(item);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
};

export function TaskForm({
  formId,
  mode,
  task,
  defaultParentId,
  tasks,
  dependencies,
  resources,
  assignments,
  submitting,
  onSubmit,
}: TaskFormProps) {
  const isParent = task ? isParentTask(tasks, task.id) : false;

  const existingPredecessors = task
    ? dependencies
        .filter((dependency) => dependency.successorId === task.id)
        .map((dependency) => ({
          predecessorId: dependency.predecessorId,
          type: dependency.type,
          lagDays: dependency.lagDays,
        }))
    : [];

  const existingAssignees = task
    ? assignments
        .filter((assignment) => assignment.taskId === task.id)
        .map((assignment) => ({
          resourceId: assignment.resourceId,
          allocationPercent: assignment.allocationPercent,
        }))
    : [];

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      name: task?.name ?? '',
      description: task?.description ?? '',
      parentId: task ? (task.parentId ?? '') : (defaultParentId ?? ''),
      durationDays: task?.durationDays ?? 1,
      startDate: task?.startDate ?? new Date().toISOString().slice(0, 10),
      priority: task?.priority ?? 'MEDIUM',
      color: task?.color ?? '#2563eb',
      progress: task?.progress ?? 0,
      optimisticDays: task?.optimisticDays ?? undefined,
      pessimisticDays: task?.pessimisticDays ?? undefined,
      predecessors: existingPredecessors,
      assignees: existingAssignees,
    },
  });

  const predecessorArray = useFieldArray({ control, name: 'predecessors' });
  const assigneeArray = useFieldArray({ control, name: 'assignees' });
  const watchedColor = watch('color');

  const forbidden = task ? forbiddenParentIds(tasks, task.id) : new Set<string>();
  const parentCandidates = tasks.filter((candidate) => !forbidden.has(candidate.id));

  const predecessorCandidates = uniqueBy(
    tasks.filter(
      (candidate) =>
        candidate.id !== task?.id &&
        !tasks.some((other) => other.parentId === candidate.id),
    ),
    (candidate) => candidate.id,
  );

  const toOptionalNumber = (value: unknown): number | undefined => {
    if (value === '' || value === null || value === undefined) return undefined;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  };

  const removePredecessor = (index: number): void => predecessorArray.remove(index);
  const removeAssignee = (index: number): void => assigneeArray.remove(index);

  return (
    <form
      id={formId}
      aria-label={mode === 'create' ? 'Form tugas baru' : 'Form ubah tugas'}
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4"
      noValidate
    >
      <Field label="Nama tugas" htmlFor="task-name" error={errors.name?.message}>
        <input id="task-name" className="input" {...register('name')} />
      </Field>

      <Field label="Deskripsi" htmlFor="task-description" error={errors.description?.message}>
        <textarea id="task-description" rows={2} className="input" {...register('description')} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tugas induk" htmlFor="task-parent" error={errors.parentId?.message}>
          <select id="task-parent" className="input" {...register('parentId')}>
            <option value="">(Tidak ada / tugas akar)</option>
            {parentCandidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Prioritas"
          htmlFor="task-priority"
          error={errors.priority?.message}
        >
          <select id="task-priority" className="input" {...register('priority')}>
            {(['LOW', 'MEDIUM', 'HIGH'] as const).map((priority) => (
              <option key={priority} value={priority}>
                {PRIORITY_LABELS[priority]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="rounded-md bg-slate-50 p-3">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Durasi (hari kerja)"
            htmlFor="task-duration"
            error={errors.durationDays?.message}
            hint={isParent ? 'Dihitung otomatis dari sub-tugas.' : undefined}
          >
            <input
              id="task-duration"
              type="number"
              min={1}
              className="input disabled:bg-slate-100"
              disabled={isParent}
              {...register('durationDays', { valueAsNumber: true })}
            />
          </Field>
          <Field
            label="Mulai paling awal"
            htmlFor="task-start"
            error={errors.startDate?.message}
            hint={isParent ? 'Dihitung otomatis dari sub-tugas.' : undefined}
          >
            <input
              id="task-start"
              type="date"
              className="input disabled:bg-slate-100"
              disabled={isParent}
              {...register('startDate')}
            />
          </Field>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Warna indikator" htmlFor="task-color" error={errors.color?.message}>
          <div className="flex items-center gap-2">
            <input
              id="task-color"
              type="color"
              className="h-9 w-12 cursor-pointer rounded border border-slate-300"
              {...register('color')}
            />
            <span className="text-xs text-slate-500">{watchedColor}</span>
          </div>
        </Field>
        <Field
          label="Progres (%)"
          htmlFor="task-progress"
          error={errors.progress?.message}
          hint={isParent ? 'Dihitung otomatis dari sub-tugas.' : undefined}
        >
          <input
            id="task-progress"
            type="number"
            min={0}
            max={100}
            className="input disabled:bg-slate-100"
            disabled={isParent}
            {...register('progress', { valueAsNumber: true })}
          />
        </Field>
        <Field
          label="Estimasi optimistis (hari)"
          htmlFor="task-optimistic"
          error={errors.optimisticDays?.message}
        >
          <input
            id="task-optimistic"
            type="number"
            min={1}
            className="input disabled:bg-slate-100"
            disabled={isParent}
            {...register('optimisticDays', { setValueAs: toOptionalNumber })}
          />
        </Field>
      </div>

      <Field
        label="Estimasi pesimistis (hari)"
        htmlFor="task-pessimistic"
        error={errors.pessimisticDays?.message}
        hint="Kosongkan bila tidak memakai estimasi PERT."
      >
        <input
          id="task-pessimistic"
          type="number"
          min={1}
          className="input disabled:bg-slate-100"
          disabled={isParent}
          {...register('pessimisticDays', { setValueAs: toOptionalNumber })}
        />
      </Field>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">Predecessor</h3>
          <button
            type="button"
            className="btn-secondary px-2 py-1 text-xs"
            disabled={predecessorCandidates.length === 0}
            onClick={() =>
              predecessorArray.append({
                predecessorId: predecessorCandidates[0]?.id ?? '',
                type: 'FS',
                lagDays: 0,
              })
            }
          >
            + Tambah predecessor
          </button>
        </div>
        {predecessorArray.fields.length === 0 ? (
          <p className="text-xs text-slate-500">Belum ada dependensi.</p>
        ) : (
          <div className="space-y-2">
            {predecessorArray.fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-[1fr_88px_90px_32px] items-center gap-2">
                <select className="input" {...register(`predecessors.${index}.predecessorId` as const)}>
                  <option value="">Pilih tugas</option>
                  {predecessorCandidates.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name}
                    </option>
                  ))}
                </select>
                <select className="input" {...register(`predecessors.${index}.type` as const)}>
                  <option value="FS">FS</option>
                  <option value="SS">SS</option>
                </select>
                <input
                  type="number"
                  className="input"
                  title="Jeda hari kerja"
                  {...register(`predecessors.${index}.lagDays` as const, { valueAsNumber: true })}
                />
                <button
                  type="button"
                  className="btn-danger px-2 py-1"
                  aria-label="Hapus predecessor"
                  onClick={() => removePredecessor(index)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        {errors.predecessors ? (
          <p className="field-error">Periksa baris predecessor (tugas dan jeda harus valid).</p>
        ) : null}
        {isParent ? (
          <p className="mt-1 text-xs text-amber-600">
            Tugas induk tidak boleh punya dependensi. Dependensi di sini akan ditolak server.
          </p>
        ) : null}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">Penanggung jawab</h3>
          <button
            type="button"
            className="btn-secondary px-2 py-1 text-xs"
            disabled={resources.length === 0}
            onClick={() =>
              assigneeArray.append({
                resourceId: resources[0]?.id ?? '',
                allocationPercent: 100,
              })
            }
          >
            + Tambah anggota
          </button>
        </div>
        {assigneeArray.fields.length === 0 ? (
          <p className="text-xs text-slate-500">Belum ada anggota yang dialokasikan.</p>
        ) : (
          <div className="space-y-2">
            {assigneeArray.fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-[1fr_110px_32px] items-center gap-2">
                <select className="input" {...register(`assignees.${index}.resourceId` as const)}>
                  <option value="">Pilih anggota</option>
                  {resources.map((resource) => (
                    <option key={resource.id} value={resource.id}>
                      {resource.name} — {resource.role}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  max={100}
                  className="input"
                  title="Alokasi persen"
                  {...register(`assignees.${index}.allocationPercent` as const, { valueAsNumber: true })}
                />
                <button
                  type="button"
                  className="btn-danger px-2 py-1"
                  aria-label="Hapus anggota"
                  onClick={() => removeAssignee(index)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        {errors.assignees ? (
          <p className="field-error">Periksa baris alokasi (anggota dan persen harus valid).</p>
        ) : null}
      </section>

      <button
        type="submit"
        className="hidden"
        data-testid="task-form-submit"
        disabled={submitting}
      >
        Simpan
      </button>
    </form>
  );
}
