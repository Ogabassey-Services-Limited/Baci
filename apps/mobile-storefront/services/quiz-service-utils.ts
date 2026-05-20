export function getOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function getSafeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof (error as { message?: unknown }).message === 'string'
  ) {
    return (error as { message: string }).message;
  }
  if (error && typeof error === 'object') {
    try {
      const serialized = JSON.stringify(error);
      if (serialized) return serialized;
    } catch {
      return 'Unserializable error object';
    }
  }
  return String(error);
}

export async function readQuizJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch (error) {
    console.warn('Unable to parse quiz API JSON response', {
      errorName: error instanceof Error ? error.name : typeof error,
      status: response.status,
    });
    return null;
  }
}

export function getQuizErrorMessage(payload: unknown): string {
  if (
    payload &&
    typeof payload === 'object' &&
    'error' in payload &&
    typeof payload.error === 'string'
  ) {
    return payload.error;
  }

  return 'Quiz request failed';
}

export function getQuizErrorCode(payload: unknown): string {
  if (
    payload &&
    typeof payload === 'object' &&
    'code' in payload &&
    typeof payload.code === 'string'
  ) {
    return payload.code;
  }

  return 'QUIZ_REQUEST_FAILED';
}
