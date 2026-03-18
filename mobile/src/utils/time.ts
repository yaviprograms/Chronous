import { CountdownParts } from '../types';

const DAY_MS = 86_400_000;

export function getCountdown(unlockAt: string, now = Date.now()): CountdownParts {
  const totalMs = Math.max(0, new Date(unlockAt).getTime() - now);
  return {
    days: Math.floor(totalMs / DAY_MS),
    hours: Math.floor((totalMs % DAY_MS) / 3_600_000),
    minutes: Math.floor((totalMs % 3_600_000) / 60_000),
    seconds: Math.floor((totalMs % 60_000) / 1_000),
    isUnlocked: totalMs === 0,
    totalMs,
  };
}

export function formatUnlockDate(value: string, withYear = true) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' as const } : {}),
  }).format(new Date(value));
}

export function formatLongDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

export function dateFromDays(days: number) {
  const date = new Date(Date.now() + days * DAY_MS);
  date.setHours(9, 0, 0, 0);
  return date.toISOString();
}

export function parseDateInput(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day), 9, 0, 0, 0);
  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day) ||
    date.getTime() <= Date.now()
  ) {
    return null;
  }
  return date.toISOString();
}

export function relativeUnlockLabel(unlockAt: string) {
  const { days, isUnlocked } = getCountdown(unlockAt);
  if (isUnlocked) return 'Ready to open';
  if (days === 0) return 'Unlocks today';
  if (days === 1) return 'Unlocks tomorrow';
  if (days < 30) return `${days} days to go`;
  if (days < 365) return `${Math.ceil(days / 30)} months to go`;
  const years = days / 365;
  return `${years < 2 ? years.toFixed(1) : Math.round(years)} years to go`;
}

