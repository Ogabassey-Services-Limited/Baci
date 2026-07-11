import 'server-only';

const RETRYABLE_DATABASE_CODES = new Set([
  '40001',
  '40P01',
  '53300',
  '57P01',
  'PGRST000',
  'PGRST002',
  'PGRST003',
]);

function errorProperty(error: unknown, property: 'code' | 'name' | 'status') {
  if (typeof error !== 'object' || error === null) return undefined;
  return Reflect.get(error, property);
}

export function isRetryablePetrockStateWriteError(error: unknown) {
  if (error instanceof TypeError) return true;

  const name = errorProperty(error, 'name');
  if (name === 'AbortError' || name === 'TimeoutError') return true;

  const status = errorProperty(error, 'status');
  if (typeof status === 'number' && status >= 500 && status < 600) return true;

  const code = errorProperty(error, 'code');
  return (
    typeof code === 'string' &&
    (code.startsWith('08') || RETRYABLE_DATABASE_CODES.has(code))
  );
}

export async function retryPetrockStateWrite<Result>(
  operation: () => Promise<Result>,
  shouldRetry: (error: unknown) => boolean
) {
  try {
    return await operation();
  } catch (error) {
    if (!shouldRetry(error)) throw error;
    return operation();
  }
}
