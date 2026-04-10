export type Granularity = 'hourly' | 'weekday' | 'month';

export const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;
export const WEEKDAYS = [
  'Sun',
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
] as const;
export const HOURS = Array.from(
  { length: 24 },
  (_, i) => `${i.toString().padStart(2, '0')}:00`
) as readonly string[];
const MONTH_LABELS: readonly string[] = MONTHS;
const WEEKDAY_LABELS: readonly string[] = WEEKDAYS;

interface BucketDateParts {
  hour: number;
  weekday: number;
  month: number;
}

function getBucketDateParts(
  date: Date,
  timezone?: string
): BucketDateParts | null {
  if (!timezone) {
    return {
      hour: date.getHours(),
      weekday: date.getDay(),
      month: date.getMonth(),
    };
  }

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      weekday: 'short',
      month: 'short',
      hourCycle: 'h23',
    });
    const parts = formatter.formatToParts(date);
    const hour = Number(parts.find((part) => part.type === 'hour')?.value);
    const weekdayLabel = parts.find((part) => part.type === 'weekday')?.value;
    const monthLabel = parts.find((part) => part.type === 'month')?.value;
    const weekday = weekdayLabel ? WEEKDAY_LABELS.indexOf(weekdayLabel) : -1;
    const month = monthLabel ? MONTH_LABELS.indexOf(monthLabel) : -1;

    if (Number.isNaN(hour) || weekday < 0 || month < 0) {
      return null;
    }

    return { hour, weekday, month };
  } catch (error) {
    console.warn('[analyticsDetailBuckets] Invalid timezone provided:', {
      timezone,
      error,
    });
    return null;
  }
}

export function getBuckets(granularity: Granularity): readonly string[] {
  switch (granularity) {
    case 'hourly':
      return HOURS;
    case 'weekday':
      return WEEKDAYS;
    case 'month':
      return MONTHS;
  }
}

export function getBucketIndex(
  date: Date,
  granularity: Granularity,
  timezone?: string
): number {
  const bucketDateParts = getBucketDateParts(date, timezone);
  if (!bucketDateParts) {
    return -1;
  }

  switch (granularity) {
    case 'hourly':
      return bucketDateParts.hour;
    case 'weekday':
      return bucketDateParts.weekday;
    case 'month':
      return bucketDateParts.month;
  }
}
