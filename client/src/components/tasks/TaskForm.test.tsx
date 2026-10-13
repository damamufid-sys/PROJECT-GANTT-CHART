import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TaskForm } from './TaskForm';
import { buildSnapshotFixture } from '../../test/fixtures';

const { snapshot } = buildSnapshotFixture();

function renderForm(onSubmit = vi.fn()) {
  render(
    <TaskForm
      formId="task-form-test"
      mode="create"
      task={null}
      defaultParentId={null}
      tasks={snapshot.tasks}
      dependencies={snapshot.dependencies}
      resources={[]}
      assignments={[]}
      submitting={false}
      onSubmit={onSubmit}
    />,
  );
  return onSubmit;
}

const submitButton = () => screen.getByTestId('task-form-submit');

describe('TaskForm', () => {
  it('menolak submit ketika nama tugas kosong', async () => {
    const onSubmit = renderForm();
    fireEvent.click(submitButton());

    await waitFor(() => {
      expect(screen.getByText('Nama tugas wajib diisi.')).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('menolak durasi kurang dari satu hari kerja', async () => {
    const onSubmit = renderForm();
    fireEvent.change(screen.getByLabelText('Nama tugas'), { target: { value: 'Tugas Uji' } });
    fireEvent.change(screen.getByLabelText('Durasi (hari kerja)'), { target: { value: '0' } });
    fireEvent.click(submitButton());

    await waitFor(() => {
      expect(screen.getByText('Durasi minimal 1 hari kerja.')).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('mengirim nilai yang valid sesuai skema shared', async () => {
    const onSubmit = renderForm();
    fireEvent.change(screen.getByLabelText('Nama tugas'), { target: { value: 'Tugas Valid' } });
    fireEvent.change(screen.getByLabelText('Durasi (hari kerja)'), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('Progres (%)'), { target: { value: '40' } });
    fireEvent.click(submitButton());

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const values = onSubmit.mock.calls[0][0];
    expect(values).toMatchObject({
      name: 'Tugas Valid',
      durationDays: 5,
      progress: 40,
      priority: 'MEDIUM',
    });
  });

  it('menampilkan editor predecessor dan penanggung jawab', () => {
    renderForm();
    expect(screen.getByRole('heading', { name: 'Predecessor' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Penanggung jawab' })).toBeInTheDocument();
  });
});
