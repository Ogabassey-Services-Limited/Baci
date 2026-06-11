import type { QuizEventResponse } from '@/schemas/quiz';

export function getQuizStartButtonText(
  event: Pick<QuizEventResponse, 'status'>,
  isStarting: boolean
) {
  if (isStarting) return 'Starting...';
  if (event.status === 'scheduled') return 'Coming soon';
  if (event.status === 'closed') return 'Closed';
  return 'Start exam';
}
