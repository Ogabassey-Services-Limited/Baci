import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';

let mockPlatformOS: 'android' | 'ios' | 'web' = 'android';
const mockCallOrder: string[] = [];

jest.mock('react-native', () => ({
  Platform: {
    get OS() {
      return mockPlatformOS;
    },
  },
}));

jest.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 'default' },
  SchedulableTriggerInputTypes: {
    DAILY: 'daily',
    MONTHLY: 'monthly',
    WEEKLY: 'weekly',
  },
  getPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  cancelScheduledNotificationAsync: jest.fn(() => {
    mockCallOrder.push('cancelScheduledNotificationAsync');
    return Promise.resolve();
  }),
  scheduleNotificationAsync: jest.fn(() => {
    mockCallOrder.push('scheduleNotificationAsync');
    return Promise.resolve('notification-id');
  }),
  setNotificationChannelAsync: jest.fn(() => {
    mockCallOrder.push('setNotificationChannelAsync');
    return Promise.resolve(null);
  }),
}));

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({
    debug: jest.fn(),
  }),
}));

const {
  cancelSavingsReminderNotification,
  scheduleSavingsReminderNotification,
} =
  require('./savings-reminder-notifications') as typeof import('./savings-reminder-notifications');
const mockNotifications = require('expo-notifications') as jest.Mocked<
  typeof import('expo-notifications')
>;

describe('scheduleSavingsReminderNotification', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    mockCallOrder.length = 0;
    mockPlatformOS = 'android';
    mockNotifications.cancelScheduledNotificationAsync.mockImplementation(
      () => {
        mockCallOrder.push('cancelScheduledNotificationAsync');
        return Promise.resolve();
      }
    );
    mockNotifications.getPermissionsAsync.mockResolvedValue({
      status: 'granted',
    } as Awaited<ReturnType<typeof mockNotifications.getPermissionsAsync>>);
    mockNotifications.requestPermissionsAsync.mockResolvedValue({
      status: 'granted',
    } as Awaited<ReturnType<typeof mockNotifications.requestPermissionsAsync>>);
    mockNotifications.scheduleNotificationAsync.mockImplementation(() => {
      mockCallOrder.push('scheduleNotificationAsync');
      return Promise.resolve('notification-id');
    });
    mockNotifications.setNotificationChannelAsync.mockImplementation(() => {
      mockCallOrder.push('setNotificationChannelAsync');
      return Promise.resolve(null);
    });
  });

  it('schedules a recurring savings reminder on the savings channel', async () => {
    const id = await scheduleSavingsReminderNotification({
      contributionAmount: 500,
      frequency: 'weekly',
      goalId: 'goal-1',
      scheduledAt: new Date(2026, 5, 8, 9, 30),
      goalTitle: 'iPhone 15 Pro',
    });

    expect(id).toBe('notification-id');
    expect(mockCallOrder).toEqual([
      'setNotificationChannelAsync',
      'scheduleNotificationAsync',
    ]);
    expect(mockNotifications.setNotificationChannelAsync).toHaveBeenCalledWith(
      'savings',
      expect.objectContaining({
        description: 'Reminders to keep your device savings goal on track',
        importance: 'default',
        name: 'Savings Reminders',
      })
    );
    expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledWith({
      content: {
        title: 'Savings reminder',
        body: 'Add ₦500 toward iPhone 15 Pro.',
        data: {
          goalId: 'goal-1',
          screen: 'wallet',
          type: 'customer_savings_reminder',
        },
      },
      trigger: {
        channelId: 'savings',
        hour: 9,
        minute: 30,
        type: 'weekly',
        weekday: 2,
      },
    });
  });

  it('does not create an Android channel on iOS', async () => {
    mockPlatformOS = 'ios';

    await scheduleSavingsReminderNotification({
      contributionAmount: 500,
      frequency: 'daily',
      goalId: 'goal-1',
      goalTitle: 'iPhone 15 Pro',
      scheduledAt: new Date(2026, 5, 8, 9, 30),
    });

    expect(
      mockNotifications.setNotificationChannelAsync
    ).not.toHaveBeenCalled();
    expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: {
          channelId: 'savings',
          hour: 9,
          minute: 30,
          type: 'daily',
        },
      })
    );
  });

  it('uses a calendar-aware monthly trigger', async () => {
    await scheduleSavingsReminderNotification({
      contributionAmount: 500,
      frequency: 'monthly',
      goalId: 'goal-1',
      goalTitle: 'iPhone 15 Pro',
      scheduledAt: new Date(2026, 5, 8, 9, 30),
    });

    expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: {
          channelId: 'savings',
          day: 8,
          hour: 9,
          minute: 30,
          type: 'monthly',
        },
      })
    );
  });

  it('cancels and replaces the previously stored savings reminder', async () => {
    mockNotifications.scheduleNotificationAsync
      .mockImplementationOnce(() => {
        mockCallOrder.push('scheduleNotificationAsync');
        return Promise.resolve('notification-id-1');
      })
      .mockImplementationOnce(() => {
        mockCallOrder.push('scheduleNotificationAsync');
        return Promise.resolve('notification-id-2');
      });

    await scheduleSavingsReminderNotification({
      contributionAmount: 500,
      frequency: 'weekly',
      goalId: 'goal-1',
      goalTitle: 'iPhone 15 Pro',
    });
    await scheduleSavingsReminderNotification({
      contributionAmount: 1000,
      frequency: 'daily',
      goalId: 'goal-2',
      goalTitle: 'Pixel 10',
    });

    expect(
      mockNotifications.cancelScheduledNotificationAsync
    ).toHaveBeenCalledWith('notification-id-1');
    await expect(
      AsyncStorage.getItem('baci:savings-reminder-notification-id')
    ).resolves.toBe('notification-id-2');
    await expect(
      AsyncStorage.getItem('baci:savings-reminder-goal-id')
    ).resolves.toBe('goal-2');
  });

  it('cancels a stored reminder for the matching goal', async () => {
    await scheduleSavingsReminderNotification({
      contributionAmount: 500,
      frequency: 'weekly',
      goalId: 'goal-1',
      goalTitle: 'iPhone 15 Pro',
    });

    await expect(cancelSavingsReminderNotification('goal-1')).resolves.toBe(
      true
    );

    expect(
      mockNotifications.cancelScheduledNotificationAsync
    ).toHaveBeenCalledWith('notification-id');
    await expect(
      AsyncStorage.getItem('baci:savings-reminder-notification-id')
    ).resolves.toBeNull();
  });

  it('keeps a stored reminder when cancelling a different goal', async () => {
    await scheduleSavingsReminderNotification({
      contributionAmount: 500,
      frequency: 'weekly',
      goalId: 'goal-1',
      goalTitle: 'iPhone 15 Pro',
    });
    jest.clearAllMocks();

    await expect(cancelSavingsReminderNotification('goal-2')).resolves.toBe(
      false
    );

    expect(
      mockNotifications.cancelScheduledNotificationAsync
    ).not.toHaveBeenCalled();
    await expect(
      AsyncStorage.getItem('baci:savings-reminder-notification-id')
    ).resolves.toBe('notification-id');
  });

  it('returns null on web', async () => {
    mockPlatformOS = 'web';

    await expect(
      scheduleSavingsReminderNotification({
        contributionAmount: 500,
        frequency: 'weekly',
        goalId: 'goal-1',
        goalTitle: 'iPhone 15 Pro',
      })
    ).resolves.toBeNull();
    expect(mockNotifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('returns null when notification permission is denied', async () => {
    mockNotifications.getPermissionsAsync.mockResolvedValue({
      status: 'denied',
    } as Awaited<ReturnType<typeof mockNotifications.getPermissionsAsync>>);
    mockNotifications.requestPermissionsAsync.mockResolvedValue({
      status: 'denied',
    } as Awaited<ReturnType<typeof mockNotifications.requestPermissionsAsync>>);

    await expect(
      scheduleSavingsReminderNotification({
        contributionAmount: 500,
        frequency: 'weekly',
        goalId: 'goal-1',
        goalTitle: 'iPhone 15 Pro',
      })
    ).resolves.toBeNull();
    expect(mockNotifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('returns null when the notifications module is unavailable', async () => {
    jest.resetModules();
    jest.doMock('react-native', () => ({
      Platform: { OS: 'ios' },
    }));
    jest.doMock('expo-notifications', () => {
      throw new Error('expo-notifications unavailable');
    });
    jest.doMock('@/lib/logger', () => ({
      createLogger: () => ({ debug: jest.fn() }),
    }));

    const { scheduleSavingsReminderNotification: scheduleUnavailableReminder } =
      require('./savings-reminder-notifications') as typeof import('./savings-reminder-notifications');

    await expect(
      scheduleUnavailableReminder({
        contributionAmount: 500,
        frequency: 'weekly',
        goalId: 'goal-1',
        goalTitle: 'iPhone 15 Pro',
      })
    ).resolves.toBeNull();
  });
});
