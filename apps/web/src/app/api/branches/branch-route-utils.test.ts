import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authenticateApiRequest: vi.fn(),
  getMerchantForApiRequest: vi.fn(),
}));

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: mocks.authenticateApiRequest,
}));

vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: mocks.getMerchantForApiRequest,
}));

import {
  authenticateAndResolveMerchant,
  mapBranchMutationError,
  parseRequestedMerchantId,
} from './branch-route-utils';

const MERCHANT_ID = '123e4567-e89b-42d3-a456-426614174001';

function requestWithMerchant(value?: string) {
  return new NextRequest('https://usebaci.com/api/branches', {
    headers: value ? { 'x-baci-merchant-id': value } : undefined,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('parseRequestedMerchantId', () => {
  it('returns no merchant override when the header is missing', () => {
    expect(parseRequestedMerchantId(requestWithMerchant())).toEqual({
      merchantId: null,
      response: null,
    });
  });

  it('returns a 400 response for invalid merchant overrides', async () => {
    const result = parseRequestedMerchantId(requestWithMerchant('not-a-uuid'));

    expect(result.merchantId).toBeNull();
    expect(result.response?.status).toBe(400);
    await expect(result.response?.json()).resolves.toEqual({
      error: 'Invalid merchant context',
    });
  });

  it('returns a valid merchant override from the request header', () => {
    expect(parseRequestedMerchantId(requestWithMerchant(MERCHANT_ID))).toEqual({
      merchantId: MERCHANT_ID,
      response: null,
    });
  });
});

describe('mapBranchMutationError', () => {
  it('maps missing rows to 404', async () => {
    const response = mapBranchMutationError(
      { code: 'PGRST116', message: 'not found' },
      'Fallback'
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: 'Branch not found',
    });
  });

  it('maps permission errors to 403', async () => {
    const response = mapBranchMutationError(
      { code: '42501', message: 'permission denied' },
      'Fallback'
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Forbidden' });
  });

  it('maps last active branch guard failures to 409', async () => {
    const response = mapBranchMutationError(
      { code: '23514', message: 'Cannot deactivate the only active branch' },
      'Fallback'
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: 'Cannot deactivate the only active branch',
    });
  });

  it('maps default branch unique conflicts to 409', async () => {
    const response = mapBranchMutationError(
      {
        code: '23505',
        constraint: 'idx_branches_one_active_default_per_merchant',
        message: 'duplicate key value violates unique constraint',
      },
      'Fallback'
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: 'Default branch conflict',
    });
  });

  it('maps other unique conflicts to 409', async () => {
    const response = mapBranchMutationError(
      {
        code: '23505',
        constraint: 'branches_name_key',
        message: 'duplicate key value violates unique constraint',
      },
      'Fallback'
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: 'Conflict',
    });
  });

  it('maps generic check violations to 400', async () => {
    const response = mapBranchMutationError(
      { code: '23514', message: 'Invalid branch assignment' },
      'Fallback'
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid branch mutation',
    });
  });

  it('uses the fallback for unknown and null errors', async () => {
    const unknownResponse = mapBranchMutationError(
      { code: 'XX000', message: 'unknown' },
      'Fallback'
    );
    const nullResponse = mapBranchMutationError(null, 'Fallback');

    expect(unknownResponse.status).toBe(500);
    await expect(unknownResponse.json()).resolves.toEqual({
      error: 'Fallback',
    });
    expect(nullResponse.status).toBe(500);
    await expect(nullResponse.json()).resolves.toEqual({ error: 'Fallback' });
  });
});

describe('authenticateAndResolveMerchant', () => {
  it('returns a static unauthorized response for auth failures', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mocks.authenticateApiRequest.mockResolvedValueOnce({
      error: 'token contains sensitive detail',
      supabase: null,
      user: null,
    });

    const result = await authenticateAndResolveMerchant(requestWithMerchant());

    expect(result.supabase).toBeNull();
    expect(result.merchantContext).toBeNull();
    expect(result.response?.status).toBe(401);
    await expect(result.response?.json()).resolves.toEqual({
      error: 'Unauthorized',
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[Branches] Authentication failed:',
      'token contains sensitive detail'
    );

    consoleErrorSpy.mockRestore();
  });
});
