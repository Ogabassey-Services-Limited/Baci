function getPathnamePart(path: string): string {
  const searchIndex = path.search(/[?#]/);
  return searchIndex === -1 ? path : path.slice(0, searchIndex);
}

function hasDotPathSegment(path: string): boolean {
  return getPathnamePart(path)
    .split('/')
    .some((segment) => segment === '.' || segment === '..');
}

function hasSafeInternalRedirectShape(path: string): boolean {
  return (
    path.startsWith('/') &&
    !path.startsWith('//') &&
    !path.startsWith('/\\') &&
    !path.includes(':') &&
    !hasDotPathSegment(path)
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
