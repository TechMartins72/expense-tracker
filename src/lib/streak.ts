import { addDays } from './dates';

/**
 * Consecutive days with at least one entry, ending today. If nothing is logged yet today,
 * a streak that ran until yesterday still counts (it's not broken until the day is over).
 */
export function loggingStreak(loggedDays: Iterable<string>, now: string): { days: number; loggedToday: boolean } {
  const set = new Set(loggedDays);
  const loggedToday = set.has(now);
  let cursor = loggedToday ? now : addDays(now, -1);
  let days = 0;
  while (set.has(cursor)) {
    days++;
    cursor = addDays(cursor, -1);
  }
  return { days, loggedToday };
}
