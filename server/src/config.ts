import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';

// Memuat server/.env tanpa bergantung pada current working directory,
// sehingga `npm run dev` dan `npm run start` sama-sama bekerja.
const currentDir = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(currentDir, '../.env') });

function readPort(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const jwtSecret = process.env.JWT_SECRET?.trim() ?? '';
if (jwtSecret.length === 0) {
  throw new Error(
    'JWT_SECRET belum diatur. Salin server/.env.example menjadi server/.env lalu isi JWT_SECRET dengan string acak.',
  );
}

export const config = {
  port: readPort(process.env.PORT, 3001),
  jwtSecret,
  databaseUrl: process.env.DATABASE_URL ?? '',
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isTest: process.env.NODE_ENV === 'test',
} as const;
