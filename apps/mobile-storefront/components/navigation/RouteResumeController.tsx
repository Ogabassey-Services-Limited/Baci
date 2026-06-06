import {
  type Href,
  router,
  useGlobalSearchParams,
  usePathname,
  useRootNavigationState,
} from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { asyncStorage } from '@/lib/storage';

type RouteSearchParams = Record<string, string | string[] | undefined>;

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

function getLastResumableHref(): Href | null {
  return lastResumableHref;
}

function getLastResumableNavigationKey(): string | null {
  return lastResumableNavigationKey;
}

function hasControllerUnmountedSinceCapture(): boolean {
  return didControllerUnmountSinceCapture;
}

async function setLastResumableHref(
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

async function clearRouteResumeState() {
  lastResumableHref = null;
  lastResumableNavigationKey = null;
  didControllerUnmountSinceCapture = false;
  await asyncStorage.removeItem(ROUTE_RESUME_STORAGE_KEY);
}

function isHomePath(pathname: string | null | undefined): boolean {
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

function isAuthPath(pathname: string | null | undefined): boolean {
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

async function hydrateRouteResumeState() {
  const persistedState = parsePersistedRouteResumeState(
    await asyncStorage.getItem(ROUTE_RESUME_STORAGE_KEY)
  );

  if (!persistedState) {
    return;
  }

  lastResumableHref = persistedState.href as Href;
  lastResumableNavigationKey = persistedState.navigationKey;
}

function buildResumeHref(
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

function buildPersistableResumeHref(
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

interface RouteResumeControllerProps {
  shouldResume: boolean;
}

export function RouteResumeController({
  shouldResume,
}: RouteResumeControllerProps) {
  const pathname = usePathname();
  const searchParams = useGlobalSearchParams() as RouteSearchParams;
  const navigationState = useRootNavigationState();
  const navigationKey = navigationState?.key ?? null;
  const hasAttemptedResumeRef = useRef(false);
  const currentResumeHref = buildResumeHref(pathname, searchParams);
  const currentPersistableResumeHref = buildPersistableResumeHref(
    pathname,
    searchParams
  );
  const [hasHydratedPersistedResume, setHasHydratedPersistedResume] =
    useState(false);

  useEffect(() => {
    let isActive = true;

    hydrateRouteResumeState()
      .catch((error) => {
        console.warn(
          '[RouteResumeController] Failed to hydrate route resume state',
          error
        );
      })
      .finally(() => {
        if (isActive) {
          setHasHydratedPersistedResume(true);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (getLastResumableHref()) {
        didControllerUnmountSinceCapture = true;
      }
    };
  }, []);

  useEffect(() => {
    if (
      !shouldResume ||
      hasAttemptedResumeRef.current ||
      (!hasHydratedPersistedResume && !getLastResumableHref()) ||
      !navigationKey
    ) {
      return;
    }

    const resumeHref = getLastResumableHref();
    const savedNavigationKey = getLastResumableNavigationKey();
    const shouldResumeFromHome =
      isHomePath(pathname) &&
      resumeHref &&
      (hasControllerUnmountedSinceCapture() ||
        (savedNavigationKey !== null && savedNavigationKey !== navigationKey));

    if (shouldResumeFromHome) {
      hasAttemptedResumeRef.current = true;
      try {
        router.replace(resumeHref);
      } catch (error) {
        console.warn(
          '[RouteResumeController] Failed to restore the previous commerce route',
          error
        );
      }
    }
  }, [hasHydratedPersistedResume, navigationKey, pathname, shouldResume]);

  useEffect(() => {
    let isActive = true;

    const syncRouteResumeState = async () => {
      if (currentResumeHref) {
        await setLastResumableHref(
          currentResumeHref,
          navigationKey,
          currentPersistableResumeHref
        );
        if (isActive) {
          hasAttemptedResumeRef.current = false;
        }
        return;
      }

      if (
        isHomePath(pathname) &&
        getLastResumableHref() &&
        getLastResumableNavigationKey() === navigationKey &&
        !hasControllerUnmountedSinceCapture()
      ) {
        await clearRouteResumeState();
        return;
      }

      if (!hasHydratedPersistedResume) {
        return;
      }

      if (isAuthPath(pathname)) {
        return;
      }

      // Clear saved resume state once it is no longer usable, while preserving it
      // through auth routes used by checkout/payment sign-in flows.
      if (!shouldResume || hasAttemptedResumeRef.current) {
        await clearRouteResumeState();
        return;
      }

      if (!navigationKey) {
        return;
      }

      if (pathname) {
        await clearRouteResumeState();
      }
    };

    void syncRouteResumeState().catch((error) => {
      console.warn(
        '[RouteResumeController] Failed to sync route resume state',
        error
      );
    });

    return () => {
      isActive = false;
    };
  }, [
    currentResumeHref,
    currentPersistableResumeHref,
    hasHydratedPersistedResume,
    navigationKey,
    pathname,
    shouldResume,
  ]);

  return null;
}
