import { useParams } from 'react-router-dom';
import { PertDiagram } from '../components/pert/PertDiagram';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States';
import { useAnalysis } from '../hooks/useProjectData';
import { formatDisplayDate, formatIDR } from '../lib/format';

export function AnalysisPage() {
  const { projectId = '' } = useParams();
  const { data, isLoading, error, refetch } = useAnalysis(projectId);

  if (isLoading) return <LoadingState label="Menghitung analisis…" />;
  if (error) {
    return (
      <div className="p-4">
        <ErrorState
          message={error instanceof Error ? error.message : 'Gagal memuat analisis.'}
          onRetry={() => void refetch()}
        />
      </div>
    );
  }
  if (!data) return <LoadingState />;

  const summaryCards = [
    { label: 'Tanggal mulai', value: formatDisplayDate(data.summary.startDate) },
    { label: 'Tanggal selesai', value: formatDisplayDate(data.summary.endDate) },
    { label: 'Total hari kerja', value: `${data.summary.totalWorkingDays} hari` },
    { label: 'Total biaya', value: formatIDR(data.summary.totalCost) },
    { label: 'Tugas kritis', value: `${data.summary.criticalTaskCount} dari ${data.summary.totalTasks}` },
  ];

  return (
    <div className="mx-auto max-w-screen-xl space-y-5 px-4 py-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Analisis proyek</h1>
        <p className="text-xs text-slate-500">
          Critical Path Method dan diagram PERT dihitung dari tugas daun yang sudah dijadwalkan.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {summaryCards.map((card) => (
          <div key={card.label} className="card">
            <p className="text-xs text-slate-500">{card.label}</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{card.value}</p>
          </div>
        ))}
      </div>

      <section className="card">
        <h2 className="text-sm font-semibold text-slate-800">Jalur kritis</h2>
        {data.criticalPathNames.length === 0 ? (
          <p className="mt-1 text-xs text-slate-500">Tidak ada jalur kritis (belum ada tugas daun).</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm text-slate-700">
            {data.criticalPathNames.map((path, index) => (
              <li key={path.join('-')} data-testid={`critical-path-${index}`}>
                {path.join(' → ')}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2 className="text-sm font-semibold text-slate-800">Tabel CPM</h2>
        {data.cpm.length === 0 ? (
          <EmptyState title="Belum ada tugas daun" description="Tambahkan tugas pada halaman Gantt." />
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Tugas</th>
                  <th className="px-3 py-2 text-right">Durasi</th>
                  <th className="px-3 py-2 text-right">ES</th>
                  <th className="px-3 py-2 text-right">EF</th>
                  <th className="px-3 py-2 text-right">LS</th>
                  <th className="px-3 py-2 text-right">LF</th>
                  <th className="px-3 py-2 text-right">Float</th>
                  <th className="px-3 py-2">Kritis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.cpm.map((task) => (
                  <tr key={task.id} data-testid={`cpm-row-${task.id}`} data-critical={task.critical ? 'true' : 'false'}>
                    <td className="px-3 py-2 text-slate-800">{task.name}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{task.durationDays}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{task.es}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{task.ef}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{task.ls}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{task.lf}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{task.totalFloat}</td>
                    <td className="px-3 py-2">
                      {task.critical ? (
                        <span className="badge bg-red-100 text-red-700">Kritis</span>
                      ) : (
                        <span className="badge bg-slate-100 text-slate-600">Tidak</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="text-sm font-semibold text-slate-800">Diagram PERT</h2>
        <p className="mt-1 text-xs text-slate-500">
          Kolom menunjukkan kedalaman jalur terpanjang. Node dan panah merah berada di jalur kritis.
        </p>
        <div className="mt-3">
          <PertDiagram network={data.pert} />
        </div>
      </section>

      <section className="card">
        <h2 className="text-sm font-semibold text-slate-800">Beban dan biaya per anggota</h2>
        {data.costs.resources.length === 0 ? (
          <p className="mt-1 text-xs text-slate-500">Belum ada anggota tim dengan alokasi.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Anggota</th>
                  <th className="px-3 py-2">Peran</th>
                  <th className="px-3 py-2 text-right">Hari kerja dialokasikan</th>
                  <th className="px-3 py-2 text-right">Total biaya</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.costs.resources.map((cost) => (
                  <tr key={cost.resourceId}>
                    <td className="px-3 py-2 text-slate-800">{cost.name}</td>
                    <td className="px-3 py-2 text-slate-600">{cost.role}</td>
                    <td className="px-3 py-2 text-right text-slate-600">
                      {cost.totalWorkingDays.toFixed(1)}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-slate-800">
                      {formatIDR(cost.totalCost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data.overallocations.length > 0 ? (
          <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {data.overallocations.length} hari kerja memiliki alokasi melebihi 100%. Lihat detail di
            halaman Tim.
          </p>
        ) : null}
      </section>
    </div>
  );
}
