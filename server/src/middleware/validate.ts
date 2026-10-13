import type { RequestHandler } from 'express';
import type { ZodTypeAny } from 'zod';
import { badRequest, zodDetails } from './error.js';

/** Memvalidasi body request dengan skema zod dan menggantinya dengan hasil parse. */
export function validateBody(schema: ZodTypeAny): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(badRequest('Data yang dikirim tidak valid.', zodDetails(result.error)));
      return;
    }
    req.body = result.data;
    next();
  };
}
