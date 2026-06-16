import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect, useRef } from 'react';

type TabRoute = BottomTabBarProps['state']['routes'][number];

type WarmAdminTabScreensOptions = {
  activeRouteName: string;
  navigation: BottomTabBarProps['navigation'];
  routes: TabRoute[];
};

function createPreloadTabAction(name: string, params: TabRoute['params']) {
  return {
    payload: { name, params },
    type: 'PRELOAD',
  };
}

function scheduleWarmAdminTabBatch(callback: () => void) {
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

function shouldWarmAdminTabRoute(
  route: TabRoute,
  activeRouteName: string,
  warmedRouteKeys: Set<string>
) {
  return route.name !== activeRouteName && !warmedRouteKeys.has(route.key);
}

export function useWarmAdminTabScreens({
  activeRouteName,
  navigation,
  routes,
}: WarmAdminTabScreensOptions) {
  const warmedRouteKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const routesToWarm = routes.filter((route) =>
      shouldWarmAdminTabRoute(
        route,
        activeRouteName,
        warmedRouteKeysRef.current
      )
    );

    if (routesToWarm.length === 0) {
      return;
    }

    return scheduleWarmAdminTabBatch(() => {
      routesToWarm.forEach((route) => {
        warmedRouteKeysRef.current.add(route.key);
        navigation.dispatch(createPreloadTabAction(route.name, route.params));
      });
    });
  }, [activeRouteName, navigation, routes]);
}
