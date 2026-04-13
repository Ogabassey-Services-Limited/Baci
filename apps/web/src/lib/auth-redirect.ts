import { getAppUrl } from '@/env';

export const DEFAULT_AUTH_REDIRECT_PATH = '/dashboard';

const LEGACY_PATH_ALIASES: Record<string, string> = {
  '/auth/update-password': '/update-password',
};

function applyLegacyAlias(path: string): string {
  const url = new URL(path, 'https://usebaci.local');
  const pathname = LEGACY_PATH_ALIASES[url.pathname] ?? url.pathname;
  return `${pathname}${url.search}${url.hash}`;
}

export function sanitizeRelativeRedirectPath(
  rawRedirect: string | null | undefined,
  defaultPath = DEFAULT_AUTH_REDIRECT_PATH
): string {
  if (!rawRedirect) {
    return defaultPath;
  }

  if (
    !rawRedirect.startsWith('/') ||
    rawRedirect.startsWith('//') ||
    /^[a-z][a-z0-9+.-]*:/i.test(rawRedirect)
  ) {
    return defaultPath;
  }

  try {
    return applyLegacyAlias(rawRedirect);
  } catch {
    return defaultPath;
  }
}

export function normalizeAuthNextTarget(
  rawNext: string | null | undefined,
  origin: string,
  defaultPath = DEFAULT_AUTH_REDIRECT_PATH
): string {
  if (!rawNext) {
    return defaultPath;
  }

  // `baciadmin://` is an app deep-link passthrough for the mobile client.
  // We intentionally return rawNext here because the mobile app performs its
  // own route validation before any sensitive action is taken server-side.
  if (rawNext.startsWith('baciadmin://')) {
    return rawNext;
  }

  try {
    const absoluteUrl = new URL(rawNext);

    if (absoluteUrl.origin !== origin) {
      return defaultPath;
    }

    return sanitizeRelativeRedirectPath(
      `${absoluteUrl.pathname}${absoluteUrl.search}${absoluteUrl.hash}`,
      defaultPath
    );
  } catch {
    return sanitizeRelativeRedirectPath(rawNext, defaultPath);
  }
}

export function buildAuthConfirmRedirectUrl(nextPath: string): string {
  const appUrl = getAppUrl();
  const url = new URL('/auth/confirm', appUrl);
  const next = /^[a-z][a-z0-9+.-]*:\/\//i.test(nextPath)
    ? normalizeAuthNextTarget(nextPath, url.origin)
    : sanitizeRelativeRedirectPath(nextPath);

  url.searchParams.set('next', next);
  return url.toString();
}

export function buildAbsoluteAppRedirectUrl(nextPath: string): string {
  return new URL(
    sanitizeRelativeRedirectPath(nextPath),
    getAppUrl()
  ).toString();
}
