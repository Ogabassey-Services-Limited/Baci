import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerAuthRefreshLifecycle } from './auth-refresh-lifecycle';

const appStateMocks = vi.hoisted(() => ({
  addEventListener: vi.fn(),
  currentState: 'active',
  remove: vi.fn(),
}));

vi.mock('react-native', () => ({
  AppState: {
    addEventListener: appStateMocks.addEventListener,
    get currentState() {
      return appStateMocks.currentState;
    },
  },
}));

describe('registerAuthRefreshLifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appStateMocks.currentState = 'active';
    appStateMocks.addEventListener.mockReturnValue({
      remove: appStateMocks.remove,
    });
  });

  it('starts auto refresh immediately when the app is already active', () => {
    const auth = {
      startAutoRefresh: vi.fn(),
      stopAutoRefresh: vi.fn(),
    };

    const cleanup = registerAuthRefreshLifecycle(auth);

    expect(auth.startAutoRefresh).toHaveBeenCalledTimes(1);
    expect(auth.stopAutoRefresh).not.toHaveBeenCalled();
    cleanup();
  });

  it('stops auto refresh immediately when the app starts inactive', () => {
    appStateMocks.currentState = 'background';
    const auth = {
      startAutoRefresh: vi.fn(),
      stopAutoRefresh: vi.fn(),
    };

    const cleanup = registerAuthRefreshLifecycle(auth);

    expect(auth.stopAutoRefresh).toHaveBeenCalledTimes(1);
    expect(auth.startAutoRefresh).not.toHaveBeenCalled();
    cleanup();
  });

  it('handles active/background transitions and cleanup', () => {
    const auth = {
      startAutoRefresh: vi.fn(),
      stopAutoRefresh: vi.fn(),
    };

    const cleanup = registerAuthRefreshLifecycle(auth);
    const listener = appStateMocks.addEventListener.mock.calls[0]?.[1];

    listener('background');
    listener('inactive');
    listener('active');
    cleanup();

    expect(auth.stopAutoRefresh).toHaveBeenCalledTimes(3);
    expect(auth.startAutoRefresh).toHaveBeenCalledTimes(2);
    expect(appStateMocks.remove).toHaveBeenCalledTimes(1);
  });

  it('registers only once for duplicate calls', () => {
    const auth = {
      startAutoRefresh: vi.fn(),
      stopAutoRefresh: vi.fn(),
    };

    const cleanupA = registerAuthRefreshLifecycle(auth);
    const cleanupB = registerAuthRefreshLifecycle(auth);
    cleanupA();
    cleanupB();

    expect(appStateMocks.addEventListener).toHaveBeenCalledTimes(1);
    expect(appStateMocks.remove).toHaveBeenCalledTimes(1);
  });

  it('tears down the previous listener before registering a different auth instance', () => {
    const removeA = vi.fn();
    const removeB = vi.fn();
    appStateMocks.addEventListener
      .mockReturnValueOnce({ remove: removeA })
      .mockReturnValueOnce({ remove: removeB });
    const authA = {
      startAutoRefresh: vi.fn(),
      stopAutoRefresh: vi.fn(),
    };
    const authB = {
      startAutoRefresh: vi.fn(),
      stopAutoRefresh: vi.fn(),
    };

    const cleanupA = registerAuthRefreshLifecycle(authA);
    const cleanupB = registerAuthRefreshLifecycle(authB);
    cleanupA();
    cleanupB();

    expect(appStateMocks.addEventListener).toHaveBeenCalledTimes(2);
    expect(authA.stopAutoRefresh).toHaveBeenCalledTimes(1);
    expect(removeA).toHaveBeenCalledTimes(1);
    expect(removeB).toHaveBeenCalledTimes(1);
  });
});
