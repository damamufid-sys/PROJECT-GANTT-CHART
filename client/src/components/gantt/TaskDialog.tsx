import type { AssignmentDto, DependencyDto, ResourceDto, TaskDto } from '@gantt/shared';
import { Modal } from '../ui/Modal';
import { TaskForm, type TaskFormValues } from '../tasks/TaskForm';

interface TaskDialogProps {
  open: boolean;
  mode: 'create' | 'edit';
  task: TaskDto | null;
  defaultParentId: string | null;
  tasks: TaskDto[];
  dependencies: DependencyDto[];
  resources: ResourceDto[];
  assignments: AssignmentDto[];
  submitting: boolean;
  onClose: () => void;
  onSubmit: (values: TaskFormValues) => void;
}

export function TaskDialog({
  open,
  mode,
  task,
  defaultParentId,
  tasks,
  dependencies,
  resources,
  assignments,
  submitting,
  onClose,
  onSubmit,
}: TaskDialogProps) {
  return (
    <Modal
      open={open}
      size="lg"
      title={mode === 'create' ? 'Tugas baru' : `Ubah tugas: ${task?.name ?? ''}`}
      description="Durasi dihitung dalam hari kerja sesuai kalender proyek."
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Batal
          </button>
          <button type="submit" form="task-form" className="btn-primary" disabled={submitting}>
            {submitting ? 'Menyimpan…' : 'Simpan'}
          </button>
        </>
      }
    >
      <TaskForm
        formId="task-form"
        mode={mode}
        task={task}
        defaultParentId={defaultParentId}
        tasks={tasks}
        dependencies={dependencies}
        resources={resources}
        assignments={assignments}
        submitting={submitting}
        onSubmit={onSubmit}
      />
    </Modal>
  );
}
