import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
}));

jest.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 'default' },
  SchedulableTriggerInputTypes: {
    DATE: 'date',
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

const { scheduleSavingsReminderNotification } =
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

  it('uses a date trigger when the savings start time is in the future', async () => {
    const scheduledAt = new Date(2099, 5, 8, 9, 30);

    await scheduleSavingsReminderNotification({
      contributionAmount: 500,
      frequency: 'weekly',
      goalId: 'goal-1',
      goalTitle: 'iPhone 15 Pro',
      scheduledAt,
    });

    expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: {
          channelId: 'savings',
          date: scheduledAt,
          type: 'date',
        },
      })
    );
  });
});
