import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactElement } from 'react';
import type { ProjectSnapshot } from '@gantt/shared';
import { AnalysisPage } from './AnalysisPage';
import { CalendarPage } from './CalendarPage';
import { ProjectsPage } from './ProjectsPage';
import { TeamPage } from './TeamPage';
import { ToastProvider } from '../components/ui/Toast';
import { buildAnalysisFixture, buildSnapshotFixture } from '../test/fixtures';

const { snapshot: baseSnapshot } = buildSnapshotFixture();
const { analysis } = buildAnalysisFixture();

const resource = {
  id: 'resource-1',
  projectId: baseSnapshot.project.id,
  name: 'Andi Pratama',
  email: 'andi@example.com',
  role: 'Project Manager',
  salary: 15_000_000,
};

const snapshot: ProjectSnapshot = {
  ...baseSnapshot,
  resources: [resource],
  assignments: [
    { id: 'assignment-1', taskId: '1.1', resourceId: resource.id, allocationPercent: 100 },
  ],
};

const analysisWithCost = {
  ...analysis,
  costs: {
    total: 2_045_454,
    tasks: [{ taskId: '1.1', cost: 2_045_454 }],
    resources: [
      {
        resourceId: resource.id,
        totalCost: 2_045_454,
        totalWorkingDays: 3,
        name: resource.name,
        email: resource.email,
        role: resource.role,
      },
    ],
  },
};

function renderWithProviders(ui: ReactElement, path: string, route: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path={route} element={ui} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('halaman aplikasi dengan data dari API', () => {
  beforeEach(() => {
    localStorage.setItem('gantt-token', 'token-uji');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        const json = (body: unknown, status = 200): Response =>
          new Response(JSON.stringify(body), {
            status,
            headers: { 'Content-Type': 'application/json' },
          });
        if (url.endsWith('/projects')) return json({ projects: [snapshot.project] });
        if (url.endsWith('/analysis')) return json(analysisWithCost);
        if (url.endsWith(`/projects/${snapshot.project.id}`)) return json(snapshot);
        return json({ error: { code: 'NOT_FOUND', message: 'Tidak ditemukan.' } }, 404);
      }),
    );
  });

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('halaman Proyek menampilkan daftar proyek dari API', async () => {
    renderWithProviders(<ProjectsPage />, '/projects', '/projects');
    await waitFor(() => expect(screen.getByText(snapshot.project.name)).toBeInTheDocument());
    expect(screen.getByText('Proyek saya')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Buka' }).length).toBe(1);
  });

  it('halaman Tim menampilkan anggota, tugas, dan biaya', async () => {
    renderWithProviders(<TeamPage />, `/projects/${snapshot.project.id}/team`, '/projects/:projectId/team');
    await waitFor(() => expect(screen.getByText('Andi Pratama')).toBeInTheDocument());
    expect(screen.getByText('Kickoff dan kebutuhan — 100%')).toBeInTheDocument();
    expect(screen.getByText('Rp 2.045.454')).toBeInTheDocument();
  });

  it('halaman Kalender menampilkan hari libur dan kalender mini', async () => {
    renderWithProviders(
      <CalendarPage />,
      `/projects/${snapshot.project.id}/calendar`,
      '/projects/:projectId/calendar',
    );
    await waitFor(() => expect(screen.getByText(/Hari Raya Natal/)).toBeInTheDocument());
    expect(screen.getByText(/Libur internal \(contoh\)/)).toBeInTheDocument();
    expect(screen.getByTestId('mini-calendar-2026-10-19')).toBeInTheDocument();
    expect(screen.getByText('Akhir pekan aktif: Min, Sab')).toBeInTheDocument();
  });

  it('halaman Analisis menampilkan ringkasan, jalur kritis, dan diagram PERT', async () => {
    renderWithProviders(
      <AnalysisPage />,
      `/projects/${snapshot.project.id}/analysis`,
      '/projects/:projectId/analysis',
    );
    await waitFor(() => expect(screen.getByText('Analisis proyek')).toBeInTheDocument());
    expect(screen.getByText('Jalur kritis')).toBeInTheDocument();
    expect(screen.getByTestId('critical-path-0')).toBeInTheDocument();
    expect(screen.getByTestId('pert-node-5.2')).toBeInTheDocument();
    expect(screen.getByTestId('cpm-row-5.2')).toHaveAttribute('data-critical', 'true');
    expect(screen.getByTestId('cpm-row-4.1')).toHaveAttribute('data-critical', 'false');
    expect(screen.getByText('Total hari kerja')).toBeInTheDocument();
  });
});
