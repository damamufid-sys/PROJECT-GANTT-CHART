import type { ApiErrorBody } from '@gantt/shared';

const TOKEN_KEY = 'gantt-token';
const USER_KEY = 'gantt-user';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, unknown>;

  constructor(status: number, code: string, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** Daftar pesan validasi per field, mis. `{ name: 'Nama wajib diisi.' }`. */
  get fieldErrors(): Record<string, string> {
    const issues = this.details.issues;
    if (!Array.isArray(issues)) return {};
    const result: Record<string, string> = {};
    for (const issue of issues as Array<{ path?: string; message?: string }>) {
      if (issue.path && issue.message && !result[issue.path]) {
        result[issue.path] = issue.message;
      }
    }
    return result;
  }
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function storeSession(token: string, user: unknown): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getStoredUser<T>(): T | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

interface RequestOptions {
  method?: Method;
  body?: unknown;
  signal?: AbortSignal;
}

/** Memanggil REST API dengan header Authorization bila token tersedia. */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal } = options;
  const token = getStoredToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(`/api${path}`, {
    method,
    headers,
    signal,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  const payload = text.length > 0 ? (JSON.parse(text) as unknown) : null;

  if (!response.ok) {
    const errorBody = payload as ApiErrorBody | null;
    throw new ApiError(
      response.status,
      errorBody?.error?.code ?? 'UNKNOWN',
      errorBody?.error?.message ?? 'Terjadi kesalahan saat menghubungi server.',
      (errorBody?.error?.details as Record<string, unknown>) ?? {},
    );
  }

  return payload as T;
}