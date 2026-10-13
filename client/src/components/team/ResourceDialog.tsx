import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { resourceCreateSchema, type ResourceCreateInput, type ResourceDto } from '@gantt/shared';
import { Modal } from '../ui/Modal';
import { Field } from '../ui/Field';

interface ResourceDialogProps {
  open: boolean;
  resource: ResourceDto | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (values: ResourceCreateInput) => void;
}

export function ResourceDialog({ open, resource, submitting, onClose, onSubmit }: ResourceDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ResourceCreateInput>({
    resolver: zodResolver(resourceCreateSchema),
    defaultValues: { name: '', email: '', role: '', salary: 0 },
  });

  useEffect(() => {
    if (!open) return;
    reset({
      name: resource?.name ?? '',
      email: resource?.email ?? '',
      role: resource?.role ?? '',
      salary: resource?.salary ?? 0,
    });
  }, [open, resource, reset]);

  return (
    <Modal
      open={open}
      title={resource ? `Ubah anggota: ${resource.name}` : 'Anggota tim baru'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Batal
          </button>
          <button type="submit" form="resource-form" className="btn-primary" disabled={submitting}>
            {submitting ? 'Menyimpan…' : 'Simpan'}
          </button>
        </>
      }
    >
      <form id="resource-form" className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Field label="Nama" htmlFor="resource-name" error={errors.name?.message}>
          <input id="resource-name" className="input" {...register('name')} />
        </Field>
        <Field label="Email" htmlFor="resource-email" error={errors.email?.message}>
          <input id="resource-email" type="email" className="input" {...register('email')} />
        </Field>
        <Field label="Peran" htmlFor="resource-role" error={errors.role?.message}>
          <input id="resource-role" className="input" {...register('role')} />
        </Field>
        <Field
          label="Gaji per bulan (rupiah)"
          htmlFor="resource-salary"
          error={errors.salary?.message}
          hint="Tarif harian = gaji / 22 hari kerja."
        >
          <input
            id="resource-salary"
            type="number"
            min={0}
            step={100000}
            className="input"
            {...register('salary', { valueAsNumber: true })}
          />
        </Field>
      </form>
    </Modal>
  );
}
