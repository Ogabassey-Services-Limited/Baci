import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { MerchantData } from './merchant/types';
import './use-notifications.test-support';
import {
  notificationMocks,
  resetNotificationHookMocks,
} from './use-notifications.test-support';
import { useNotificationsState } from './use-notifications-state';

beforeEach(resetNotificationHookMocks);

describe('useNotificationsState', () => {
  it('owns a single merchant-scoped realtime channel', async () => {
    renderHook(() =>
      useNotificationsState({ id: 'merchant-123' } as MerchantData)
    );

    await waitFor(() => {
      expect(notificationMocks.supabaseChannel).toHaveBeenCalledTimes(1);
    });
    expect(notificationMocks.supabaseChannel).toHaveBeenCalledWith(
      'merchant-notifications:merchant-123'
    );
  });

  it('does not subscribe without a merchant', async () => {
    renderHook(() => useNotificationsState(null));
    await Promise.resolve();

    expect(notificationMocks.supabaseChannel).not.toHaveBeenCalled();
  });
});
