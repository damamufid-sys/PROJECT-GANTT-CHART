import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@gantt/shared';
import { useAuth } from '../hooks/useAuth';
import { Field } from '../components/ui/Field';

export function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  if (user) return <Navigate to="/projects" replace />;

  const onSubmit = async (values: LoginInput): Promise<void> => {
    setServerError(null);
    try {
      await login(values.email, values.password);
      navigate('/projects', { replace: true });
    } catch (error) {
      setServerError(error instanceof Error ? error.message : 'Gagal masuk.');
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <div className="card">
        <h1 className="text-lg font-semibold text-slate-900">Masuk</h1>
        <p className="mt-1 text-sm text-slate-500">
          Kelola proyek, jadwal, tim, dan analisis dalam satu tempat.
        </p>
        <form className="mt-4 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <Field label="Email" htmlFor="email" error={errors.email?.message}>
            <input id="email" type="email" className="input" autoComplete="email" {...register('email')} />
          </Field>
          <Field label="Kata sandi" htmlFor="password" error={errors.password?.message}>
            <input
              id="password"
              type="password"
              className="input"
              autoComplete="current-password"
              {...register('password')}
            />
          </Field>
          {serverError ? (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {serverError}
            </p>
          ) : null}
          <button type="submit" className="btn-primary w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Memproses…' : 'Masuk'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-600">
          Belum punya akun?{' '}
          <Link to="/register" className="font-medium text-brand-700 hover:underline">
            Daftar
          </Link>
        </p>
        <p className="mt-2 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">
          Akun demo: demo@example.com / Demo12345
        </p>
      </div>
    </div>
  );
}
