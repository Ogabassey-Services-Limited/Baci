export interface AnalyticsTracingHostnameInput {
  apiUrl?: unknown;
  merchantDomain?: unknown;
}

function normalizeTracingHostname(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return undefined;
  }

  if (/^[/?#]/.test(trimmed)) {
    return undefined;
  }

  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed);
  try {
    return new URL(hasScheme ? trimmed : `https://${trimmed}`).hostname.replace(
      /\.+$/,
      ''
    );
  } catch {
    if (hasScheme) {
      return undefined;
    }

    const candidate =
      trimmed.split('/')[0]?.split(':')[0]?.replace(/\.+$/, '') || undefined;
    if (!candidate) {
      return undefined;
    }

    try {
      return new URL(`https://${candidate}`).hostname.replace(/\.+$/, '');
    } catch {
      return undefined;
    }
  }
}

export function buildAnalyticsTracingHostnames({
  apiUrl,
  merchantDomain,
}: AnalyticsTracingHostnameInput): string[] {
  return [
    'usebaci.com',
    'www.usebaci.com',
    normalizeTracingHostname(apiUrl),
    normalizeTracingHostname(merchantDomain),
  ].filter((hostname, index, hostnames): hostname is string =>
    Boolean(hostname && hostnames.indexOf(hostname) === index)
  );
}
