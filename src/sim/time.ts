import { DAYS_PER_WEEK, DAYS_PER_YEAR, START_YEAR } from '../data/eras';

/** Real seconds per game day at 1x (GDD §3). */
export const SECONDS_PER_DAY = 5;

export type Speed = 0 | 1 | 2 | 4 | 100;

export function yearOf(day: number): number {
  return START_YEAR + day / DAYS_PER_YEAR;
}

export function calendar(day: number): { year: number; week: number; weekday: number } {
  const year = START_YEAR + Math.floor(day / DAYS_PER_YEAR);
  const dayOfYear = day % DAYS_PER_YEAR;
  return { year, week: Math.floor(dayOfYear / DAYS_PER_WEEK) + 1, weekday: dayOfYear % DAYS_PER_WEEK };
}

export function weeksBetween(fromDay: number, toDay: number): number {
  return (toDay - fromDay) / DAYS_PER_WEEK;
}
