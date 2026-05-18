export function sanitizeErrorMessage(reason: unknown): string {
  if (reason instanceof Error) return reason.message;

  if (reason && typeof reason === 'object') {
    const message = Reflect.get(reason, 'message');
    if (typeof message === 'string') return message;
  }

  if (typeof reason === 'string') return reason;
  return 'Unknown error';
}
