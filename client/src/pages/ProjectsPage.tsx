import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { projectCreateSchema, type ProjectCreateInput, type ProjectDto } from '@gantt/shared';
import { useCreateProject, useDeleteProject, useProjects } from '../hooks/useProjects';
import { useToast } from '../components/ui/Toast';
import { Field } from '../components/ui/Field';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States';
import { ConfirmDialog } from '../components/ui/Field';
import { Modal } from '../components/ui/Modal';
import { formatDisplayDate } from '../lib/format';

export function ProjectsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { data, isLoading, error, refetch } = useProjects();
  const createProject = useCreateProject();
  const deleteProject = useDeleteProject();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProjectDto | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ProjectCreateInput>({
    resolver: zodResolver(projectCreateSchema),
    defaultValues: { name: '', description: '', startDate: new Date().toISOString().slice(0, 10) },
  });

  const onSubmit = async (values: ProjectCreateInput): Promise<void> => {
    try {
      const response = await createProject.mutateAsync({
        name: values.name,
        description: values.description ?? null,
        startDate: values.startDate,
      });
      toast.success('Proyek berhasil dibuat.');
      setDialogOpen(false);
      reset();
      navigate(`/projects/${response.project.id}/gantt`);
    } catch (submitError) {
      toast.error(submitError instanceof Error ? submitError.message : 'Gagal membuat proyek.');
    }
  };

  const confirmDelete = async (): Promise<void> => {
    if (!deleteTarget) return;
    try {
      await deleteProject.mutateAsync(deleteTarget.id);
      toast.success('Proyek dihapus.');
      setDeleteTarget(null);
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : 'Gagal menghapus proyek.');
    }
  };

  return (
    <div className="mx-auto max-w-screen-lg px-4 py-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Proyek saya</h1>
          <p className="text-sm text-slate-500">Pilih proyek untuk membuka Gantt, tim, kalender, dan analisis.</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setDialogOpen(true)}>
          + Proyek baru
        </button>
      </div>

      {isLoading ? <LoadingState /> : null}
      {error ? (
        <ErrorState
          message={error instanceof Error ? error.message : 'Gagal memuat proyek.'}
          onRetry={() => void refetch()}
        />
      ) : null}

      {data && data.projects.length === 0 ? (
        <EmptyState
          title="Belum ada proyek"
          description="Buat proyek pertama Anda untuk mulai menyusun jadwal."
          action={
            <button type="button" className="btn-primary mt-2" onClick={() => setDialogOpen(true)}>
              + Proyek baru
            </button>
          }
        />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {(data?.projects ?? []).map((project) => (
          <div key={project.id} className="card flex flex-col justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">{project.name}</h2>
              <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                {project.description ?? 'Tanpa deskripsi'}
              </p>
              <p className="mt-2 text-xs text-slate-500">Mulai {formatDisplayDate(project.startDate)}</p>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Link to={`/projects/${project.id}/gantt`} className="btn-primary px-3 py-1 text-xs">
                Buka
              </Link>
              <button
                type="button"
                className="btn-danger px-3 py-1 text-xs"
                onClick={() => setDeleteTarget(project)}
              >
                Hapus
              </button>
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={dialogOpen}
        title="Proyek baru"
        onClose={() => setDialogOpen(false)}
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setDialogOpen(false)}>
              Batal
            </button>
            <button type="submit" form="project-form" className="btn-primary" disabled={createProject.isPending}>
              {createProject.isPending ? 'Menyimpan…' : 'Simpan'}
            </button>
          </>
        }
      >
        <form id="project-form" className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <Field label="Nama proyek" htmlFor="project-name" error={errors.name?.message}>
            <input id="project-name" className="input" {...register('name')} />
          </Field>
          <Field label="Deskripsi" htmlFor="project-description" error={errors.description?.message}>
            <textarea id="project-description" rows={3} className="input" {...register('description')} />
          </Field>
          <Field label="Tanggal mulai proyek" htmlFor="project-start" error={errors.startDate?.message}>
            <input id="project-start" type="date" className="input" {...register('startDate')} />
          </Field>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Hapus proyek"
        message={`Proyek "${deleteTarget?.name ?? ''}" beserta seluruh tugas, dependensi, dan timnya akan dihapus permanen.`}
        busy={deleteProject.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
