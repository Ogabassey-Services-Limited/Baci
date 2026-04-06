import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react-native';

type AuthStoreSnapshot = {
  merchantId: string | null;
  user: { id: string } | null;
};

type AuthStoreSelector = (state: AuthStoreSnapshot) => unknown;

const mockNotificationListenerRemove = jest.fn();
const mockResponseListenerRemove = jest.fn();
const mockRegisterForPushNotifications =
  jest.fn<() => Promise<string | null>>();
const mockRemovePushTokenFromServer =
  jest.fn<(token: string) => Promise<boolean>>();
const mockSavePushTokenToServer =
  jest.fn<
    (token: string, userId: string, merchantId?: string) => Promise<boolean>
  >();

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
  },
}));

jest.mock('expo-notifications', () => ({
  addNotificationReceivedListener: jest.fn(() => ({
    remove: mockNotificationListenerRemove,
  })),
  addNotificationResponseReceivedListener: jest.fn(() => ({
    remove: mockResponseListenerRemove,
  })),
  getLastNotificationResponseAsync: jest
    .fn<() => Promise<null>>()
    .mockResolvedValue(null),
}));

jest.mock('@/services/push-notifications', () => ({
  clearBadge: jest.fn(),
  handleNotificationResponse: jest.fn(),
  registerForPushNotifications: mockRegisterForPushNotifications,
  removePushTokenFromServer: mockRemovePushTokenFromServer,
  savePushTokenToServer: mockSavePushTokenToServer,
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: jest.fn(),
}));

const mockedUseAuthStore = (
  jest.requireMock('@/stores/auth-store') as {
    useAuthStore: jest.MockedFunction<(selector: AuthStoreSelector) => unknown>;
  }
).useAuthStore;

const { usePushNotifications } =
  require('./use-push-notifications') as typeof import('./use-push-notifications');

describe('usePushNotifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseAuthStore.mockImplementation((selector) =>
      selector({
        merchantId: 'merchant-1',
        user: { id: 'user-1' },
      })
    );
    mockRegisterForPushNotifications.mockResolvedValue(
      'ExponentPushToken[fresh]'
    );
    mockSavePushTokenToServer.mockResolvedValue(true);
    mockRemovePushTokenFromServer.mockResolvedValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('saves a freshly acquired token with explicit user and merchant ids', async () => {
    const { result } = renderHook(() => usePushNotifications());

    await act(async () => {
      await result.current.register('user-1', 'merchant-1');
    });

    await waitFor(() => {
      expect(mockSavePushTokenToServer).toHaveBeenCalledWith(
        'ExponentPushToken[fresh]',
        'user-1',
        'merchant-1'
      );
    });

    expect(result.current.isRegistered).toBe(true);
    expect(result.current.registeredUserId).toBe('user-1');
    expect(result.current.error).toBe(null);
    expect(result.current.pushToken).toBe('ExponentPushToken[fresh]');
  });

  it('keeps the hook unregistered when token acquisition fails', async () => {
    mockRegisterForPushNotifications.mockResolvedValue(null);

    const { result } = renderHook(() => usePushNotifications());

    await act(async () => {
      await result.current.register('user-1', 'merchant-1');
    });

    expect(mockSavePushTokenToServer).not.toHaveBeenCalled();
    expect(result.current.isRegistered).toBe(false);
    expect(result.current.registeredUserId).toBe(null);
    expect(result.current.error).toBe('Failed to get push token');
    expect(result.current.pushToken).toBe(null);
  });

  it('keeps the hook unregistered when saving the token to the server fails', async () => {
    mockSavePushTokenToServer.mockResolvedValue(false);

    const { result } = renderHook(() => usePushNotifications());

    await act(async () => {
      await result.current.register('user-1', 'merchant-1');
    });

    await waitFor(() => {
      expect(mockSavePushTokenToServer).toHaveBeenCalledWith(
        'ExponentPushToken[fresh]',
        'user-1',
        'merchant-1'
      );
    });

    expect(result.current.isRegistered).toBe(false);
    expect(result.current.registeredUserId).toBe(null);
    expect(result.current.error).toBe('Failed to register token with server');
    expect(result.current.pushToken).toBe('ExponentPushToken[fresh]');
  });

  it('treats registration as user-scoped when the signed-in user changes', async () => {
    const { result, rerender } = renderHook(() => usePushNotifications());

    await act(async () => {
      await result.current.register('user-1', 'merchant-1');
    });

    mockedUseAuthStore.mockImplementation((selector) =>
      selector({
        merchantId: 'merchant-1',
        user: { id: 'user-2' },
      })
    );

    rerender(undefined);

    expect(result.current.registeredUserId).toBe('user-1');
    expect(result.current.isRegistered).toBe(false);
  });
});
