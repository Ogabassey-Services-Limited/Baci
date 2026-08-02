import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendPushNotificationsAsync = vi.fn();
const chunkPushNotifications = vi.fn((messages: unknown[]) => [messages]);

vi.mock('expo-server-sdk', () => {
  class MockExpo {
    sendPushNotificationsAsync = sendPushNotificationsAsync;
    chunkPushNotifications = chunkPushNotifications;

    static isExpoPushToken(token: unknown): boolean {
      return (
        typeof token === 'string' && token.startsWith('ExponentPushToken[')
      );
    }
  }

  return { default: MockExpo, Expo: MockExpo };
});

import Expo, { type ExpoPushMessage } from 'expo-server-sdk';
import { sendPushNotificationChunks } from './expo-push-chunk-delivery';

describe('sendPushNotificationChunks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps invalid token tickets aligned with the original message order', async () => {
    sendPushNotificationsAsync.mockResolvedValueOnce([
      { status: 'ok', id: 'accepted' },
    ]);
    const messages = [
      { to: 'invalid-token', body: 'invalid' },
      { to: 'ExponentPushToken[valid]', body: 'valid' },
    ] as ExpoPushMessage[];

    const tickets = await sendPushNotificationChunks(new Expo(), messages);

    expect(tickets).toEqual([
      expect.objectContaining({ status: 'error' }),
      { status: 'ok', id: 'accepted' },
    ]);
  });

  it('calls the rejection boundary only after definitive error tickets', async () => {
    sendPushNotificationsAsync.mockResolvedValueOnce([
      { status: 'error', message: 'MessageRateExceeded' },
    ]);
    const onDeliveryRejected = vi.fn();

    await sendPushNotificationChunks(
      new Expo(),
      [{ to: 'ExponentPushToken[valid]', body: 'valid' }],
      { onDeliveryRejected }
    );

    expect(onDeliveryRejected).toHaveBeenCalledOnce();
  });
});
