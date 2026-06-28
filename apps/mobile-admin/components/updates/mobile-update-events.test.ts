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

  it('keeps notifying later subscribers when one listener throws', () => {
    const error = new Error('listener failed');
    const failing = vi.fn(() => {
      throw error;
    });
    const second = vi.fn();
    const warnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const unsubscribeFailing = subscribeToMobileUpdateChecks(failing);
    const unsubscribeSecond = subscribeToMobileUpdateChecks(second);

    requestMobileUpdateCheck('push-notification');

    expect(failing).toHaveBeenCalledWith('push-notification');
    expect(second).toHaveBeenCalledWith('push-notification');
    expect(warnSpy).toHaveBeenCalledWith(
      '[mobile-update-events] listener failed',
      error
    );

    unsubscribeFailing();
    unsubscribeSecond();
    warnSpy.mockRestore();
  });
});
