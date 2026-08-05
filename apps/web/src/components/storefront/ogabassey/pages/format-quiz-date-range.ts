import { QUIZ_DEFAULT_TIME_ZONE } from '@baci/shared/constants';
import type { QuizEventResponse } from '@/schemas/quiz';

type QuizDateRangeEvent = Pick<
  QuizEventResponse,
  'endsAt' | 'startsAt' | 'timeZone'
>;

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function createFormatter(timeZone: string): Intl.DateTimeFormat {
  try {
    return new Intl.DateTimeFormat('en-NG', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone,
    });
  } catch {
    return new Intl.DateTimeFormat('en-NG', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: QUIZ_DEFAULT_TIME_ZONE,
    });
  }
}

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(timeZone);
  if (cached) return cached;

  const formatter = createFormatter(timeZone);
  formatterCache.set(timeZone, formatter);
  return formatter;
}

export function formatQuizDateRange(event: QuizDateRangeEvent): string {
  const formatter = getFormatter(event.timeZone || QUIZ_DEFAULT_TIME_ZONE);
  if (event.endsAt && !event.startsAt) {
    return `Ends ${formatter.format(new Date(event.endsAt))}`;
  }

  if (event.startsAt && !event.endsAt) {
    return `Starts ${formatter.format(new Date(event.startsAt))}`;
  }

  if (event.startsAt && event.endsAt) {
    return `${formatter.format(new Date(event.startsAt))} - ${formatter.format(new Date(event.endsAt))}`;
  }

  return 'Time not set';
}
