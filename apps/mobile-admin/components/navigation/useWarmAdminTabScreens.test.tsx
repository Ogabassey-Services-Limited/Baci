import { render } from '@testing-library/react';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWarmAdminTabScreens } from './useWarmAdminTabScreens';

type TabRoute = BottomTabBarProps['state']['routes'][number];

function TestHarness({
  activeRouteName,
  dispatch,
  routes,
}: {
  activeRouteName: string;
  dispatch: BottomTabBarProps['navigation']['dispatch'];
  routes: TabRoute[];
}) {
  useWarmAdminTabScreens({
    activeRouteName,
    navigation: { dispatch } as BottomTabBarProps['navigation'],
    routes,
  });

  return null;
}

function createRoutes(): TabRoute[] {
  return [
    { key: 'index-key', name: 'index', params: {} },
    { key: 'orders-key', name: 'orders', params: { status: 'open' } },
    { key: 'products-key', name: 'products', params: {} },
  ] as TabRoute[];
}

describe('useWarmAdminTabScreens', () => {
  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
  const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;
  let frameCallbacks: FrameRequestCallback[];

  const flushAnimationFrameBatch = (timestamp: number) => {
    frameCallbacks.splice(0).forEach((callback) => {
      callback(timestamp);
    });
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    frameCallbacks = [];
    globalThis.requestAnimationFrame = vi.fn((callback) => {
      frameCallbacks.push(callback);
      return frameCallbacks.length;
    });
    globalThis.cancelAnimationFrame = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
  });

  it('preloads inactive admin tabs after the first paint settles', () => {
    const dispatch = vi.fn();

    render(
      <TestHarness
        activeRouteName="index"
        dispatch={dispatch}
        routes={createRoutes()}
      />
    );

    expect(dispatch).not.toHaveBeenCalled();

    flushAnimationFrameBatch(0);
    flushAnimationFrameBatch(16);
    vi.runOnlyPendingTimers();

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: { name: 'orders', params: { status: 'open' } },
        type: 'PRELOAD',
      })
    );
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: { name: 'products', params: {} },
        type: 'PRELOAD',
      })
    );
    expect(dispatch).toHaveBeenCalledTimes(2);
  });

  it('does not warm the active tab or already warmed route keys twice', () => {
    const dispatch = vi.fn();
    const { rerender } = render(
      <TestHarness
        activeRouteName="index"
        dispatch={dispatch}
        routes={createRoutes()}
      />
    );

    flushAnimationFrameBatch(0);
    flushAnimationFrameBatch(16);
    vi.runOnlyPendingTimers();
    expect(dispatch).toHaveBeenCalledTimes(2);

    rerender(
      <TestHarness
        activeRouteName="orders"
        dispatch={dispatch}
        routes={createRoutes()}
      />
    );

    flushAnimationFrameBatch(32);
    flushAnimationFrameBatch(48);
    vi.runOnlyPendingTimers();

    expect(dispatch).toHaveBeenCalledTimes(3);
    expect(dispatch).toHaveBeenLastCalledWith(
      expect.objectContaining({
        payload: { name: 'index', params: {} },
        type: 'PRELOAD',
      })
    );
  });
});
