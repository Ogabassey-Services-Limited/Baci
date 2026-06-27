import type { PostHogEnv } from '@/lib/posthog/config';

interface BrowserHostnameLike {
  hostname: string;
}

function normalizeTracingHostname(
  value: string | undefined
): string | undefined {
  const trimmed = value?.trim().toLowerCase();
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

    const fallback =
      trimmed.split('/')[0]?.split(':')[0]?.replace(/\.+$/, '') || undefined;
    if (!fallback) {
      return undefined;
    }

    try {
      return new URL(`https://${fallback}`).hostname.replace(/\.+$/, '');
    } catch {
      return undefined;
    }
  }
}

function isLocalOrPreviewHost(
  hostname: string,
  env: PostHogEnv = process.env
): boolean {
  const vercelEnvironment = env.NEXT_PUBLIC_VERCEL_ENV || env.VERCEL_ENV;
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.local') ||
    (hostname.endsWith('.vercel.app') && vercelEnvironment !== 'production')
  );
}

function addTracingHostname(
  hostnames: Set<string>,
  value: string | undefined,
  env: PostHogEnv
): void {
  const hostname = normalizeTracingHostname(value);
  if (!hostname || isLocalOrPreviewHost(hostname, env)) {
    return;
  }

  hostnames.add(hostname);
  if (hostname.startsWith('www.')) {
    hostnames.add(hostname.slice('www.'.length));
  }
}

export function getPostHogTracingHeaderHostnames(
  env: PostHogEnv = process.env,
  location: BrowserHostnameLike | undefined = typeof globalThis.location ===
  'undefined'
    ? undefined
    : globalThis.location
): string[] {
  const hostnames = new Set<string>();
  const rootDomain =
    normalizeTracingHostname(env.NEXT_PUBLIC_ROOT_DOMAIN) ?? 'usebaci.com';
  const canonicalRootDomain = rootDomain.startsWith('www.')
    ? rootDomain.slice('www.'.length)
    : rootDomain;

  addTracingHostname(hostnames, canonicalRootDomain, env);
  addTracingHostname(hostnames, `www.${canonicalRootDomain}`, env);
  addTracingHostname(hostnames, location?.hostname, env);

  return [...hostnames];
}
