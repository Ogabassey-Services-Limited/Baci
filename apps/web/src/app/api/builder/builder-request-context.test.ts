import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAuthenticatedUser: vi.fn(),
  getMerchantForApiRequest: vi.fn(),
  hasPermission: vi.fn(),
}));

vi.mock('@/lib/supabase/mobile-auth', () => ({
  getAuthenticatedUser: mocks.getAuthenticatedUser,
}));
vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: mocks.getMerchantForApiRequest,
  toUserAccess: (context: { merchantId: string; staffAccess: object }) => ({
    merchantId: context.merchantId,
    ...context.staffAccess,
  }),
}));
vi.mock('@/lib/api-auth', () => ({ hasPermission: mocks.hasPermission }));

import {
  getBuilderAuthentication,
  getBuilderRequestContext,
} from './builder-request-context';

describe('getBuilderRequestContext', () => {
  const supabase = { scope: 'caller' };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthenticatedUser.mockResolvedValue({
      supabase,
      user: { id: 'user-1' },
    });
    mocks.getMerchantForApiRequest.mockResolvedValue({
      merchantId: '22222222-2222-4222-8222-222222222222',
      staffAccess: {
        isOwner: true,
        isStaff: false,
        permissions: { full_access: { all: true } },
        role: 'owner',
      },
    });
    mocks.hasPermission.mockReturnValue(true);
  });

  it('resolves the explicit builder mutation target before authorizing edit access', async () => {
    const requestedMerchantId = '22222222-2222-4222-8222-222222222222';

    const result = await getBuilderRequestContext(
      new NextRequest('http://localhost/api/builder'),
      'edit',
      requestedMerchantId
    );

    expect(mocks.getMerchantForApiRequest).toHaveBeenCalledWith(
      supabase,
      'user-1',
      { requestedMerchantId }
    );
    expect(result).toEqual({
      context: {
        merchantId: requestedMerchantId,
        supabase,
        canEdit: true,
      },
    });
  });

  it('reuses the initial authentication when authorizing the builder request context', async () => {
    const request = new NextRequest('http://localhost/api/builder');
    const authentication = await getBuilderAuthentication(request);

    if (authentication.response) {
      throw new Error('Expected the test authentication to succeed');
    }

    const result = await getBuilderRequestContext(
      request,
      'edit',
      '22222222-2222-4222-8222-222222222222',
      authentication.auth
    );

    expect(result).toMatchObject({
      context: {
        merchantId: '22222222-2222-4222-8222-222222222222',
        supabase,
      },
    });
    expect(mocks.getAuthenticatedUser).toHaveBeenCalledTimes(1);
  });
});
