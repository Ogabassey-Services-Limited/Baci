import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import './use-notifications.test-support';
import {
  NotificationsProvider,
  useNotifications,
} from './notifications-provider';
import { renderNotificationsHook } from './use-notifications.test-render';
import { resetNotificationHookMocks } from './use-notifications.test-support';

beforeEach(resetNotificationHookMocks);

describe('NotificationsProvider', () => {
  it('throws when useNotifications is called outside the provider', () => {
    expect(() => renderHook(() => useNotifications())).toThrow(
      'useNotifications must be used within NotificationsProvider'
    );
  });

  it('returns shared notification state to every consumer', () => {
    function usePair() {
      const first = useNotifications();
      const second = useNotifications();
      return { first, second };
    }

    const { result } = renderNotificationsHook(() => usePair());

    expect(result.current.first).toBe(result.current.second);
  });

  it('renders children', () => {
    const { result } = renderHook(() => useNotifications(), {
      wrapper: NotificationsProvider,
    });

    expect(result.current.notifications).toEqual([]);
  });
});
