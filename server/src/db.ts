import './config.js';
import { PrismaClient } from '@prisma/client';

/** Satu instance PrismaClient untuk seluruh proses server. */
export const prisma = new PrismaClient();
