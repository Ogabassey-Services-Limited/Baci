import {
  type Href,
  router,
  useGlobalSearchParams,
  usePathname,
  useRootNavigationState,
} from 'expo-router';
import { useEffect, useRef } from 'react';

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
const AUTH_ROUTE_PREFIX = '/auth';

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

function setLastResumableHref(
  href: Href,
  navigationKey: string | null | undefined
) {
  lastResumableHref = href;
  lastResumableNavigationKey = navigationKey ?? null;
  didControllerUnmountSinceCapture = false;
}

function clearRouteResumeState() {
  lastResumableHref = null;
  lastResumableNavigationKey = null;
  didControllerUnmountSinceCapture = false;
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

function buildResumeHref(
  pathname: string | null | undefined,
  params: RouteSearchParams
): Href | null {
  if (!isResumablePath(pathname)) {
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

export function resetRouteResumeForTest() {
  if (process.env.NODE_ENV === 'test') {
    clearRouteResumeState();
  }
}

if (process.env.NODE_ENV === 'development') {
  const hotModule = module as {
    hot?: { dispose(callback: () => void): void };
  };
  hotModule.hot?.dispose(clearRouteResumeState);
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
  }, [navigationKey, pathname, shouldResume]);

  useEffect(() => {
    if (currentResumeHref) {
      setLastResumableHref(currentResumeHref, navigationKey);
      hasAttemptedResumeRef.current = false;
      return;
    }

    if (isAuthPath(pathname)) {
      return;
    }

    // Clear saved resume state once it is no longer usable, while preserving it
    // through auth routes used by checkout/payment sign-in flows.
    if (!shouldResume || hasAttemptedResumeRef.current) {
      clearRouteResumeState();
      return;
    }

    if (!navigationKey) {
      return;
    }

    if (pathname) {
      clearRouteResumeState();
    }
  }, [currentResumeHref, navigationKey, pathname, shouldResume]);

  return null;
}
