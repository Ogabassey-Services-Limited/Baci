import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import type { Notification, NotificationResponse } from 'expo-notifications';
import { Platform } from 'react-native';

// Create the mocks first so they can be imported directly for assertions.
const mockGetPermissionsAsync = jest
  .fn<() => Promise<{ status: 'granted' }>>()
  .mockResolvedValue({ status: 'granted' });
const mockRequestPermissionsAsync = jest
  .fn<() => Promise<{ status: 'granted' }>>()
  .mockResolvedValue({ status: 'granted' });
const mockGetExpoPushTokenAsync = jest
  .fn<() => Promise<{ data: string }>>()
  .mockResolvedValue({ data: 'mock-token' });
const mockGetBadgeCountAsync = jest
  .fn<() => Promise<number>>()
  .mockResolvedValue(3);
const mockSetBadgeCountAsync = jest
  .fn<(count: number) => Promise<void>>()
  .mockResolvedValue(undefined);
const mockDismissAllNotificationsAsync = jest
  .fn<() => Promise<void>>()
  .mockResolvedValue(undefined);
const mockScheduleNotificationAsync = jest
  .fn<(request: unknown) => Promise<string>>()
  .mockResolvedValue('mock-id');
const mockAddNotificationResponseReceivedListener = jest
  .fn<
    (callback: (response: NotificationResponse) => void) => {
      remove: () => void;
    }
  >()
  .mockReturnValue({ remove: jest.fn<() => void>() });
const mockAddNotificationReceivedListener = jest
  .fn<
    (callback: (notification: Notification) => void) => { remove: () => void }
  >()
  .mockReturnValue({ remove: jest.fn<() => void>() });
const mockSetNotificationHandler = jest.fn<(handler: unknown) => void>();

jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      eas: {
        projectId: 'test-project-id',
      },
    },
  },
}));

let mockCurrentOS = 'web';
jest.mock('react-native', () => ({
  Platform: {
    get OS() {
      return mockCurrentOS;
    },
    set OS(val) {
      mockCurrentOS = val;
    },
  },
}));

jest.mock('./logger', () => ({
  createLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

jest.mock('./supabase', () => ({
  supabase: {
    auth: {
      getUser: jest
        .fn<() => Promise<{ data: { user: null } }>>()
        .mockResolvedValue({ data: { user: null } }),
      getSession: jest
        .fn<() => Promise<{ data: { session: null } }>>()
        .mockResolvedValue({ data: { session: null } }),
    },
  },
}));

jest.mock(
  'expo-device',
  () => ({
    isDevice: true,
  }),
  { virtual: true }
);

jest.mock(
  'expo-notifications',
  () => ({
    getPermissionsAsync: mockGetPermissionsAsync,
    requestPermissionsAsync: mockRequestPermissionsAsync,
    getExpoPushTokenAsync: mockGetExpoPushTokenAsync,
    getBadgeCountAsync: mockGetBadgeCountAsync,
    setBadgeCountAsync: mockSetBadgeCountAsync,
    dismissAllNotificationsAsync: mockDismissAllNotificationsAsync,
    scheduleNotificationAsync: mockScheduleNotificationAsync,
    addNotificationResponseReceivedListener:
      mockAddNotificationResponseReceivedListener,
    addNotificationReceivedListener: mockAddNotificationReceivedListener,
    setNotificationHandler: mockSetNotificationHandler,
  }),
  { virtual: true }
);

describe('notifications (null modules path)', () => {
  const originalOS = Platform.OS;
  let notificationsModule: typeof import('./notifications');

  beforeAll(async () => {
    Platform.OS = 'web'; // Force web platform to keep modules null
    jest.isolateModules(() => {
      notificationsModule = require('./notifications');
    });
    // Let dynamic import promise reject/resolve
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  afterAll(() => {
    Platform.OS = originalOS;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registerForPushNotificationsAsync returns null when modules are not loaded', async () => {
    const token = await notificationsModule.registerForPushNotificationsAsync();
    expect(token).toBeNull();
  });

  it('getBadgeCount returns 0 when Notifications module is null', async () => {
    const count = await notificationsModule.getBadgeCount();
    expect(count).toBe(0);
  });

  it('setBadgeCount returns early when Notifications module is null', async () => {
    await expect(notificationsModule.setBadgeCount(5)).resolves.not.toThrow();
  });

  it('clearAllNotifications returns early when Notifications module is null', async () => {
    await expect(
      notificationsModule.clearAllNotifications()
    ).resolves.not.toThrow();
  });

  it('scheduleLocalNotification returns empty string when Notifications module is null', async () => {
    const id = await notificationsModule.scheduleLocalNotification(
      'title',
      'body'
    );
    expect(id).toBe('');
  });

  it('addNotificationResponseListener returns dummy unsubscribe when Notifications module is null', () => {
    const callback = jest.fn<(response: NotificationResponse) => void>();
    const result =
      notificationsModule.addNotificationResponseListener(callback);
    expect(result).toHaveProperty('remove');
    expect(typeof result.remove).toBe('function');
    expect(() => result.remove()).not.toThrow();
  });

  it('addNotificationReceivedListener returns dummy unsubscribe when Notifications module is null', () => {
    const callback = jest.fn<(notification: Notification) => void>();
    const result =
      notificationsModule.addNotificationReceivedListener(callback);
    expect(result).toHaveProperty('remove');
    expect(typeof result.remove).toBe('function');
    expect(() => result.remove()).not.toThrow();
  });
});

describe('notifications (success path)', () => {
  const originalOS = Platform.OS;
  let notificationsModule: typeof import('./notifications');

  beforeAll(async () => {
    Platform.OS = 'ios'; // So loadNativeModules doesn't abort
    jest.isolateModules(() => {
      // Import the mock directly to test expectations
      notificationsModule = require('./notifications');
    });
    // Wait for the dynamic imports in loadNativeModules to complete
    await new Promise((resolve) => setTimeout(resolve, 100)); // wait longer just in case
  });

  afterAll(() => {
    Platform.OS = originalOS;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registerForPushNotificationsAsync returns token on success', async () => {
    const token = await notificationsModule.registerForPushNotificationsAsync();
    expect(token).toBe('mock-token');
    expect(mockGetPermissionsAsync).toHaveBeenCalled();
    expect(mockGetExpoPushTokenAsync).toHaveBeenCalledWith({
      projectId: 'test-project-id',
    });
  });

  it('getBadgeCount delegates to expo-notifications', async () => {
    const count = await notificationsModule.getBadgeCount();
    expect(count).toBe(3);
    expect(mockGetBadgeCountAsync).toHaveBeenCalled();
  });

  it('setBadgeCount delegates to expo-notifications', async () => {
    await notificationsModule.setBadgeCount(5);
    expect(mockSetBadgeCountAsync).toHaveBeenCalledWith(5);
  });

  it('clearAllNotifications delegates to expo-notifications', async () => {
    await notificationsModule.clearAllNotifications();
    expect(mockDismissAllNotificationsAsync).toHaveBeenCalled();
    expect(mockSetBadgeCountAsync).toHaveBeenCalledWith(0);
  });

  it('scheduleLocalNotification delegates to expo-notifications', async () => {
    const id = await notificationsModule.scheduleLocalNotification(
      'Test',
      'Body',
      { data: 1 }
    );
    expect(id).toBe('mock-id');
    expect(mockScheduleNotificationAsync).toHaveBeenCalledWith({
      content: { title: 'Test', body: 'Body', data: { data: 1 } },
      trigger: null,
    });
  });

  it('addNotificationResponseListener delegates to expo-notifications', () => {
    const callback = jest.fn<(response: NotificationResponse) => void>();
    notificationsModule.addNotificationResponseListener(callback);
    expect(mockAddNotificationResponseReceivedListener).toHaveBeenCalledWith(
      callback
    );
  });

  it('addNotificationReceivedListener delegates to expo-notifications', () => {
    const callback = jest.fn<(notification: Notification) => void>();
    notificationsModule.addNotificationReceivedListener(callback);
    expect(mockAddNotificationReceivedListener).toHaveBeenCalledWith(callback);
  });
});
