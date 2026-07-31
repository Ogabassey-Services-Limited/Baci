import { beforeEach, describe, expect, it } from 'vitest';
import {
  MERCHANT_ID,
  makeRequest,
  mockAuthenticateApiRequest,
  mockCheckCsrfProtection,
  mockGetMerchantForApiRequest,
  mockHasPermission,
  resetPublishRouteMocks,
  setupAuthenticatedRequest,
} from './route.test-support';

const { resolvePublishMerchantAccess } = await import(
  './resolve-publish-merchant-access'
);

beforeEach(resetPublishRouteMocks);

describe('resolvePublishMerchantAccess', () => {
  it('rejects an unauthenticated request before evaluating CSRF', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({
      error: 'Unauthorized',
      supabase: null,
      user: null,
    });

    const result = await resolvePublishMerchantAccess(makeRequest('POST'));

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected an error response');
    expect(result.response.status).toBe(401);
    expect(mockCheckCsrfProtection).not.toHaveBeenCalled();
  });

  it('rejects malformed merchant requests before resolving merchant access', async () => {
    setupAuthenticatedRequest();

    const result = await resolvePublishMerchantAccess(
      makeRequest('POST', undefined, null)
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected an error response');
    expect(result.response.status).toBe(400);
    expect(mockGetMerchantForApiRequest).not.toHaveBeenCalled();
  });

  it('rejects access without the settings edit permission', async () => {
    setupAuthenticatedRequest();
    mockHasPermission.mockReturnValue(false);

    const result = await resolvePublishMerchantAccess(makeRequest('POST'));

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected an error response');
    expect(result.response.status).toBe(403);
  });

  it('returns the authorized merchant and authenticated client', async () => {
    const supabase = setupAuthenticatedRequest();

    const result = await resolvePublishMerchantAccess(makeRequest('DELETE'));

    expect(result).toMatchObject({
      merchantId: MERCHANT_ID,
      ok: true,
      supabase,
    });
  });
});
