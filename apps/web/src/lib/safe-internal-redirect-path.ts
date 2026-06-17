function hasSafeInternalRedirectShape(path: string): boolean {
  return (
    path.startsWith('/') &&
    !path.startsWith('//') &&
    !path.startsWith('/\\') &&
    !path.includes(':')
  );
}

export function toSafeInternalRedirectPath(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const path = value.trim();
  if (!hasSafeInternalRedirectShape(path)) {
    return null;
  }

  try {
    return hasSafeInternalRedirectShape(decodeURIComponent(path)) ? path : null;
  } catch {
    return null;
  }
}
