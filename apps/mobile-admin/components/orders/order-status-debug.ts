const LOG_PREFIX = '[OrderStatusDebug]';

export function logOrderStatusDebug(
  event: string,
  details: Record<string, unknown> = {}
) {
  if (!__DEV__ || process.env.NODE_ENV === 'test') {
    return;
  }

  console.log(LOG_PREFIX, {
    event,
    ...details,
  });
}
