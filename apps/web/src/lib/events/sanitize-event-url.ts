function sanitizeFallbackUrl(value: string): string {
  const withoutQueryOrFragment = value.split(/[?#]/, 1)[0] ?? '';
  return withoutQueryOrFragment.replace(
    /^((?:[a-z][a-z\d+.-]*:)?\/\/)[^/]*@/i,
    '$1'
  );
}

export function sanitizeEventUrl(value: string): string {
  if (value.startsWith('//')) {
    try {
      const url = new URL(value, 'https://event-url.invalid');
      url.username = '';
      url.password = '';
      url.hash = '';
      url.search = '';
      return `//${url.host}${url.pathname}`;
    } catch {
      return sanitizeFallbackUrl(value);
    }
  }

  try {
    const url = new URL(value);
    url.username = '';
    url.password = '';
    url.hash = '';
    url.search = '';
    return url.toString();
  } catch {
    return sanitizeFallbackUrl(value);
  }
}
