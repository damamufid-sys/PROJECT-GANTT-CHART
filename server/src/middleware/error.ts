import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError } from 'zod';

/** Kesalahan HTTP dengan kode dan pesan bahasa Indonesia. */
export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, unknown> | undefined;

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: Record<string, unknown>): HttpError =>
  new HttpError(400, 'VALIDATION_ERROR', message, details);

export const unprocessable = (code: string, message: string, details?: Record<string, unknown>): HttpError =>
  new HttpError(422, code, message, details);

export const unauthorized = (message = 'Silakan masuk terlebih dahulu.'): HttpError =>
  new HttpError(401, 'UNAUTHORIZED', message);

export const notFound = (message = 'Data tidak ditemukan.'): HttpError =>
  new HttpError(404, 'NOT_FOUND', message);

export const conflict = (code: string, message: string): HttpError =>
  new HttpError(409, code, message);

export function zodDetails(error: ZodError): Record<string, unknown> {
  return {
    issues: error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    })),
  };
}

/** Membungkus handler async agar error-nya diteruskan ke error handler Express. */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Rute ${req.method} ${req.originalUrl} tidak ditemukan.`,
    },
  });
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (error instanceof HttpError) {
    res.status(error.status).json({
      error: { code: error.code, message: error.message, details: error.details ?? {} },
    });
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Data yang dikirim tidak valid.',
        details: zodDetails(error),
      },
    });
    return;
  }

  const message = error instanceof Error ? error.message : 'Terjadi kesalahan tidak terduga.';
  console.error('[error]', error);
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: `Terjadi kesalahan pada server: ${message}` },
  });
}
