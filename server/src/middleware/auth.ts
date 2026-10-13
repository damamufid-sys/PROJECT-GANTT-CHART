import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { unauthorized } from './error.js';

export interface AuthenticatedRequest extends Request {
  userId: string;
}

const TOKEN_TTL = '7d';

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, config.jwtSecret, { expiresIn: TOKEN_TTL });
}

function readBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

/** Semua rute selain register, login, dan health memakai middleware ini. */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = readBearerToken(req);
  if (!token) {
    next(unauthorized('Header Authorization Bearer token wajib diisi.'));
    return;
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    if (typeof payload === 'string' || typeof payload.sub !== 'string') {
      next(unauthorized('Token tidak valid.'));
      return;
    }
    (req as AuthenticatedRequest).userId = payload.sub;
    next();
  } catch {
    next(unauthorized('Token tidak valid atau sudah kedaluwarsa.'));
  }
}

/** Mengambil userId dari request yang sudah melewati requireAuth. */
export function currentUserId(req: Request): string {
  const userId = (req as AuthenticatedRequest).userId;
  if (!userId) throw unauthorized();
  return userId;
}
