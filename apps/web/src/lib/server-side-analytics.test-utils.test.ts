import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { serverSideAnalyticsTestHarness as harness } from './server-side-analytics.test-utils';

describe('serverSideAnalyticsTestHarness', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parses JSON request bodies', () => {
    const body = harness.parseRequestBody([
      'http://localhost/api/analytics/ga4',
      {
        body: JSON.stringify({
          event: 'purchase',
          eventData: { value: 100 },
          merchantId: harness.merchantId,
          userData: { email: harness.mockUserData.email },
        }),
      },
    ]);

    expect(body).toMatchObject({
      event: 'purchase',
      merchantId: harness.merchantId,
      userData: { email: harness.mockUserData.email },
    });
  });

  it('rejects missing, non-string, and invalid JSON request bodies', () => {
    expect(() =>
      harness.parseRequestBody(['http://localhost/api/analytics/ga4', {}])
    ).toThrow();
    expect(() =>
      harness.parseRequestBody([
        'http://localhost/api/analytics/ga4',
        { body: new URLSearchParams() },
      ])
    ).toThrow('Expected analytics request body to be a JSON string');
    expect(() =>
      harness.parseRequestBody([
        'http://localhost/api/analytics/ga4',
        { body: '{not-json}' },
      ])
    ).toThrow();
    expect(() =>
      harness.parseRequestBody([
        'http://localhost/api/analytics/ga4',
        { body: JSON.stringify({ event: 'purchase' }) },
      ])
    ).toThrow('Parsed analytics request body has an invalid shape');
  });

  it('asserts matching attribution data and rejects mismatches', () => {
    expect(() =>
      harness.expectAttributionData({
        event: 'purchase',
        eventData: {},
        merchantId: harness.merchantId,
        userData: { email: harness.mockUserData.email },
      })
    ).not.toThrow();

    expect(() =>
      harness.expectAttributionData({
        event: 'purchase',
        eventData: {},
        merchantId: 'other-merchant',
        userData: { email: harness.mockUserData.email },
      })
    ).toThrow();
    expect(() =>
      harness.expectAttributionData({
        event: 'purchase',
        eventData: {},
        merchantId: harness.merchantId,
        userData: { email: 'other@example.com' },
      })
    ).toThrow();
    expect(() =>
      harness.expectAttributionData({
        event: 'purchase',
        eventData: {},
        merchantId: harness.merchantId,
        userData: {},
      })
    ).toThrow();
  });

  it('configures successful fetch responses', async () => {
    harness.mockSuccessfulFetch();

    const response = await fetch('http://localhost/api/analytics/ga4');

    await expect(response.json()).resolves.toEqual({ success: true });
  });
});
