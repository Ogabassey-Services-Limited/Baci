import type { QuizEventResponse } from '@/schemas/quiz';

export function getQuizErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Quiz action failed. Please try again.';
}

export function formatQuizPointCount(points: number): string {
  return `${points} loyalty ${points === 1 ? 'point' : 'points'}`;
}

export function formatQuizDateRange(event: QuizEventResponse): string {
  const formatter = new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

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

export function getQuizStartButtonText(
  event: Pick<QuizEventResponse, 'status'>,
  isStarting: boolean
) {
  if (isStarting) return 'Starting...';
  if (event.status === 'scheduled') return 'Coming soon';
  if (event.status === 'closed') return 'Closed';
  return 'Start exam';
}
