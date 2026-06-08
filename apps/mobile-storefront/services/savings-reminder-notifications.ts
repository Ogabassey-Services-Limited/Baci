import { Platform } from 'react-native';
import { formatNgnCurrency } from '@/lib/format-ngn-currency';
import { createLogger } from '@/lib/logger';

const log = createLogger('SavingsReminderNotifications');
const SAVINGS_REMINDER_CHANNEL_ID = 'savings';
type SavingsReminderFrequency = 'daily' | 'weekly' | 'monthly';

let Notifications: typeof import('expo-notifications') | null = null;

async function loadNotificationsModule() {
  if (Platform.OS === 'web') return null;
  if (Notifications) return Notifications;

  try {
    Notifications = await import('expo-notifications');
    return Notifications;
  } catch (error) {
    log.debug('Notifications module unavailable for savings reminders', error);
    return null;
  }
}

async function ensureSavingsReminderPermissions(
  notifications: typeof import('expo-notifications')
) {
  const { status: existingStatus } = await notifications.getPermissionsAsync();
  if (existingStatus === 'granted') {
    return true;
  }

  const { status } = await notifications.requestPermissionsAsync();
  return status === 'granted';
}

async function ensureSavingsReminderChannel(
  notifications: typeof import('expo-notifications')
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
  notifications: typeof import('expo-notifications');
  scheduledAt: Date;
}) {
  const channelId = SAVINGS_REMINDER_CHANNEL_ID;
  const hour = scheduledAt.getHours();
  const minute = scheduledAt.getMinutes();

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
  const notifications = await loadNotificationsModule();
  if (!notifications) return null;

  const hasPermission = await ensureSavingsReminderPermissions(notifications);
  if (!hasPermission) {
    return null;
  }

  await ensureSavingsReminderChannel(notifications);

  return await notifications.scheduleNotificationAsync({
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
}
