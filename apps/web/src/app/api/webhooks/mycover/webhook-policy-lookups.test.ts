import { afterEach, describe, expect, it, vi } from 'vitest';

const mockGetMyCoverSecretKey = vi.fn();
vi.mock('@/env', () => ({
  getMyCoverSecretKey: () => mockGetMyCoverSecretKey(),
}));

import {
  getLookupFromRenewalDetails,
  getPolicyLookup,
  isPreLossInspectionApproved,
  resolveRenewalPolicyLookup,
} from './webhook-policy-lookups';

describe('MyCover policy lookup helpers', () => {
  it('prefers explicit policy identifiers over purchase and data ids', () => {
    expect(
      getPolicyLookup({
        id: 'data-id',
        purchase_id: 'purchase-id',
        policy_id: 'policy-id',
      })
    ).toEqual({ column: 'mycover_policy_id', value: 'policy-id' });
  });

  it('can disable data.id fallback for renewal payloads', () => {
    expect(getPolicyLookup({ id: 'renewal-id' }, { dataIdColumn: null })).toBe(
      null
    );
  });

  it('extracts nested renewal detail identifiers', () => {
    expect(
      getLookupFromRenewalDetails({ data: { policy: { id: 'policy-123' } } })
    ).toEqual({ column: 'mycover_policy_id', value: 'policy-123' });
    expect(
      getLookupFromRenewalDetails({
        data: { purchase: { id: 'purchase-123' } },
      })
    ).toEqual({ column: 'mycover_purchase_id', value: 'purchase-123' });
  });

  it('normalizes truthy pre-loss approval flags', () => {
    expect(isPreLossInspectionApproved({ meta: { is_approved: 'yes' } })).toBe(
      true
    );
    expect(
      isPreLossInspectionApproved({ essential: { is_approved: 'no' } })
    ).toBe(false);
  });
});

describe('resolveRenewalPolicyLookup', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('returns null without calling the API when no secret is available', async () => {
    mockGetMyCoverSecretKey.mockReturnValue(undefined);
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    expect(await resolveRenewalPolicyLookup('renewal-1', '   ')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('falls back to the configured secret and resolves the lookup on success', async () => {
    mockGetMyCoverSecretKey.mockReturnValue(undefined);
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { policy: { id: 'policy-123' } } }),
    });
    vi.stubGlobal('fetch', fetchSpy);

    const lookup = await resolveRenewalPolicyLookup('renewal-1', 'cfg-secret');

    expect(lookup).toEqual({
      column: 'mycover_policy_id',
      value: 'policy-123',
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer cfg-secret');
  });

  it('throws when the renewal-details fetch is not OK', async () => {
    mockGetMyCoverSecretKey.mockReturnValue('env-secret');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 502 })
    );

    await expect(resolveRenewalPolicyLookup('renewal-1', '')).rejects.toThrow(
      /Failed to resolve MyCover renewal details/
    );
  });

  it('returns null when the renewal payload carries no identifiers', async () => {
    mockGetMyCoverSecretKey.mockReturnValue('env-secret');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: {} }),
      })
    );

    expect(await resolveRenewalPolicyLookup('renewal-1', '')).toBeNull();
  });
});
