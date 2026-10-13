import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { TaskDto } from '@gantt/shared';
import { GanttChart } from '../components/gantt/GanttChart';
import { TaskDialog } from '../components/gantt/TaskDialog';
import type { TaskFormValues } from '../components/tasks/TaskForm';
import { ConfirmDialog } from '../components/ui/Field';
import { ErrorState, LoadingState } from '../components/ui/States';
import { useToast } from '../components/ui/Toast';
import { useProjectActions, useProjectSnapshot } from '../hooks/useProjectData';
import { isParentTask } from '../lib/taskTree';

interface DialogState {
  open: boolean;
  mode: 'create' | 'edit';
  task: TaskDto | null;
  parentId: string | null;
}

export function GanttPage() {
  const { projectId = '' } = useParams();
  const toast = useToast();
  const { data, isLoading, error, refetch } = useProjectSnapshot(projectId);
  const actions = useProjectActions(projectId);

  const [dialog, setDialog] = useState<DialogState>({ open: false, mode: 'create', task: null, parentId: null });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TaskDto | null>(null);
  const [showCriticalPath, setShowCriticalPath] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const tasks = useMemo(() => data?.tasks ?? [], [data]);
  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedId) ?? null,
    [tasks, selectedId],
  );

  const assigneeLabel = useMemo(() => {
    const resources = new Map((data?.resources ?? []).map((resource) => [resource.id, resource.name]));
    const assignments = data?.assignments ?? [];
    return (taskId: string): string => {
      const names = assignments
        .filter((assignment) => assignment.taskId === taskId)
        .map(
          (assignment) =>
            `${resources.get(assignment.resourceId) ?? 'Anggota'} (${assignment.allocationPercent}%)`,
        );
      return names.length > 0 ? names.join(', ') : 'Belum ada anggota';
    };
  }, [data]);

  const syncRelations = async (taskId: string, values: TaskFormValues): Promise<void> => {
    const existingDependencies = (data?.dependencies ?? []).filter(
      (dependency) => dependency.successorId === taskId,
    );
    const incoming = values.predecessors.filter((row) => row.predecessorId.length > 0);

    for (const dependency of existingDependencies) {
      if (!incoming.some((row) => row.predecessorId === dependency.predecessorId)) {
        await actions.deleteDependency.mutateAsync(dependency.id);
      }
    }
    for (const row of incoming) {
      const existing = existingDependencies.find(
        (dependency) => dependency.predecessorId === row.predecessorId,
      );
      if (!existing) {
        await actions.addDependency.mutateAsync({
          taskId,
          input: { predecessorId: row.predecessorId, type: row.type, lagDays: row.lagDays },
        });
      } else if (existing.type !== row.type || existing.lagDays !== row.lagDays) {
        await actions.updateDependency.mutateAsync({
          dependencyId: existing.id,
          input: { type: row.type, lagDays: row.lagDays },
        });
      }
    }

    const existingAssignments = (data?.assignments ?? []).filter(
      (assignment) => assignment.taskId === taskId,
    );
    const incomingAssignees = values.assignees.filter((row) => row.resourceId.length > 0);

    for (const assignment of existingAssignments) {
      if (!incomingAssignees.some((row) => row.resourceId === assignment.resourceId)) {
        await actions.deleteAssignment.mutateAsync(assignment.id);
      }
    }
    for (const row of incomingAssignees) {
      const existing = existingAssignments.find(
        (assignment) => assignment.resourceId === row.resourceId,
      );
      if (!existing) {
        await actions.addAssignment.mutateAsync({
          taskId,
          input: { resourceId: row.resourceId, allocationPercent: row.allocationPercent },
        });
      } else if (existing.allocationPercent !== row.allocationPercent) {
        await actions.updateAssignment.mutateAsync({
          assignmentId: existing.id,
          input: { allocationPercent: row.allocationPercent },
        });
      }
    }
  };

  const handleSubmit = async (values: TaskFormValues): Promise<void> => {
    setSubmitting(true);
    try {
      const isParent = dialog.task ? isParentTask(tasks, dialog.task.id) : false;
      const basePayload = {
        name: values.name,
        description: values.description?.trim() ? values.description : null,
        priority: values.priority,
        color: values.color,
      };
      const fullPayload = {
        ...basePayload,
        durationDays: values.durationDays,
        startDate: values.startDate,
        progress: values.progress,
        optimisticDays: values.optimisticDays ?? null,
        pessimisticDays: values.pessimisticDays ?? null,
      };

      let taskId = '';
      if (dialog.mode === 'create') {
        const response = await actions.createTask.mutateAsync({
          ...fullPayload,
          parentId: values.parentId && values.parentId.length > 0 ? values.parentId : null,
        });
        taskId = response.task?.id ?? '';
        toast.success('Tugas ditambahkan.');
      } else if (dialog.task) {
        taskId = dialog.task.id;
        await actions.updateTask.mutateAsync({
          taskId,
          input: isParent ? basePayload : fullPayload,
        });
        const newParentId = values.parentId && values.parentId.length > 0 ? values.parentId : null;
        if ((dialog.task.parentId ?? null) !== newParentId) {
          await actions.moveTask.mutateAsync({ taskId, parentId: newParentId, position: 0 });
        }
        toast.success('Tugas diperbarui.');
      }

      await syncRelations(taskId, values);
      setDialog((current) => ({ ...current, open: false }));
      setSelectedId(taskId);
    } catch (submitError) {
      toast.error(submitError instanceof Error ? submitError.message : 'Gagal menyimpan tugas.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDragTask = async (task: TaskDto, startDate: string, clamped: boolean): Promise<void> => {
    try {
      await actions.updateTask.mutateAsync({ taskId: task.id, input: { startDate } });
      if (clamped) {
        toast.info(`Bar "${task.name}" dikembalikan ke batas predecessor karena lebih awal.`);
      }
    } catch (dragError) {
      toast.error(dragError instanceof Error ? dragError.message : 'Gagal memindahkan tugas.');
    }
  };

  const handleResizeTask = async (task: TaskDto, durationDays: number): Promise<void> => {
    try {
      await actions.updateTask.mutateAsync({ taskId: task.id, input: { durationDays } });
    } catch (resizeError) {
      toast.error(resizeError instanceof Error ? resizeError.message : 'Gagal mengubah durasi.');
    }
  };

  const confirmDelete = async (): Promise<void> => {
    if (!deleteTarget) return;
    try {
      await actions.deleteTask.mutateAsync(deleteTarget.id);
      toast.success('Tugas dihapus.');
      if (selectedId === deleteTarget.id) setSelectedId(null);
      setDeleteTarget(null);
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : 'Gagal menghapus tugas.');
    }
  };

  if (isLoading) return <LoadingState label="Memuat proyek…" />;
  if (error) {
    return (
      <div className="p-4">
        <ErrorState
          message={error instanceof Error ? error.message : 'Gagal memuat proyek.'}
          onRetry={() => void refetch()}
        />
      </div>
    );
  }
  if (!data) return <LoadingState />;

  return (
    <div className="mx-auto flex h-[calc(100vh-118px)] max-w-screen-2xl flex-col gap-3 px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">{data.project.name}</h1>
          <p className="text-xs text-slate-500">
            {tasks.length} tugas · akhir pekan: {data.project.weekendDays.split(',').length} hari ·
            mulai {data.project.startDate}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn-primary"
            onClick={() => setDialog({ open: true, mode: 'create', task: null, parentId: null })}
          >
            + Tugas baru
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={!selectedTask}
            onClick={() =>
              setDialog({ open: true, mode: 'create', task: null, parentId: selectedId })
            }
          >
            + Sub-tugas
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={!selectedTask}
            onClick={() =>
              setDialog({ open: true, mode: 'edit', task: selectedTask, parentId: null })
            }
          >
            Ubah
          </button>
          <button
            type="button"
            className="btn-danger"
            disabled={!selectedTask}
            onClick={() => setDeleteTarget(selectedTask)}
          >
            Hapus
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <GanttChart
          tasks={tasks}
          dependencies={data.dependencies}
          holidays={data.holidays}
          weekendDays={data.project.weekendDays}
          projectStart={data.project.startDate}
          showCriticalPath={showCriticalPath}
          onToggleCriticalPath={() => setShowCriticalPath((value) => !value)}
          assigneeLabel={assigneeLabel}
          onSelectTask={(task) => setSelectedId(task.id)}
          onOpenTask={(task) =>
            setDialog({ open: true, mode: 'edit', task, parentId: null })
          }
          onDragTask={(task, startDate, clamped) => void handleDragTask(task, startDate, clamped)}
          onResizeTask={(task, durationDays) => void handleResizeTask(task, durationDays)}
        />
      </div>

      <TaskDialog
        open={dialog.open}
        mode={dialog.mode}
        task={dialog.task}
        defaultParentId={dialog.parentId}
        tasks={tasks}
        dependencies={data.dependencies}
        resources={data.resources}
        assignments={data.assignments}
        submitting={submitting}
        onClose={() => setDialog((current) => ({ ...current, open: false }))}
        onSubmit={(values) => void handleSubmit(values)}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Hapus tugas"
        message={`Tugas "${deleteTarget?.name ?? ''}" beserta sub-tugas, dependensi, dan alokasinya akan dihapus.`}
        busy={actions.deleteTask.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
