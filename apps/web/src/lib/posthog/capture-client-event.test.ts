import { beforeEach, describe, expect, it, vi } from 'vitest';

const capture = vi.hoisted(() => vi.fn());
const posthogMockState = vi.hoisted(() => ({ loaded: true }));

vi.mock('posthog-js', () => ({
  default: {
    capture,
    get __loaded() {
      return posthogMockState.loaded;
    },
  },
}));

import {
  captureClientEvent,
  flushPendingClientEvents,
} from './capture-client-event';

describe('captureClientEvent', () => {
  beforeEach(() => {
    // Drain any queue left over from a prior test before resetting the spy.
    posthogMockState.loaded = true;
    flushPendingClientEvents();
    capture.mockReset();
  });

  it('stamps app_surface and forwards defined properties', () => {
    captureClientEvent('wallet_funding_surface_opened', {
      surface: 'utility_modal',
      merchant_slug: 'ogabassey',
    });

    expect(capture).toHaveBeenCalledWith('wallet_funding_surface_opened', {
      app_surface: 'web',
      surface: 'utility_modal',
      merchant_slug: 'ogabassey',
    });
  });

  it('always stamps app_surface as web even when a caller supplies it', () => {
    captureClientEvent('wallet_funding_surface_opened', {
      app_surface: 'native',
      surface: 'wallet_page',
    });

    expect(capture).toHaveBeenCalledWith('wallet_funding_surface_opened', {
      app_surface: 'web',
      surface: 'wallet_page',
    });
  });

  it('drops undefined property values so absent context is not reported', () => {
    captureClientEvent('wallet_funding_account_created', {
      merchant_slug: undefined,
      customer_id: 'customer-1',
    });

    expect(capture).toHaveBeenCalledWith('wallet_funding_account_created', {
      app_surface: 'web',
      customer_id: 'customer-1',
    });
  });

  it('captures with only app_surface when no properties are supplied', () => {
    captureClientEvent('wallet_funding_surface_opened');

    expect(capture).toHaveBeenCalledWith('wallet_funding_surface_opened', {
      app_surface: 'web',
    });
  });

  it('never throws when the SDK capture fails', () => {
    capture.mockImplementation(() => {
      throw new Error('posthog-js not ready');
    });

    expect(() =>
      captureClientEvent('wallet_funding_surface_opened', {
        surface: 'wallet_page',
      })
    ).not.toThrow();
  });

  it('queues events captured before the SDK initializes instead of dropping them', () => {
    posthogMockState.loaded = false;

    captureClientEvent('wallet_funding_surface_opened', {
      surface: 'utility_modal',
    });

    // The SDK would silently discard a pre-init capture — nothing is sent yet.
    expect(capture).not.toHaveBeenCalled();

    posthogMockState.loaded = true;
    flushPendingClientEvents();

    expect(capture).toHaveBeenCalledWith('wallet_funding_surface_opened', {
      app_surface: 'web',
      surface: 'utility_modal',
    });
  });

  it('flushes each queued event once', () => {
    posthogMockState.loaded = false;
    captureClientEvent('wallet_funding_surface_opened', {
      surface: 'wallet_page',
    });

    posthogMockState.loaded = true;
    flushPendingClientEvents();
    flushPendingClientEvents();

    expect(capture).toHaveBeenCalledTimes(1);
  });

  it('bounds the pre-init queue to the most recent events', () => {
    posthogMockState.loaded = false;
    for (let index = 0; index < 25; index += 1) {
      captureClientEvent('wallet_funding_surface_opened', { index });
    }

    posthogMockState.loaded = true;
    flushPendingClientEvents();

    expect(capture).toHaveBeenCalledTimes(20);
    expect(capture).toHaveBeenLastCalledWith('wallet_funding_surface_opened', {
      app_surface: 'web',
      index: 24,
    });
  });
});
