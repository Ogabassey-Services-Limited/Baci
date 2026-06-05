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

let lastResumableHref: Href | null = null;

function getLastResumableHref(): Href | null {
  return lastResumableHref;
}

function setLastResumableHref(href: Href) {
  lastResumableHref = href;
}

function clearRouteResumeState() {
  lastResumableHref = null;
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
  const hasAttemptedResumeRef = useRef(false);
  const currentResumeHref = buildResumeHref(pathname, searchParams);

  useEffect(() => {
    if (
      !shouldResume ||
      hasAttemptedResumeRef.current ||
      !navigationState?.key
    ) {
      return;
    }

    hasAttemptedResumeRef.current = true;
    const resumeHref = getLastResumableHref();
    if (isHomePath(pathname) && resumeHref) {
      try {
        router.replace(resumeHref);
      } catch (error) {
        console.warn(
          '[RouteResumeController] Failed to restore the previous commerce route',
          error
        );
      }
    }
  }, [navigationState?.key, pathname, shouldResume]);

  useEffect(() => {
    if (currentResumeHref) {
      setLastResumableHref(currentResumeHref);
      return;
    }

    // Clear saved resume state once it is no longer usable, so old checkout
    // routes cannot resurface after intentional home navigation.
    if (!shouldResume || hasAttemptedResumeRef.current) {
      clearRouteResumeState();
    }
  }, [currentResumeHref, shouldResume]);

  return null;
}
