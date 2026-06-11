import type { QuizEventResponse } from '@/schemas/quiz';

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
