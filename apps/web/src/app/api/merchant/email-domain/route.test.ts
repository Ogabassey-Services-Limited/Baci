import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetUser,
  mockGetMerchant,
  mockMerchantRow,
  mockGetDomain,
  mockRegister,
  mockSetEnabled,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetMerchant: vi.fn(),
  mockMerchantRow: vi.fn(),
  mockGetDomain: vi.fn(),
  mockRegister: vi.fn(),
  mockSetEnabled: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: () =>
    Promise.resolve({
      auth: { getUser: mockGetUser },
      from: () => ({
        select: () => ({
          eq: () => ({ single: () => Promise.resolve(mockMerchantRow()) }),
        }),
      }),
    }),
}));
vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: mockGetMerchant,
}));
vi.mock('@/lib/merchant-email-domain', () => ({
  getMerchantEmailDomain: mockGetDomain,
  registerMerchantEmailDomain: mockRegister,
  setMerchantEmailDomainEnabled: mockSetEnabled,
}));

import { GET, PATCH, POST } from './route';

function req(body: unknown): NextRequest {
  return { json: () => Promise.resolve(body) } as unknown as NextRequest;
}

function signedInAs(planTier: string | null, slug = 'mystore') {
  mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
  mockGetMerchant.mockResolvedValue({ merchantId: 'm1', merchantSlug: slug });
  mockMerchantRow.mockReturnValue({ data: { plan_tier: planTier, slug } });
}

describe('POST /api/merchant/email-domain', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(req({ domain: 'mystore.com' }));
    expect(res.status).toBe(401);
  });

  it('returns 403 when the merchant context is missing', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockGetMerchant.mockResolvedValue(null);
    const res = await POST(req({ domain: 'mystore.com' }));
    expect(res.status).toBe(403);
  });

  it('returns 403 when the plan lacks the custom-email-domain feature', async () => {
    signedInAs('free');
    const res = await POST(req({ domain: 'mystore.com' }));
    expect(res.status).toBe(403);
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid domain', async () => {
    signedInAs('pro');
    const res = await POST(req({ domain: 'not a domain' }));
    expect(res.status).toBe(400);
  });

  it('registers the domain for an entitled merchant', async () => {
    signedInAs('pro');
    mockRegister.mockResolvedValue({
      domain: 'mystore.com',
      status: 'pending',
    });
    const res = await POST(req({ domain: 'MyStore.com' }));
    expect(res.status).toBe(200);
    expect(mockRegister).toHaveBeenCalledWith('m1', 'mystore.com');
  });
});

describe('GET /api/merchant/email-domain', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the current domain config', async () => {
    signedInAs('pro');
    mockGetDomain.mockResolvedValue({
      domain: 'mystore.com',
      status: 'verified',
    });
    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      domain: { domain: 'mystore.com', status: 'verified' },
    });
  });
});

describe('PATCH /api/merchant/email-domain', () => {
  beforeEach(() => vi.clearAllMocks());

  it('enables sending for an entitled merchant', async () => {
    signedInAs('pro');
    mockSetEnabled.mockResolvedValue({ enabled: true });
    const res = await PATCH(req({ enabled: true }));
    expect(res.status).toBe(200);
    expect(mockSetEnabled).toHaveBeenCalledWith('m1', true);
  });

  it('returns 400 when the body is invalid', async () => {
    signedInAs('pro');
    const res = await PATCH(req({ enabled: 'yes' }));
    expect(res.status).toBe(400);
  });
});
