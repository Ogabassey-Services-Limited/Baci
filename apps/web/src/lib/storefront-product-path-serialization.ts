/** Normalizes one generated public path segment without double encoding it. */
export function serializeStorefrontProductPathSegment(value: string): string {
  const trimmed = value.trim();

  try {
    return encodeURIComponent(decodeURIComponent(trimmed));
  } catch {
    return encodeURIComponent(trimmed);
  }
}

export function serializeStorefrontProductPath(path: string): string {
  const normalizedPath = path.replace(/\/+$/, '') || '/';

  return normalizedPath
    .split('/')
    .map((segment, index) =>
      index === 0 ? segment : serializeStorefrontProductPathSegment(segment)
    )
    .join('/');
}

export function serializeStorefrontProductUrl(url: string): string {
  try {
    const parsedUrl = new URL(url);
    return `${parsedUrl.origin}${serializeStorefrontProductPath(parsedUrl.pathname)}`;
  } catch {
    return serializeStorefrontProductPath(url);
  }
}
