import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import './use-notifications.test-support';
import { useNotifications } from './use-notifications';
import {
  notificationMocks,
  resetNotificationHookMocks,
  setMerchant,
} from './use-notifications.test-support';

beforeEach(resetNotificationHookMocks);

describe('useNotifications Realtime subscription', () => {
  it('subscribes to only the current merchant for INSERT and UPDATE changes', async () => {
    renderHook(() => useNotifications());

    await waitFor(() => {
      expect(notificationMocks.supabaseChannel).toHaveBeenCalledWith(
        'merchant-notifications:merchant-123'
      );
    });

    const insertFilter = {
      event: 'INSERT',
      filter: 'merchant_id=eq.merchant-123',
      schema: 'public',
      table: 'merchant_notifications',
    };
    const updateFilter = { ...insertFilter, event: 'UPDATE' };
    expect(notificationMocks.channel.on).toHaveBeenCalledWith(
      'postgres_changes',
      insertFilter,
      expect.any(Function)
    );
    expect(notificationMocks.channel.on).toHaveBeenCalledWith(
      'postgres_changes',
      updateFilter,
      expect.any(Function)
    );
    expect(notificationMocks.channel.subscribe).toHaveBeenCalled();
  });

  it('does not subscribe when merchant context is absent', async () => {
    setMerchant(null);

    renderHook(() => useNotifications());
    await Promise.resolve();

    expect(notificationMocks.supabaseChannel).not.toHaveBeenCalled();
  });

  it('removes the merchant-scoped channel on unmount', async () => {
    const { unmount } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(notificationMocks.supabaseChannel).toHaveBeenCalled();
    });
    unmount();

    expect(notificationMocks.removeChannel).toHaveBeenCalledWith(
      notificationMocks.channel
    );
  });

  it('warns without throwing when the subscription fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    let callback: (status: string, error?: { message: string }) => void = () =>
      undefined;
    notificationMocks.channel.subscribe.mockImplementation((handler) => {
      callback = handler;
      return notificationMocks.channel;
    });

    renderHook(() => useNotifications());

    await waitFor(() =>
      expect(notificationMocks.channel.subscribe).toHaveBeenCalled()
    );
    callback('CHANNEL_ERROR', { message: 'Connection failed' });

    expect(warn).toHaveBeenCalledWith(
      'Notification subscription error:',
      'Connection failed'
    );
    warn.mockRestore();
  });
});
