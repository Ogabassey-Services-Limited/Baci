import { beforeEach, describe, expect, it, vi } from 'vitest';

const capture = vi.hoisted(() => vi.fn());

vi.mock('posthog-js', () => ({
  default: { capture },
}));

import { captureClientEvent } from './capture-client-event';

describe('captureClientEvent', () => {
  beforeEach(() => {
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
});
