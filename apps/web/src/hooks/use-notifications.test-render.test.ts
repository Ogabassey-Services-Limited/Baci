import { describe, expect, it } from 'vitest';
import { renderNotificationsHook } from './use-notifications.test-render';

describe('renderNotificationsHook', () => {
  it('exports a wrapper around renderHook and NotificationsProvider', () => {
    expect(typeof renderNotificationsHook).toBe('function');
  });
});
