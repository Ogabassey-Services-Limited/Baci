import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { formatNgnCurrency } from '@/lib/format-ngn-currency';
import { createLogger } from '@/lib/logger';

const log = createLogger('SavingsReminderNotifications');
const SAVINGS_REMINDER_CHANNEL_ID = 'savings';
const SAVINGS_REMINDER_NOTIFICATION_ID_KEY =
  'baci:savings-reminder-notification-id';
const SAVINGS_REMINDER_GOAL_ID_KEY = 'baci:savings-reminder-goal-id';
type SavingsReminderFrequency = 'daily' | 'weekly' | 'monthly';
type NotificationsModule = typeof import('expo-notifications');

let Notifications: NotificationsModule | null = null;

function loadNotificationsModule() {
  if (Platform.OS === 'web') return null;
  if (Notifications) return Notifications;

  try {
    Notifications = require('expo-notifications') as NotificationsModule;
    return Notifications;
  } catch (error) {
    log.debug('Notifications module unavailable for savings reminders', error);
    return null;
  }
}

async function ensureSavingsReminderPermissions(
  notifications: NotificationsModule
) {
  const { status: existingStatus } = await notifications.getPermissionsAsync();
  if (existingStatus === 'granted') {
    return true;
  }

  const { status } = await notifications.requestPermissionsAsync();
  return status === 'granted';
}

async function ensureSavingsReminderChannel(
  notifications: NotificationsModule
) {
  if (Platform.OS !== 'android') {
    return;
  }

  await notifications.setNotificationChannelAsync(SAVINGS_REMINDER_CHANNEL_ID, {
    name: 'Savings Reminders',
    description: 'Reminders to keep your device savings goal on track',
    importance: notifications.AndroidImportance.DEFAULT,
  });
}

function buildSavingsReminderTrigger({
  frequency,
  notifications,
  scheduledAt,
}: {
  frequency: SavingsReminderFrequency;
  notifications: NotificationsModule;
  scheduledAt: Date;
}) {
  const channelId = SAVINGS_REMINDER_CHANNEL_ID;
  const hour = scheduledAt.getHours();
  const minute = scheduledAt.getMinutes();

  if (scheduledAt.getTime() > Date.now()) {
    return {
      channelId,
      date: scheduledAt,
      type: notifications.SchedulableTriggerInputTypes.DATE,
    };
  }

  if (frequency === 'daily') {
    return {
      channelId,
      hour,
      minute,
      type: notifications.SchedulableTriggerInputTypes.DAILY,
    };
  }

  if (frequency === 'weekly') {
    return {
      channelId,
      hour,
      minute,
      type: notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: scheduledAt.getDay() + 1,
    };
  }

  return {
    channelId,
    day: scheduledAt.getDate(),
    hour,
    minute,
    type: notifications.SchedulableTriggerInputTypes.MONTHLY,
  };
}

async function cancelStoredSavingsReminderNotification(
  notifications: NotificationsModule,
  goalId?: string
) {
  const [storedNotificationId, storedGoalId] = await Promise.all([
    AsyncStorage.getItem(SAVINGS_REMINDER_NOTIFICATION_ID_KEY),
    AsyncStorage.getItem(SAVINGS_REMINDER_GOAL_ID_KEY),
  ]);

  if (!storedNotificationId) {
    return false;
  }
  if (goalId && storedGoalId && storedGoalId !== goalId) {
    return false;
  }

  try {
    await notifications.cancelScheduledNotificationAsync(storedNotificationId);
  } catch (error) {
    log.debug('Unable to cancel stored savings reminder notification', error);
  }

  await Promise.all([
    AsyncStorage.removeItem(SAVINGS_REMINDER_NOTIFICATION_ID_KEY),
    AsyncStorage.removeItem(SAVINGS_REMINDER_GOAL_ID_KEY),
  ]);
  return true;
}

export async function cancelSavingsReminderNotification(goalId?: string) {
  const notifications = loadNotificationsModule();
  if (!notifications) return false;

  return await cancelStoredSavingsReminderNotification(notifications, goalId);
}

export async function scheduleSavingsReminderNotification({
  contributionAmount,
  frequency,
  goalId,
  goalTitle,
  scheduledAt = new Date(),
}: {
  contributionAmount: number;
  frequency: SavingsReminderFrequency;
  goalId: string;
  goalTitle: string;
  scheduledAt?: Date;
}): Promise<string | null> {
  const notifications = loadNotificationsModule();
  if (!notifications) return null;

  const hasPermission = await ensureSavingsReminderPermissions(notifications);
  if (!hasPermission) {
    return null;
  }

  await ensureSavingsReminderChannel(notifications);
  await cancelStoredSavingsReminderNotification(notifications);

  const notificationId = await notifications.scheduleNotificationAsync({
    content: {
      title: 'Savings reminder',
      body: `Add ${formatNgnCurrency(contributionAmount)} toward ${goalTitle}.`,
      data: {
        goalId,
        screen: 'wallet',
        type: 'customer_savings_reminder',
      },
    },
    trigger: buildSavingsReminderTrigger({
      frequency,
      notifications,
      scheduledAt,
    }),
  });
  await Promise.all([
    AsyncStorage.setItem(SAVINGS_REMINDER_NOTIFICATION_ID_KEY, notificationId),
    AsyncStorage.setItem(SAVINGS_REMINDER_GOAL_ID_KEY, goalId),
  ]);
  return notificationId;
}
