/**
 * Kalender proyek: akhir pekan dan hari libur.
 * Durasi tugas hanya menghitung hari kerja.
 */

import { addDays, compareDates, formatDate, getDayOfWeek } from './dates.js';

export interface CalendarConfig {
  /** 0 = Minggu ... 6 = Sabtu. */
  weekendDays: number[];
  /** Daftar tanggal libur `YYYY-MM-DD`. */
  holidays: string[];
}

export const DEFAULT_WEEKEND_DAYS: number[] = [0, 6];

export function weekendDaysToString(days: number[]): string {
  return [...new Set(days)].sort((a, b) => a - b).join(',');
}

export function parseWeekendDays(value: string | null | undefined): number[] {
  if (!value) return [...DEFAULT_WEEKEND_DAYS];
  const days = value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => Number(part))
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
  return [...new Set(days)].sort((a, b) => a - b);
}

/**
 * Mengembalikan pesan kesalahan bila daftar akhir pekan tidak valid,
 * atau null bila valid. Kalender tanpa satu pun hari kerja ditolak.
 */
export function validateWeekendDays(days: number[]): string | null {
  if (!Array.isArray(days) || days.length === 0) {
    return 'Akhir pekan tidak boleh kosong.';
  }
  for (const day of days) {
    if (!Number.isInteger(day) || day < 0 || day > 6) {
      return 'Hari akhir pekan harus berupa angka 0 sampai 6.';
    }
  }
  const unique = new Set(days);
  if (unique.size !== days.length) {
    return 'Hari akhir pekan tidak boleh duplikat.';
  }
  if (unique.size >= 7) {
    return 'Akhir pekan tidak boleh berisi ketujuh hari.';
  }
  return null;
}

export function isWeekend(date: Date, calendar: CalendarConfig): boolean {
  return calendar.weekendDays.includes(getDayOfWeek(date));
}

export function isHoliday(date: Date, calendar: CalendarConfig): boolean {
  return calendar.holidays.includes(formatDate(date));
}

export function isWorkingDay(date: Date, calendar: CalendarConfig): boolean {
  return !isWeekend(date, calendar) && !isHoliday(date, calendar);
}

/** Hari kerja pada atau setelah `date`. */
export function nextWorkingDay(date: Date, calendar: CalendarConfig): Date {
  let cursor = date;
  // Pengaman agar tidak terjadi infinite loop pada konfigurasi aneh.
  for (let guard = 0; guard < 4000; guard += 1) {
    if (isWorkingDay(cursor, calendar)) return cursor;
    cursor = addDays(cursor, 1);
  }
  throw new Error('Tidak menemukan hari kerja dalam rentang yang wajar.');
}

/** Hari kerja pada atau sebelum `date`. */
export function previousWorkingDay(date: Date, calendar: CalendarConfig): Date {
  let cursor = date;
  for (let guard = 0; guard < 4000; guard += 1) {
    if (isWorkingDay(cursor, calendar)) return cursor;
    cursor = addDays(cursor, -1);
  }
  throw new Error('Tidak menemukan hari kerja dalam rentang yang wajar.');
}

/**
 * Menggeser hari kerja sebanyak `count` langkah (boleh negatif).
 * `date` harus merupakan hari kerja.
 */
export function shiftWorkingDays(
  date: Date,
  count: number,
  calendar: CalendarConfig,
): Date {
  if (!Number.isInteger(count)) {
    throw new Error('Jumlah pergeseran hari kerja harus bilangan bulat.');
  }
  if (count === 0) return date;
  const step = count > 0 ? 1 : -1;
  let remaining = Math.abs(count);
  let cursor = date;
  while (remaining > 0) {
    cursor = addDays(cursor, step);
    if (isWorkingDay(cursor, calendar)) remaining -= 1;
  }
  return cursor;
}

/** Jumlah hari kerja pada rentang `start`..`end` (inklusif). */
export function workingDaysBetween(
  start: Date,
  end: Date,
  calendar: CalendarConfig,
): number {
  if (compareDates(start, end) > 0) return 0;
  let count = 0;
  let cursor = start;
  while (compareDates(cursor, end) <= 0) {
    if (isWorkingDay(cursor, calendar)) count += 1;
    cursor = addDays(cursor, 1);
  }
  return count;
}

/** Daftar tanggal hari kerja pada rentang `start`..`end` (inklusif). */
export function workingDaysList(
  start: Date,
  end: Date,
  calendar: CalendarConfig,
): Date[] {
  const result: Date[] = [];
  let cursor = start;
  while (compareDates(cursor, end) <= 0) {
    if (isWorkingDay(cursor, calendar)) result.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return result;
}

/** Membuat konfigurasi kalender dari data proyek. */
export function createCalendar(
  weekendDays: number[] | string,
  holidays: string[] = [],
): CalendarConfig {
  const days = typeof weekendDays === 'string' ? parseWeekendDays(weekendDays) : weekendDays;
  return { weekendDays: days, holidays: [...holidays] };
}
