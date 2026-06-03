import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { CommonActions } from '@react-navigation/native';
import { useEffect, useRef } from 'react';

const PROTECTED_TAB_ROUTE_NAMES = new Set(['wallet', 'account']);

type TabRoute = BottomTabBarProps['state']['routes'][number];
type WarmTabScreensOptions = {
  activeRouteName: string;
  navigation: BottomTabBarProps['navigation'];
  preloadProtectedTabs: boolean;
  routes: TabRoute[];
};

function scheduleWarmTabBatch(callback: () => void) {
  const frameIds: number[] = [];
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let cancelled = false;

  const run = () => {
    if (cancelled) {
      return;
    }
    timeoutId = setTimeout(callback, 0);
  };

  if (typeof globalThis.requestAnimationFrame !== 'function') {
    run();
    return () => {
      cancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }

  const firstFrame = globalThis.requestAnimationFrame(() => {
    const secondFrame = globalThis.requestAnimationFrame(run);
    frameIds.push(secondFrame);
  });
  frameIds.push(firstFrame);

  return () => {
    cancelled = true;
    frameIds.forEach((frameId) => {
      globalThis.cancelAnimationFrame?.(frameId);
    });
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  };
}

function shouldWarmTabRoute(
  route: TabRoute,
  activeRouteName: string,
  preloadProtectedTabs: boolean,
  warmedRouteKeys: Set<string>
) {
  if (route.name === activeRouteName || warmedRouteKeys.has(route.key)) {
    return false;
  }

  return preloadProtectedTabs || !PROTECTED_TAB_ROUTE_NAMES.has(route.name);
}

export function useWarmTabScreens({
  activeRouteName,
  navigation,
  preloadProtectedTabs,
  routes,
}: WarmTabScreensOptions) {
  const warmedRouteKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const routesToWarm = routes.filter((route) =>
      shouldWarmTabRoute(
        route,
        activeRouteName,
        preloadProtectedTabs,
        warmedRouteKeysRef.current
      )
    );

    if (routesToWarm.length === 0) {
      return;
    }

    return scheduleWarmTabBatch(() => {
      routesToWarm.forEach((route) => {
        warmedRouteKeysRef.current.add(route.key);
        navigation.dispatch(CommonActions.preload(route.name, route.params));
      });
    });
  }, [activeRouteName, navigation, preloadProtectedTabs, routes]);
}
