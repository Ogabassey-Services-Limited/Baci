export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string' &&
    error.message.trim()
  ) {
    return error.message;
  }

  return fallback;
}

export function normalizeSafeLinkUrl(value: string): string | null {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmedValue)
    ? trimmedValue
    : `https://${trimmedValue}`;

  try {
    const parsedUrl = new URL(candidate);

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return null;
    }

    return parsedUrl.toString();
  } catch {
    return null;
  }
}
