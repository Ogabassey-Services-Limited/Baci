import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
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
  cancelScheduledNotificationAsync: jest.fn(async () => undefined),
  scheduleNotificationAsync: jest.fn(async () => 'notification-id'),
  setNotificationChannelAsync: jest.fn(async () => null),
}));

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({
    debug: jest.fn(),
  }),
}));

const {
  activateDueSavingsReminderNotification,
  scheduleSavingsReminderNotification,
} =
  require('./savings-reminder-notifications') as typeof import('./savings-reminder-notifications');
const mockNotifications = require('expo-notifications') as jest.Mocked<
  typeof import('expo-notifications')
>;

describe('scheduleSavingsReminderNotification triggers', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it('uses a calendar-aware monthly trigger for started plans', async () => {
    await scheduleSavingsReminderNotification({
      contributionAmount: 500,
      frequency: 'monthly',
      goalId: 'goal-1',
      goalTitle: 'iPhone 15 Pro',
      scheduledAt: new Date(2020, 5, 8, 9, 30),
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

  it('defers future-start reminders instead of scheduling a one-shot trigger', async () => {
    const scheduledAt = new Date(2099, 5, 8, 9, 30);

    await expect(
      scheduleSavingsReminderNotification({
        contributionAmount: 500,
        frequency: 'weekly',
        goalId: 'goal-1',
        goalTitle: 'iPhone 15 Pro',
        scheduledAt,
      })
    ).resolves.toBeNull();

    expect(mockNotifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    await expect(
      AsyncStorage.getItem('baci:savings-reminder-pending-request')
    ).resolves.toContain('"goalId":"goal-1"');
  });

  it('activates due pending reminders with the original recurring cadence', async () => {
    const scheduledAt = new Date(2020, 5, 8, 9, 30);

    await AsyncStorage.setItem(
      'baci:savings-reminder-pending-request',
      JSON.stringify({
        contributionAmount: 500,
        frequency: 'weekly',
        goalId: 'goal-1',
        goalTitle: 'iPhone 15 Pro',
        scheduledAt: scheduledAt.toISOString(),
      })
    );

    await expect(activateDueSavingsReminderNotification()).resolves.toBe(
      'notification-id'
    );

    expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: {
          channelId: 'savings',
          hour: 9,
          minute: 30,
          type: 'weekly',
          weekday: 2,
        },
      })
    );
    await expect(
      AsyncStorage.getItem('baci:savings-reminder-pending-request')
    ).resolves.toBeNull();
  });

  it('keeps pending reminders that are not due yet', async () => {
    const scheduledAt = new Date(2099, 5, 8, 9, 30);

    await AsyncStorage.setItem(
      'baci:savings-reminder-pending-request',
      JSON.stringify({
        contributionAmount: 500,
        frequency: 'daily',
        goalId: 'goal-1',
        goalTitle: 'iPhone 15 Pro',
        scheduledAt: scheduledAt.toISOString(),
      })
    );

    await expect(activateDueSavingsReminderNotification()).resolves.toBeNull();

    expect(mockNotifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    await expect(
      AsyncStorage.getItem('baci:savings-reminder-pending-request')
    ).resolves.toContain('"frequency":"daily"');
  });

  it('uses the daily cadence when activating a due daily reminder', async () => {
    const scheduledAt = new Date(2020, 5, 8, 9, 30);

    await AsyncStorage.setItem(
      'baci:savings-reminder-pending-request',
      JSON.stringify({
        contributionAmount: 500,
        frequency: 'daily',
        goalId: 'goal-1',
        goalTitle: 'iPhone 15 Pro',
        scheduledAt: scheduledAt.toISOString(),
      })
    );

    await activateDueSavingsReminderNotification();

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
});
