const DEFAULT_API_BASE_URL = 'https://usebaci.com';

export function resolveApiBaseUrl(configuredUrl?: string | null): string {
  const candidate = configuredUrl?.trim() || DEFAULT_API_BASE_URL;

  try {
    const parsed = new URL(candidate);

    if (
      parsed.hostname.endsWith('.usebaci.com') &&
      parsed.hostname !== 'usebaci.com'
    ) {
      return DEFAULT_API_BASE_URL;
    }

    parsed.pathname = '';
    parsed.search = '';
    parsed.hash = '';

    return parsed.toString().replace(/\/$/, '');
  } catch {
    return DEFAULT_API_BASE_URL;
  }
}
