import type { Href } from 'expo-router';
import { asyncStorage } from '@/lib/storage';

export type RouteSearchParams = Record<string, string | string[] | undefined>;

const HOME_PATHS = new Set(['/', '/(tabs)', '/(tabs)/', '/(tabs)/index']);
const RESUMABLE_ROUTE_PREFIXES = [
  '/cart',
  '/checkout',
  '/payment-gateway',
  '/bank-transfer',
  '/crypto-payment',
  '/bnpl-checkout',
] as const;
const PERSISTABLE_ROUTE_PREFIXES = ['/cart', '/checkout'] as const;
const AUTH_ROUTE_PREFIX = '/auth';
const ROUTE_RESUME_STORAGE_KEY = 'route-resume-state';
const ROUTE_RESUME_TTL_MS = 30 * 60 * 1000;
const ROUTE_RESUME_URL_BASE = 'https://baci.local';

interface PersistedRouteResumeState {
  href: string;
  navigationKey: string | null;
  savedAt: number;
}

let lastResumableHref: Href | null = null;
let lastResumableNavigationKey: string | null = null;
let didControllerUnmountSinceCapture = false;

export function getLastResumableHref(): Href | null {
  return lastResumableHref;
}

export function getLastResumableNavigationKey(): string | null {
  return lastResumableNavigationKey;
}

export function hasControllerUnmountedSinceCapture(): boolean {
  return didControllerUnmountSinceCapture;
}

export function markControllerUnmountedSinceCapture() {
  didControllerUnmountSinceCapture = true;
}

export async function setLastResumableHref(
  href: Href,
  navigationKey: string | null | undefined,
  persistableHref: Href | null
) {
  lastResumableHref = href;
  lastResumableNavigationKey = navigationKey ?? null;
  didControllerUnmountSinceCapture = false;
  if (persistableHref) {
    await persistRouteResumeState(persistableHref, navigationKey ?? null);
  } else {
    await asyncStorage.removeItem(ROUTE_RESUME_STORAGE_KEY);
  }
}

export async function clearRouteResumeState() {
  lastResumableHref = null;
  lastResumableNavigationKey = null;
  didControllerUnmountSinceCapture = false;
  await asyncStorage.removeItem(ROUTE_RESUME_STORAGE_KEY);
}

export function isHomePath(pathname: string | null | undefined): boolean {
  return pathname ? HOME_PATHS.has(pathname) : false;
}

function isResumablePath(pathname: string | null | undefined): boolean {
  if (!pathname || isHomePath(pathname)) {
    return false;
  }

  return RESUMABLE_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function isAuthPath(pathname: string | null | undefined): boolean {
  return Boolean(
    pathname &&
      (pathname === AUTH_ROUTE_PREFIX ||
        pathname.startsWith(`${AUTH_ROUTE_PREFIX}/`))
  );
}

function isPersistablePath(pathname: string | null | undefined): boolean {
  if (!pathname || isHomePath(pathname)) {
    return false;
  }

  return PERSISTABLE_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function getSingleParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

function isResumableReturnToPath(value: string | null): boolean {
  if (!value) {
    return false;
  }

  try {
    const decodedValue = decodeURIComponent(value);
    return isResumablePath(decodedValue);
  } catch {
    return false;
  }
}

function isResumableAuthPath(
  pathname: string | null | undefined,
  params: RouteSearchParams
): boolean {
  return (
    isAuthPath(pathname) &&
    getSingleParam(params.mode) === 'otp' &&
    isResumableReturnToPath(getSingleParam(params.returnTo))
  );
}

function parsePersistedRouteResumeState(
  rawValue: string | null
): PersistedRouteResumeState | null {
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<PersistedRouteResumeState>;
    if (
      typeof parsed.href !== 'string' ||
      typeof parsed.savedAt !== 'number' ||
      Date.now() - parsed.savedAt > ROUTE_RESUME_TTL_MS ||
      !isPersistedResumeHrefAllowed(parsed.href)
    ) {
      return null;
    }

    return {
      href: parsed.href,
      navigationKey:
        typeof parsed.navigationKey === 'string' ? parsed.navigationKey : null,
      savedAt: parsed.savedAt,
    };
  } catch {
    return null;
  }
}

function isPersistedResumeHrefAllowed(href: string): boolean {
  try {
    const parsedUrl = new URL(href, ROUTE_RESUME_URL_BASE);
    if (parsedUrl.origin !== ROUTE_RESUME_URL_BASE) {
      return false;
    }

    if (isPersistablePath(parsedUrl.pathname)) {
      return true;
    }

    if (!isAuthPath(parsedUrl.pathname)) {
      return false;
    }

    return (
      parsedUrl.searchParams.get('mode') === 'otp' &&
      isResumableReturnToPath(parsedUrl.searchParams.get('returnTo'))
    );
  } catch {
    return false;
  }
}

async function persistRouteResumeState(
  href: Href,
  navigationKey: string | null
) {
  await asyncStorage.setItem(
    ROUTE_RESUME_STORAGE_KEY,
    JSON.stringify({
      href: String(href),
      navigationKey,
      savedAt: Date.now(),
    } satisfies PersistedRouteResumeState)
  );
}

export async function hydrateRouteResumeState() {
  const persistedState = parsePersistedRouteResumeState(
    await asyncStorage.getItem(ROUTE_RESUME_STORAGE_KEY)
  );

  if (!persistedState) {
    return;
  }

  lastResumableHref = persistedState.href as Href;
  lastResumableNavigationKey = persistedState.navigationKey;
}

export function buildResumeHref(
  pathname: string | null | undefined,
  params: RouteSearchParams
): Href | null {
  if (!isResumablePath(pathname) && !isResumableAuthPath(pathname, params)) {
    return null;
  }

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        query.append(key, item);
      }
      continue;
    }

    query.set(key, value);
  }

  const queryString = query.toString();
  return (queryString ? `${pathname}?${queryString}` : pathname) as Href;
}

export function buildPersistableResumeHref(
  pathname: string | null | undefined,
  params: RouteSearchParams
): Href | null {
  if (isPersistablePath(pathname)) {
    return buildResumeHref(pathname, params);
  }

  if (!isResumableAuthPath(pathname, params)) {
    return null;
  }

  const returnTo = getSingleParam(params.returnTo);
  if (!returnTo) {
    return null;
  }

  const query = new URLSearchParams({
    mode: 'otp',
    returnTo,
  });
  return `${pathname}?${query.toString()}` as Href;
}

export function resetRouteResumeForTest() {
  if (process.env.NODE_ENV === 'test') {
    void clearRouteResumeState();
  }
}

export function resetRouteResumeMemoryForTest() {
  if (process.env.NODE_ENV === 'test') {
    lastResumableHref = null;
    lastResumableNavigationKey = null;
    didControllerUnmountSinceCapture = false;
  }
}

if (process.env.NODE_ENV === 'development') {
  const hotModule = module as {
    hot?: { dispose(callback: () => void): void };
  };
  hotModule.hot?.dispose(() => {
    void clearRouteResumeState();
  });
}
