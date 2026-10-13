import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { GanttPage } from './GanttPage';
import { ToastProvider } from '../components/ui/Toast';
import { buildSnapshotFixture } from '../test/fixtures';

const { snapshot } = buildSnapshotFixture();

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={[`/projects/${snapshot.project.id}/gantt`]}>
          <Routes>
            <Route path="/projects/:projectId/gantt" element={<GanttPage />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('GanttPage', () => {
  beforeEach(() => {
    localStorage.setItem('gantt-token', 'token-uji');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith(`/projects/${snapshot.project.id}`)) {
          return new Response(JSON.stringify(snapshot), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Tidak ada.' } }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );
  });

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('memuat data proyek dari API dan menampilkan Gantt', async () => {
    renderPage();

    expect(screen.getByText('Memuat proyek…')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(snapshot.project.name)).toBeInTheDocument();
    });
    expect(screen.getByTestId('gantt-bar-1.1')).toBeInTheDocument();
    expect(screen.getByTestId('gantt-bar-g1')).toHaveAttribute('data-parent', 'true');
    expect(screen.getAllByTestId(/^gantt-dependency-/)).toHaveLength(snapshot.dependencies.length);

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/projects/${snapshot.project.id}`,
      expect.objectContaining({ method: 'GET' }),
    );
  });
});
