import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { ResourceCreateInput, ResourceDto } from '@gantt/shared';
import { ResourceDialog } from '../components/team/ResourceDialog';
import { ConfirmDialog } from '../components/ui/Field';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States';
import { useToast } from '../components/ui/Toast';
import { useAnalysis, useProjectActions, useProjectSnapshot } from '../hooks/useProjectData';
import { formatDisplayDate, formatIDR } from '../lib/format';

export function TeamPage() {
  const { projectId = '' } = useParams();
  const toast = useToast();
  const { data, isLoading, error, refetch } = useProjectSnapshot(projectId);
  const analysis = useAnalysis(projectId, true);
  const actions = useProjectActions(projectId);

  const [dialog, setDialog] = useState<{ open: boolean; resource: ResourceDto | null }>({
    open: false,
    resource: null,
  });
  const [deleteTarget, setDeleteTarget] = useState<ResourceDto | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const costByResource = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of analysis.data?.costs.resources ?? []) {
      map.set(item.resourceId, item.totalCost);
    }
    return map;
  }, [analysis.data]);

  const tasksByResource = useMemo(() => {
    const taskById = new Map((data?.tasks ?? []).map((task) => [task.id, task]));
    const map = new Map<string, Array<{ id: string; name: string; percent: number }>>();
    for (const assignment of data?.assignments ?? []) {
      const task = taskById.get(assignment.taskId);
      if (!task) continue;
      const list = map.get(assignment.resourceId) ?? [];
      list.push({ id: task.id, name: task.name, percent: assignment.allocationPercent });
      map.set(assignment.resourceId, list);
    }
    return map;
  }, [data]);

  const warningsByResource = useMemo(() => {
    const map = new Map<string, Array<{ date: string; totalPercent: number }>>();
    for (const warning of analysis.data?.overallocations ?? []) {
      const list = map.get(warning.resourceId) ?? [];
      list.push({ date: warning.date, totalPercent: warning.totalPercent });
      map.set(warning.resourceId, list);
    }
    return map;
  }, [analysis.data]);

  const handleSubmit = async (values: ResourceCreateInput): Promise<void> => {
    setSubmitting(true);
    try {
      if (dialog.resource) {
        await actions.updateResource.mutateAsync({ resourceId: dialog.resource.id, input: values });
        toast.success('Data anggota diperbarui.');
      } else {
        await actions.createResource.mutateAsync(values);
        toast.success('Anggota tim ditambahkan.');
      }
      setDialog({ open: false, resource: null });
    } catch (submitError) {
      toast.error(submitError instanceof Error ? submitError.message : 'Gagal menyimpan anggota.');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async (): Promise<void> => {
    if (!deleteTarget) return;
    try {
      await actions.deleteResource.mutateAsync(deleteTarget.id);
      toast.success('Anggota dihapus.');
      setDeleteTarget(null);
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : 'Gagal menghapus anggota.');
    }
  };

  if (isLoading) return <LoadingState label="Memuat tim…" />;
  if (error) {
    return (
      <div className="p-4">
        <ErrorState
          message={error instanceof Error ? error.message : 'Gagal memuat tim.'}
          onRetry={() => void refetch()}
        />
      </div>
    );
  }
  if (!data) return <LoadingState />;

  return (
    <div className="mx-auto max-w-screen-xl space-y-4 px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Tim proyek</h1>
          <p className="text-xs text-slate-500">
            Total biaya proyek: {formatIDR(analysis.data?.costs.total ?? 0)}
          </p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => setDialog({ open: true, resource: null })}
        >
          + Anggota baru
        </button>
      </div>

      {data.resources.length === 0 ? (
        <EmptyState
          title="Belum ada anggota tim"
          description="Tambahkan anggota untuk menghitung biaya dan beban kerja."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Nama</th>
                <th className="px-3 py-2">Peran</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2 text-right">Gaji / bulan</th>
                <th className="px-3 py-2">Tugas dialokasikan</th>
                <th className="px-3 py-2 text-right">Total biaya</th>
                <th className="px-3 py-2 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.resources.map((resource) => {
                const warnings = warningsByResource.get(resource.id) ?? [];
                return (
                  <tr key={resource.id} data-testid={`team-row-${resource.id}`}>
                    <td className="px-3 py-2 font-medium text-slate-800">{resource.name}</td>
                    <td className="px-3 py-2 text-slate-600">{resource.role}</td>
                    <td className="px-3 py-2 text-slate-600">{resource.email}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{formatIDR(resource.salary)}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {(tasksByResource.get(resource.id) ?? []).length === 0 ? (
                        <span className="text-xs text-slate-400">Belum dialokasikan</span>
                      ) : (
                        <ul className="space-y-0.5 text-xs">
                          {(tasksByResource.get(resource.id) ?? []).map((task) => (
                            <li key={task.id}>
                              {task.name} — {task.percent}%
                            </li>
                          ))}
                        </ul>
                      )}
                      {warnings.length > 0 ? (
                        <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-xs text-amber-700">
                          ⚠ Over-alokasi: {warnings.length} hari kerja melebihi 100% (contoh{' '}
                          {formatDisplayDate(warnings[0].date)} — {warnings[0].totalPercent}%).
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-slate-800">
                      {formatIDR(costByResource.get(resource.id) ?? 0)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          className="btn-secondary px-2 py-1 text-xs"
                          onClick={() => setDialog({ open: true, resource })}
                        >
                          Ubah
                        </button>
                        <button
                          type="button"
                          className="btn-danger px-2 py-1 text-xs"
                          onClick={() => setDeleteTarget(resource)}
                        >
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {(analysis.data?.overallocations.length ?? 0) > 0 ? (
        <div className="card border-amber-200 bg-amber-50 text-sm text-amber-800">
          <p className="font-medium">Peringatan over-alokasi</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs">
            {(analysis.data?.overallocations ?? []).slice(0, 12).map((warning) => (
              <li key={`${warning.resourceId}-${warning.date}`}>
                {data.resources.find((resource) => resource.id === warning.resourceId)?.name ?? 'Anggota'} ·{' '}
                {formatDisplayDate(warning.date)} · total {warning.totalPercent}%
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <ResourceDialog
        open={dialog.open}
        resource={dialog.resource}
        submitting={submitting}
        onClose={() => setDialog({ open: false, resource: null })}
        onSubmit={(values) => void handleSubmit(values)}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Hapus anggota"
        message={`Anggota "${deleteTarget?.name ?? ''}" beserta seluruh alokasinya akan dihapus.`}
        busy={actions.deleteResource.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
