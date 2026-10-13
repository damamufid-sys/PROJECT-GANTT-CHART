import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { loginSchema, registerSchema, type LoginInput, type RegisterInput } from '@gantt/shared';
import { prisma } from '../db.js';
import { asyncHandler, conflict, unauthorized } from '../middleware/error.js';
import { validateBody } from '../middleware/validate.js';
import { currentUserId, requireAuth, signToken } from '../middleware/auth.js';
import { toUserDto } from '../services/snapshot.js';

const BCRYPT_ROUNDS = 10;

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Terlalu banyak percobaan. Silakan coba lagi beberapa saat lagi.',
    },
  },
});

export const authRouter = Router();

authRouter.post(
  '/register',
  authLimiter,
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as RegisterInput;
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw conflict('EMAIL_TAKEN', 'Email sudah terdaftar. Silakan masuk atau pakai email lain.');
    }
    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    const user = await prisma.user.create({
      data: { name: input.name, email: input.email, passwordHash },
    });
    res.status(201).json({ token: signToken(user.id), user: toUserDto(user) });
  }),
);

authRouter.post(
  '/login',
  authLimiter,
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as LoginInput;
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user) {
      throw unauthorized('Email atau kata sandi salah.');
    }
    const matches = await bcrypt.compare(input.password, user.passwordHash);
    if (!matches) {
      throw unauthorized('Email atau kata sandi salah.');
    }
    res.json({ token: signToken(user.id), user: toUserDto(user) });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: currentUserId(req) } });
    if (!user) throw unauthorized('Sesi tidak valid.');
    res.json({ user: toUserDto(user) });
  }),
);
