import { AppState } from 'react-native';
import { registerAuthRefreshLifecycle } from './auth-refresh-lifecycle';

const mockAppState = {
  addEventListener: AppState.addEventListener as jest.Mock,
  currentState: 'active',
  remove: jest.fn(),
};

jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn(() => ({
      remove: mockAppState.remove,
    })),
    get currentState() {
      return mockAppState.currentState;
    },
  },
}));

describe('registerAuthRefreshLifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAppState.currentState = 'active';
    mockAppState.addEventListener.mockReturnValue({
      remove: mockAppState.remove,
    });
  });

  it('starts auto refresh immediately when the app is already active', () => {
    const auth = {
      startAutoRefresh: jest.fn(),
      stopAutoRefresh: jest.fn(),
    };

    const cleanup = registerAuthRefreshLifecycle(auth);

    expect(auth.startAutoRefresh).toHaveBeenCalledTimes(1);
    expect(auth.stopAutoRefresh).not.toHaveBeenCalled();
    cleanup();
  });

  it('stops auto refresh immediately when the app starts inactive', () => {
    mockAppState.currentState = 'background';
    const auth = {
      startAutoRefresh: jest.fn(),
      stopAutoRefresh: jest.fn(),
    };

    const cleanup = registerAuthRefreshLifecycle(auth);

    expect(auth.stopAutoRefresh).toHaveBeenCalledTimes(1);
    expect(auth.startAutoRefresh).not.toHaveBeenCalled();
    cleanup();
  });

  it('handles active/background transitions and cleanup', () => {
    const auth = {
      startAutoRefresh: jest.fn(),
      stopAutoRefresh: jest.fn(),
    };

    const cleanup = registerAuthRefreshLifecycle(auth);
    const listener = mockAppState.addEventListener.mock.calls[0]?.[1];

    listener('background');
    listener('inactive');
    listener('active');
    cleanup();

    expect(auth.stopAutoRefresh).toHaveBeenCalledTimes(3);
    expect(auth.startAutoRefresh).toHaveBeenCalledTimes(2);
    expect(mockAppState.remove).toHaveBeenCalledTimes(1);
  });

  it('registers only once for duplicate calls', () => {
    const auth = {
      startAutoRefresh: jest.fn(),
      stopAutoRefresh: jest.fn(),
    };

    const cleanupA = registerAuthRefreshLifecycle(auth);
    const cleanupB = registerAuthRefreshLifecycle(auth);
    cleanupA();
    cleanupB();

    expect(mockAppState.addEventListener).toHaveBeenCalledTimes(1);
    expect(mockAppState.remove).toHaveBeenCalledTimes(1);
  });

  it('cleans up the previous lifecycle when registering a different auth controller', () => {
    const firstRemove = jest.fn();
    const secondRemove = jest.fn();
    mockAppState.addEventListener
      .mockReturnValueOnce({ remove: firstRemove })
      .mockReturnValueOnce({ remove: secondRemove });
    const authA = {
      startAutoRefresh: jest.fn(),
      stopAutoRefresh: jest.fn(),
    };
    const authB = {
      startAutoRefresh: jest.fn(),
      stopAutoRefresh: jest.fn(),
    };

    const cleanupA = registerAuthRefreshLifecycle(authA);
    const cleanupB = registerAuthRefreshLifecycle(authB);

    expect(firstRemove).toHaveBeenCalledTimes(1);
    expect(authA.stopAutoRefresh).toHaveBeenCalledTimes(1);
    expect(mockAppState.addEventListener).toHaveBeenCalledTimes(2);

    cleanupA();
    cleanupB();

    expect(firstRemove).toHaveBeenCalledTimes(1);
    expect(secondRemove).toHaveBeenCalledTimes(1);
    expect(authB.stopAutoRefresh).toHaveBeenCalledTimes(1);
  });

  it('does not crash when a partial React Native mock omits AppState', () => {
    jest.isolateModules(() => {
      jest.doMock('react-native', () => ({
        AppState: undefined,
      }));
      const lifecycle = require('./auth-refresh-lifecycle') as typeof import('./auth-refresh-lifecycle');
      const auth = {
        startAutoRefresh: jest.fn(),
        stopAutoRefresh: jest.fn(),
      };

      const cleanup = lifecycle.registerAuthRefreshLifecycle(auth);
      cleanup();

      expect(auth.startAutoRefresh).toHaveBeenCalledTimes(1);
      expect(auth.stopAutoRefresh).toHaveBeenCalledTimes(1);
    });
  });
});
