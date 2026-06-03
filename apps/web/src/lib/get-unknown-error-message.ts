export function getUnknownErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'An unknown error occurred';
}
