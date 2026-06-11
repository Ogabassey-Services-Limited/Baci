export function getQuizErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Quiz action failed. Please try again.';
}
