import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WEEKEND_DAYS,
  createCalendar,
  isWorkingDay,
  nextWorkingDay,
  parseWeekendDays,
  previousWorkingDay,
  shiftWorkingDays,
  validateWeekendDays,
  weekendDaysToString,
  workingDaysBetween,
} from './calendar.js';
import {
  addDays,
  formatDate,
  formatDisplayDate,
  isValidDateString,
  toUTCDate,
  weekdayName,
} from './dates.js';

const calendar = createCalendar(DEFAULT_WEEKEND_DAYS);

describe('tanggal UTC', () => {
  it('mem-parse dan memformat tanpa pergeseran zona waktu', () => {
    expect(formatDate(toUTCDate('2026-10-23'))).toBe('2026-10-23');
    expect(formatDate(addDays(toUTCDate('2026-10-31'), 1))).toBe('2026-11-01');
    expect(formatDate(addDays(toUTCDate('2026-01-01'), -1))).toBe('2025-12-31');
  });

  it('menolak tanggal tidak valid', () => {
    expect(isValidDateString('2026-10-23')).toBe(true);
    expect(isValidDateString('2026-02-30')).toBe(false);
    expect(isValidDateString('23-10-2026')).toBe(false);
    expect(isValidDateString('')).toBe(false);
  });

  it('memberi nama hari dan format tampilan bahasa Indonesia', () => {
    expect(weekdayName(toUTCDate('2026-10-23').getUTCDay())).toBe('Jumat');
    expect(formatDisplayDate('2026-10-23')).toBe('23 Okt 2026');
  });
});

describe('kalender proyek', () => {
  it('menganggap Sabtu dan Minggu sebagai akhir pekan', () => {
    expect(isWorkingDay(toUTCDate('2026-10-23'), calendar)).toBe(true);
    expect(isWorkingDay(toUTCDate('2026-10-24'), calendar)).toBe(false);
    expect(isWorkingDay(toUTCDate('2026-10-25'), calendar)).toBe(false);
    expect(isWorkingDay(toUTCDate('2026-10-26'), calendar)).toBe(true);
  });

  it('memajukan tanggal ke hari kerja berikutnya', () => {
    expect(formatDate(nextWorkingDay(toUTCDate('2026-10-24'), calendar))).toBe('2026-10-26');
    expect(formatDate(nextWorkingDay(toUTCDate('2026-10-23'), calendar))).toBe('2026-10-23');
    expect(formatDate(previousWorkingDay(toUTCDate('2026-10-25'), calendar))).toBe('2026-10-23');
  });

  it('menggeser hari kerja termasuk arah negatif', () => {
    expect(formatDate(shiftWorkingDays(toUTCDate('2026-10-23'), 1, calendar))).toBe('2026-10-26');
    expect(formatDate(shiftWorkingDays(toUTCDate('2026-10-23'), 3, calendar))).toBe('2026-10-28');
    expect(formatDate(shiftWorkingDays(toUTCDate('2026-10-26'), -1, calendar))).toBe('2026-10-23');
    expect(formatDate(shiftWorkingDays(toUTCDate('2026-10-23'), 0, calendar))).toBe('2026-10-23');
  });

  it('menghitung jumlah hari kerja inklusif', () => {
    expect(workingDaysBetween(toUTCDate('2026-10-23'), toUTCDate('2026-10-27'), calendar)).toBe(3);
    expect(workingDaysBetween(toUTCDate('2026-10-26'), toUTCDate('2026-10-23'), calendar)).toBe(0);
    expect(workingDaysBetween(toUTCDate('2026-10-19'), toUTCDate('2026-10-28'), calendar)).toBe(8);
  });

  it('menghormati hari libur', () => {
    const withHoliday = createCalendar([0, 6], ['2026-10-26']);
    expect(isWorkingDay(toUTCDate('2026-10-26'), withHoliday)).toBe(false);
    expect(formatDate(nextWorkingDay(toUTCDate('2026-10-26'), withHoliday))).toBe('2026-10-27');
  });

  it('memvalidasi daftar akhir pekan', () => {
    expect(validateWeekendDays([0, 6])).toBeNull();
    expect(validateWeekendDays([])).not.toBeNull();
    expect(validateWeekendDays([0, 0])).not.toBeNull();
    expect(validateWeekendDays([0, 1, 2, 3, 4, 5, 6])).not.toBeNull();
    expect(validateWeekendDays([7])).not.toBeNull();
  });

  it('mengubah akhir pekan ke string dan sebaliknya', () => {
    expect(parseWeekendDays('0,6')).toEqual([0, 6]);
    expect(parseWeekendDays('5')).toEqual([5]);
    expect(parseWeekendDays(null)).toEqual([0, 6]);
    expect(weekendDaysToString([6, 5, 5])).toBe('5,6');
  });
});
