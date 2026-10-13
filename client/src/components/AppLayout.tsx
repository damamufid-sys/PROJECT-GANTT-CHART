import { Link, Navigate, Outlet, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function ProtectedLayout() {
  const { user, ready } = useAuth();
  const location = useLocation();

  if (!ready) {
    return <div className="p-8 text-sm text-slate-500">Memuat sesi…</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

export function AppLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/projects" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-600 text-sm font-bold text-white">
              G
            </span>
            <span className="text-sm font-semibold text-slate-800">Manajemen Proyek Gantt</span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            {user ? <span className="hidden text-slate-600 sm:inline">{user.name}</span> : null}
            <button type="button" className="btn-secondary" onClick={logout}>
              Keluar
            </button>
          </div>
        </div>
      </header>
      <main className="min-h-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}

const TABS = [
  { key: 'gantt', label: 'Gantt' },
  { key: 'team', label: 'Tim' },
  { key: 'calendar', label: 'Kalender' },
  { key: 'analysis', label: 'Analisis' },
] as const;

export function ProjectLayout() {
  const { projectId = '' } = useParams();
  const location = useLocation();

  return (
    <div className="flex min-h-full flex-col">
      <nav className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-screen-2xl gap-1 overflow-x-auto px-4">
          {TABS.map((tab) => {
            const active = location.pathname.includes(`/${tab.key}`);
            return (
              <Link
                key={tab.key}
                to={`/projects/${projectId}/${tab.key}`}
                className={`border-b-2 px-3 py-2 text-sm font-medium ${
                  active
                    ? 'border-brand-600 text-brand-700'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
      <div className="min-h-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
