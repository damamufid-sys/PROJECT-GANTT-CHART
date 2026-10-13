import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { holidayCreateSchema, type HolidayCreateInput } from '@gantt/shared';
import { MiniCalendar } from '../components/calendar/MiniCalendar';
import { ConfirmDialog } from '../components/ui/Field';
import { Field } from '../components/ui/Field';
import { ErrorState, LoadingState } from '../components/ui/States';
import { useToast } from '../components/ui/Toast';
import { useProjectActions, useProjectSnapshot } from '../hooks/useProjectData';
import { WEEKDAY_LABELS, formatDisplayDate } from '../lib/format';

export function CalendarPage() {
  const { projectId = '' } = useParams();
  const toast = useToast();
  const { data, isLoading, error, refetch } = useProjectSnapshot(projectId);
  const actions = useProjectActions(projectId);
  const [month, setMonth] = useState<string>('');
  const [deleteHolidayId, setDeleteHolidayId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<HolidayCreateInput>({
    resolver: zodResolver(holidayCreateSchema),
    defaultValues: { date: '', name: '' },
  });

  if (isLoading) return <LoadingState label="Memuat kalender…" />;
  if (error) {
    return (
      <div className="p-4">
        <ErrorState
          message={error instanceof Error ? error.message : 'Gagal memuat kalender.'}
          onRetry={() => void refetch()}
        />
      </div>
    );
  }
  if (!data) return <LoadingState />;

  const weekendDays = data.project.weekendDays
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((day) => Number.isInteger(day));
  const currentMonth = month.length > 0 ? month : `${data.project.startDate.slice(0, 7)}-01`;
  const holidays = data.holidays.map((holiday) => holiday.date);

  const toggleWeekend = async (day: number): Promise<void> => {
    const next = weekendDays.includes(day)
      ? weekendDays.filter((item) => item !== day)
      : [...weekendDays, day].sort((a, b) => a - b);
    if (next.length === 0) {
      toast.error('Minimal satu hari harus tetap dihitung sebagai hari kerja.');
      return;
    }
    if (next.length >= 7) {
      toast.error('Akhir pekan tidak boleh berisi ketujuh hari.');
      return;
    }
    try {
      await actions.updateCalendar.mutateAsync(next);
      toast.success('Jadwal diperbarui.');
    } catch (updateError) {
      toast.error(updateError instanceof Error ? updateError.message : 'Gagal memperbarui kalender.');
    }
  };

  const onSubmitHoliday = async (values: HolidayCreateInput): Promise<void> => {
    try {
      await actions.addHoliday.mutateAsync(values);
      toast.success('Jadwal diperbarui.');
      reset({ date: '', name: '' });
    } catch (submitError) {
      toast.error(submitError instanceof Error ? submitError.message : 'Gagal menambah hari libur.');
    }
  };

  const confirmDeleteHoliday = async (): Promise<void> => {
    if (!deleteHolidayId) return;
    try {
      await actions.deleteHoliday.mutateAsync(deleteHolidayId);
      toast.success('Jadwal diperbarui.');
      setDeleteHolidayId(null);
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : 'Gagal menghapus hari libur.');
    }
  };

  return (
    <div className="mx-auto max-w-screen-xl space-y-4 px-4 py-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Kalender proyek</h1>
        <p className="text-xs text-slate-500">
          Durasi tugas hanya menghitung hari kerja. Perubahan di halaman ini langsung menggeser jadwal.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card">
          <h2 className="text-sm font-semibold text-slate-800">Akhir pekan</h2>
          <p className="mt-1 text-xs text-slate-500">
            Centang hari yang tidak dihitung sebagai hari kerja.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {WEEKDAY_LABELS.map((label, day) => (
              <label
                key={label}
                className="flex items-center gap-2 rounded-md border border-slate-200 px-2 py-1.5 text-sm"
              >
                <input
                  type="checkbox"
                  checked={weekendDays.includes(day)}
                  disabled={actions.updateCalendar.isPending}
                  onChange={() => void toggleWeekend(day)}
                />
                {label}
              </label>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Akhir pekan aktif: {weekendDays.map((day) => WEEKDAY_LABELS[day]).join(', ') || 'tidak ada'}
          </p>
        </section>

        <MiniCalendar
          month={currentMonth}
          weekendDays={weekendDays}
          holidays={holidays}
          onChangeMonth={setMonth}
        />
      </div>

      <section className="card">
        <h2 className="text-sm font-semibold text-slate-800">Hari libur khusus</h2>
        <form
          className="mt-3 grid gap-3 sm:grid-cols-[180px_1fr_auto]"
          onSubmit={handleSubmit(onSubmitHoliday)}
          noValidate
        >
          <Field label="Tanggal" htmlFor="holiday-date" error={errors.date?.message}>
            <input id="holiday-date" type="date" className="input" {...register('date')} />
          </Field>
          <Field label="Nama hari libur" htmlFor="holiday-name" error={errors.name?.message}>
            <input id="holiday-name" className="input" {...register('name')} />
          </Field>
          <div className="flex items-end">
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Menyimpan…' : '+ Tambah'}
            </button>
          </div>
        </form>

        {data.holidays.length === 0 ? (
          <p className="mt-3 text-xs text-slate-500">Belum ada hari libur khusus.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {data.holidays.map((holiday) => (
              <li key={holiday.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-slate-700">
                  {formatDisplayDate(holiday.date)} — {holiday.name}
                </span>
                <button
                  type="button"
                  className="btn-danger px-2 py-1 text-xs"
                  onClick={() => setDeleteHolidayId(holiday.id)}
                >
                  Hapus
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={deleteHolidayId !== null}
        title="Hapus hari libur"
        message="Hari ini akan kembali dihitung sebagai hari kerja dan jadwal bergeser otomatis."
        busy={actions.deleteHoliday.isPending}
        onCancel={() => setDeleteHolidayId(null)}
        onConfirm={() => void confirmDeleteHoliday()}
      />
    </div>
  );
}
