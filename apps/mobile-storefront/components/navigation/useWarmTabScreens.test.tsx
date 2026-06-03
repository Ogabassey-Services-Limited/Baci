import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { renderHook } from '@testing-library/react-native';
import { useWarmTabScreens } from './useWarmTabScreens';

type TabRoute = BottomTabBarProps['state']['routes'][number];

function createRoute(name: string): TabRoute {
  return {
    key: `${name}-key`,
    name,
    params: {},
  };
}

function mockFrameScheduler() {
  const frameCallbacks: FrameRequestCallback[] = [];
  const requestFrameSpy = jest
    .spyOn(globalThis, 'requestAnimationFrame')
    .mockImplementation((callback) => {
      frameCallbacks.push(callback);
      return frameCallbacks.length;
    });
  const cancelFrameSpy = jest
    .spyOn(globalThis, 'cancelAnimationFrame')
    .mockImplementation(() => undefined);

  return { cancelFrameSpy, frameCallbacks, requestFrameSpy };
}

function flushFrames(frameCallbacks: FrameRequestCallback[]) {
  while (frameCallbacks.length > 0) {
    const callback = frameCallbacks.shift();
    callback?.(0);
  }
}

describe('useWarmTabScreens', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('preloads public tabs after the first tab chrome frames', () => {
    const { frameCallbacks, requestFrameSpy, cancelFrameSpy } =
      mockFrameScheduler();
    const navigation = {
      dispatch: jest.fn(),
    } as unknown as BottomTabBarProps['navigation'];

    renderHook(() =>
      useWarmTabScreens({
        activeRouteName: 'index',
        navigation,
        preloadProtectedTabs: false,
        routes: [
          createRoute('index'),
          createRoute('saved'),
          createRoute('cart'),
          createRoute('wallet'),
        ],
      })
    );

    expect(navigation.dispatch).not.toHaveBeenCalled();

    flushFrames(frameCallbacks);
    jest.runOnlyPendingTimers();

    expect(navigation.dispatch).toHaveBeenCalledTimes(2);
    expect(navigation.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: { name: 'saved', params: {} },
        type: 'PRELOAD',
      })
    );
    expect(navigation.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: { name: 'cart', params: {} },
        type: 'PRELOAD',
      })
    );

    requestFrameSpy.mockRestore();
    cancelFrameSpy.mockRestore();
  });

  it('preloads protected tabs when preloadProtectedTabs is true', () => {
    const { frameCallbacks, requestFrameSpy, cancelFrameSpy } =
      mockFrameScheduler();
    const navigation = {
      dispatch: jest.fn(),
    } as unknown as BottomTabBarProps['navigation'];

    renderHook(() =>
      useWarmTabScreens({
        activeRouteName: 'index',
        navigation,
        preloadProtectedTabs: true,
        routes: [createRoute('index'), createRoute('wallet')],
      })
    );

    flushFrames(frameCallbacks);
    jest.runOnlyPendingTimers();

    expect(navigation.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: { name: 'wallet', params: {} },
        type: 'PRELOAD',
      })
    );

    requestFrameSpy.mockRestore();
    cancelFrameSpy.mockRestore();
  });
});
