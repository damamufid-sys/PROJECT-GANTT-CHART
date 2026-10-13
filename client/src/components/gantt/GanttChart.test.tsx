import { describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { GanttChart } from './GanttChart';
import { buildSnapshotFixture } from '../../test/fixtures';

const { snapshot } = buildSnapshotFixture();
const DAY_WIDTH = 36;

/**
 * jsdom belum memiliki PointerEvent, jadi event pointer disimulasikan dengan
 * MouseEvent yang membawa `clientX` (nama event tetap `pointerdown`/`pointermove`).
 */
function pointerEvent(target: EventTarget, type: string, clientX: number): void {
  act(() => {
    target.dispatchEvent(new MouseEvent(type, { clientX, bubbles: true, cancelable: true }));
  });
}

function renderChart(
  showCriticalPath = false,
  handlers: { onDragTask?: (task: unknown, startDate: string, clamped: boolean) => void; onResizeTask?: (task: unknown, duration: number) => void } = {},
) {
  return render(
    <GanttChart
      tasks={snapshot.tasks}
      dependencies={snapshot.dependencies}
      holidays={snapshot.holidays}
      weekendDays={snapshot.project.weekendDays}
      projectStart={snapshot.project.startDate}
      showCriticalPath={showCriticalPath}
      onToggleCriticalPath={vi.fn()}
      assigneeLabel={() => 'Andi Pratama (100%)'}
      onSelectTask={vi.fn()}
      onOpenTask={vi.fn()}
      onDragTask={(handlers.onDragTask ?? vi.fn()) as never}
      onResizeTask={(handlers.onResizeTask ?? vi.fn()) as never}
    />,
  );
}

describe('GanttChart', () => {
  it('menampilkan bar tugas daun dan bar pengganti untuk tugas induk', () => {
    renderChart();
    expect(screen.getByTestId('gantt-bar-1.1')).toBeInTheDocument();
    expect(screen.getByTestId('gantt-bar-5.2')).toBeInTheDocument();
    expect(screen.getByTestId('gantt-bar-g3')).toHaveAttribute('data-parent', 'true');
    expect(screen.getAllByTestId(/^gantt-bar-/)).toHaveLength(snapshot.tasks.length);
  });

  it('menggambar panah dependensi FS dan SS dari data seed', () => {
    renderChart();
    const fs = snapshot.dependencies.find((dependency) => dependency.type === 'FS');
    const ss = snapshot.dependencies.find((dependency) => dependency.type === 'SS');
    expect(fs).toBeTruthy();
    expect(ss).toBeTruthy();
    expect(screen.getByTestId(`gantt-dependency-${fs?.id}`)).toBeInTheDocument();
    expect(screen.getByTestId(`gantt-dependency-${ss?.id}`)).toBeInTheDocument();
    expect(screen.getAllByTestId(/^gantt-dependency-/)).toHaveLength(snapshot.dependencies.length);
  });

  it('menandai bar tugas kritis saat sorot jalur kritis diaktifkan', () => {
    renderChart(true);
    // 5.2 selalu berada di jalur kritis pada data seed.
    expect(screen.getByTestId('gantt-bar-5.2')).toHaveAttribute('data-critical', 'true');
    // 4.1 (Skenario uji) memiliki float sehingga tidak kritis.
    expect(screen.getByTestId('gantt-bar-4.1')).toHaveAttribute('data-critical', 'false');
  });

  it('menampilkan baris tabel sebelah kiri untuk setiap tugas', () => {
    renderChart();
    expect(screen.getByTestId('gantt-row-1.1')).toBeInTheDocument();
    expect(screen.getByText('Kickoff dan kebutuhan')).toBeInTheDocument();
    expect(screen.getByText('Skenario uji')).toBeInTheDocument();
  });

  it('menyediakan pegangan resize pada tugas daun', () => {
    renderChart();
    expect(screen.getByTestId('gantt-resize-1.1')).toBeInTheDocument();
  });

  it('menggeser bar tugas daun dan melaporkan tanggal mulai baru', async () => {
    const onDragTask = vi.fn();
    renderChart(false, { onDragTask });

    pointerEvent(screen.getByTestId('gantt-bar-1.1'), 'pointerdown', 100);
    pointerEvent(window, 'pointermove', 100 + DAY_WIDTH * 2);
    pointerEvent(window, 'pointerup', 100 + DAY_WIDTH * 2);

    await waitFor(() => expect(onDragTask).toHaveBeenCalledTimes(1));
    const [task, startDate] = onDragTask.mock.calls[0];
    expect((task as { name: string }).name).toBe('Kickoff dan kebutuhan');
    // 2026-10-19 (Senin) digeser 2 hari kalender menjadi Rabu 2026-10-21.
    expect(startDate).toBe('2026-10-21');
  });

  it('melaporkan bar yang dikembalikan ke batas predecessor', async () => {
    const onDragTask = vi.fn();
    renderChart(false, { onDragTask });

    // 1.2 (Penyusunan spesifikasi) bergantung FS pada 1.1 yang berakhir 2026-10-21.
    const bar = screen.getByTestId('gantt-bar-1.2');
    pointerEvent(bar, 'pointerdown', 500);
    pointerEvent(window, 'pointermove', 500 - DAY_WIDTH * 5);
    pointerEvent(window, 'pointerup', 500 - DAY_WIDTH * 5);

    await waitFor(() => expect(onDragTask).toHaveBeenCalledTimes(1));
    const [, , clamped] = onDragTask.mock.calls[0];
    expect(clamped).toBe(true);
  });

  it('mengubah durasi lewat pegangan kanan bar', async () => {
    const onResizeTask = vi.fn();
    renderChart(false, { onResizeTask });

    pointerEvent(screen.getByTestId('gantt-resize-1.1'), 'pointerdown', 200);
    pointerEvent(window, 'pointermove', 200 + DAY_WIDTH);
    pointerEvent(window, 'pointerup', 200 + DAY_WIDTH);

    await waitFor(() => expect(onResizeTask).toHaveBeenCalledTimes(1));
    const [, duration] = onResizeTask.mock.calls[0];
    // 3 hari kerja ditambah 1 hari menjadi 4 hari kerja.
    expect(duration).toBe(4);
  });
});
