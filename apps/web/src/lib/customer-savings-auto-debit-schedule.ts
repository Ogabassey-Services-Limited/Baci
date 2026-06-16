import type { DueSavingsGoalRow } from '@/lib/customer-savings-auto-debit-types';

const LAGOS_DATE_TIME_FORMAT: Intl.DateTimeFormat = new Intl.DateTimeFormat(
  'en-GB',
  {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: '2-digit',
    second: '2-digit',
    timeZone: 'Africa/Lagos',
    year: 'numeric',
  }
);

export function asSavingsNumber(value: number | string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error('Invalid savings amount');
  }
  return parsed;
}

export function getLagosParts(now: Date) {
  const parts = LAGOS_DATE_TIME_FORMAT.formatToParts(now);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}:${values.second}`,
  };
}

function getDaysInMonth(dateIso: string) {
  const year = Number(dateIso.slice(0, 4));
  const month = Number(dateIso.slice(5, 7));
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function getSavingsAutoDebitPeriodKey(
  goal: DueSavingsGoalRow,
  now: Date
) {
  const lagos = getLagosParts(now);
  if (lagos.date < goal.start_date) {
    return null;
  }

  const preferredTime = goal.preferred_debit_time ?? '00:00:00';
  const normalizedTime =
    preferredTime.length === 5 ? `${preferredTime}:00` : preferredTime;
  if (lagos.time < normalizedTime) {
    return null;
  }

  if (goal.contribution_frequency === 'daily') {
    return lagos.date;
  }

  const start = Date.parse(`${goal.start_date}T00:00:00.000Z`);
  const current = Date.parse(`${lagos.date}T00:00:00.000Z`);
  const daysSinceStart = Math.floor((current - start) / 86_400_000);

  if (goal.contribution_frequency === 'weekly') {
    return daysSinceStart % 7 === 0 ? lagos.date : null;
  }

  const startDay = Number(goal.start_date.slice(8, 10));
  const currentDay = Number(lagos.date.slice(8, 10));
  const expectedDay = Math.min(startDay, getDaysInMonth(lagos.date));
  return currentDay === expectedDay ? lagos.date.slice(0, 7) : null;
}

export function getSavingsAutoDebitReference(
  goalId: string,
  periodKey: string
) {
  return `SVG-${goalId.replaceAll('-', '').slice(0, 12)}-${periodKey}`;
}
