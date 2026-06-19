export interface SupabaseErrorLog {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
  name?: string;
  stack?: string;
  thrownValueType?: string;
}

function getStringProperty(value: unknown, key: string) {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const property = (value as Record<string, unknown>)[key];
  return typeof property === 'string' && property.length > 0
    ? property
    : undefined;
}

function getThrownValueType(error: unknown) {
  if (error === null) {
    return 'null';
  }

  if (!error || typeof error !== 'object') {
    return typeof error;
  }

  return error.constructor?.name || 'Object';
}

export function formatSupabaseErrorLog(error: unknown): SupabaseErrorLog {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
      name: error.name,
    };
  }

  if (typeof error === 'string') {
    return {
      message: error,
      thrownValueType: 'string',
    };
  }

  return {
    message: getStringProperty(error, 'message') ?? 'Unknown error',
    code: getStringProperty(error, 'code'),
    details: getStringProperty(error, 'details'),
    hint: getStringProperty(error, 'hint'),
    thrownValueType: getThrownValueType(error),
  };
}
