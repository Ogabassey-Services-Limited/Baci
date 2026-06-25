import { describe, expect, it, vi } from 'vitest';
import {
  requestMobileUpdateCheck,
  subscribeToMobileUpdateChecks,
} from './mobile-update-events';

describe('mobile update events', () => {
  it('notifies subscribers and stops after unsubscribe', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToMobileUpdateChecks(listener);

    requestMobileUpdateCheck('foreground');
    unsubscribe();
    requestMobileUpdateCheck('push-notification');

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('foreground');
  });

  it('supports multiple independent subscribers', () => {
    const first = vi.fn();
    const second = vi.fn();
    const unsubscribeFirst = subscribeToMobileUpdateChecks(first);
    const unsubscribeSecond = subscribeToMobileUpdateChecks(second);

    requestMobileUpdateCheck('initial');

    expect(first).toHaveBeenCalledWith('initial');
    expect(second).toHaveBeenCalledWith('initial');

    unsubscribeFirst();
    requestMobileUpdateCheck('foreground');

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);
    expect(second).toHaveBeenLastCalledWith('foreground');

    unsubscribeSecond();
  });
});
