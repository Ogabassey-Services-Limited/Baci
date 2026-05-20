import type { QuizEvent } from '@/services/quiz';

let fallbackLocale: string | undefined;

function getFallbackLocale() {
  fallbackLocale ??= Intl.DateTimeFormat().resolvedOptions().locale;
  return fallbackLocale;
}

export function formatTimeRange(
  event: QuizEvent,
  locale: string | undefined,
  fallbackMessage: string
): string {
  if (!event.startsAt || !event.endsAt) {
    return fallbackMessage;
  }

  const startDate = new Date(event.startsAt);
  const endDate = new Date(event.endsAt);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return fallbackMessage;
  }

  const resolvedLocale = locale || getFallbackLocale();
  const start = startDate.toLocaleTimeString(resolvedLocale, {
    hour: '2-digit',
    minute: '2-digit',
  });
  const end = endDate.toLocaleTimeString(resolvedLocale, {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${start} - ${end}`;
}

export function getQuizErrorMessage(
  error: unknown,
  fallbackMessage: string
): string {
  return error instanceof Error ? error.message : fallbackMessage;
}

export function getEventStartButtonText(
  eventStatus: QuizEvent['status'],
  isStarting: boolean,
  points: number
): string {
  if (eventStatus === 'scheduled') return 'Scheduled';
  if (eventStatus === 'closed') return 'Closed';
  if (isStarting) return 'Starting...';
  return `Use ${formatPointCount(points)} to start`;
}

export function formatPointCount(
  points: number,
  singular = 'point',
  plural = `${singular}s`
): string {
  return `${points} ${Math.abs(points) === 1 ? singular : plural}`;
}
