/**
 * Utilitas tanggal berbasis UTC murni.
 * Semua perhitungan memakai UTC agar tidak ada pergeseran satu hari
 * akibat zona waktu lokal.
 */

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export const MS_PER_DAY = 86_400_000;

/** Mengubah string `YYYY-MM-DD` menjadi `Date` pada tengah malam UTC. */
export function toUTCDate(value: string): Date {
  const match = DATE_PATTERN.exec(value);
  if (!match) {
    throw new Error(`Format tanggal tidak valid: ${value}`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return new Date(Date.UTC(year, month - 1, day));
}

/** Mengubah `Date` menjadi string `YYYY-MM-DD` (UTC). */
export function formatDate(date: Date): string {
  const year = String(date.getUTCFullYear()).padStart(4, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Benar bila string adalah tanggal ISO valid (mis. 2026-02-30 ditolak). */
export function isValidDateString(value: string): boolean {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false;
  try {
    return formatDate(toUTCDate(value)) === value;
  } catch {
    return false;
  }
}

/** Menambah sejumlah hari kalender (boleh negatif). */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/** Hari dalam seminggu UTC: 0 = Minggu ... 6 = Sabtu. */
export function getDayOfWeek(date: Date): number {
  return date.getUTCDay();
}

/** Negatif bila a < b, 0 bila sama, positif bila a > b. */
export function compareDates(a: Date, b: Date): number {
  return a.getTime() - b.getTime();
}

/** Selisih hari kalender antara dua tanggal. */
export function diffInCalendarDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY);
}

export function minDate(a: Date, b: Date): Date {
  return compareDates(a, b) <= 0 ? a : b;
}

export function maxDate(a: Date, b: Date): Date {
  return compareDates(a, b) >= 0 ? a : b;
}

export const WEEKDAY_NAMES_ID = [
  'Minggu',
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
] as const;

export function weekdayName(day: number): string {
  return WEEKDAY_NAMES_ID[day] ?? '';
}

/** Format tampilan pendek untuk UI, mis. `23 Okt 2026`. */
const MONTH_NAMES_ID = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
] as const;

export function formatDisplayDate(value: string): string {
  const date = toUTCDate(value);
  return `${date.getUTCDate()} ${MONTH_NAMES_ID[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}
