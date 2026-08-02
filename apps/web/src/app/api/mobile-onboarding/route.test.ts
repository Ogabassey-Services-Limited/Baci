import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  runLegacyMobileSignup: vi.fn(),
  provisionAuthenticatedMerchant: vi.fn(),
  provisionCuratedHomepage: vi.fn(),
  recordContract: vi.fn(),
  afterCallbacks: [] as Array<() => Promise<void>>,
}));

vi.mock('./legacy-mobile-signup', () => ({
  runLegacyMobileSignup: mocks.runLegacyMobileSignup,
}));
vi.mock('@/lib/storefront-defaults/provision-curated-homepage', () => ({
  provisionCuratedHomepage: mocks.provisionCuratedHomepage,
}));
vi.mock(
  '../mobile/merchant-provisioning/provision-authenticated-merchant',
  async () => {
    const actual = await vi.importActual<
      typeof import('../mobile/merchant-provisioning/provision-authenticated-merchant')
    >('../mobile/merchant-provisioning/provision-authenticated-merchant');
    return {
      ...actual,
      provisionAuthenticatedMerchant: mocks.provisionAuthenticatedMerchant,
    };
  }
);
vi.mock('@/lib/posthog/mobile-onboarding-contract-telemetry', () => ({
  recordMobileOnboardingContractInvocation: mocks.recordContract,
}));
vi.mock('next/server', async () => {
  const actual =
    await vi.importActual<typeof import('next/server')>('next/server');
  return {
    ...actual,
    after: vi.fn((callback: () => Promise<void>) => {
      mocks.afterCallbacks.push(callback);
    }),
  };
});

import { POST } from './route';

const validBody = {
  email: 'ada@example.com',
  password: 'StrongP@ss123!',
  confirmPassword: 'StrongP@ss123!',
  firstName: 'Ada',
  lastName: 'Lovelace',
  businessName: '  Analytical   Engines  ',
  businessType: 'fashion',
  country: 'NG',
  slug: 'analytical-engines',
  brandColors: JSON.stringify({
    primary: '#111',
    background: '#fff',
    accent: '#f59e0b',
  }),
};

function request(
  body: Record<string, unknown>,
  headers: HeadersInit = {}
): NextRequest {
  return new NextRequest('https://usebaci.com/api/mobile-onboarding', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('POST /api/mobile-onboarding v1 compatibility', () => {
  const user = { id: 'user-1', email: 'ada@example.com' };
  const supabase = { rpc: vi.fn(), from: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.afterCallbacks.length = 0;
    mocks.runLegacyMobileSignup.mockResolvedValue({
      ok: true,
      user,
      supabase,
      accountCreated: true,
    });
    mocks.provisionAuthenticatedMerchant.mockResolvedValue({
      merchantId: 'merchant-1',
      merchantSlug: 'analytical-engines',
      created: true,
    });
    mocks.provisionCuratedHomepage.mockResolvedValue({
      status: 'created',
      updatedAt: '2026-08-02T00:00:00Z',
    });
    mocks.recordContract.mockResolvedValue(undefined);
  });

  it('counts invalid public v1 attempts before body validation', async () => {
    const response = await POST(request({ email: 'bad' }));

    expect(response.status).toBe(400);
    expect(mocks.runLegacyMobileSignup).not.toHaveBeenCalled();
    expect(mocks.afterCallbacks).toHaveLength(1);
    await mocks.afterCallbacks[0]?.();
    expect(mocks.recordContract).toHaveBeenCalledWith('v1_legacy');
  });

  it('counts account-exists attempts exactly once', async () => {
    mocks.runLegacyMobileSignup.mockResolvedValue({
      ok: false,
      response: NextResponse.json(
        {
          error: 'User already exists. Please log in.',
          code: 'account_exists',
        },
        { status: 409 }
      ),
    });

    const response = await POST(request(validBody));

    expect(response.status).toBe(409);
    expect(mocks.afterCallbacks).toHaveLength(1);
    await mocks.afterCallbacks[0]?.();
    expect(mocks.recordContract).toHaveBeenCalledOnce();
    expect(mocks.provisionAuthenticatedMerchant).not.toHaveBeenCalled();
  });

  it('preserves the v1 success response while using the shared RPC adapter', async () => {
    const response = await POST(
      request(validBody, { 'User-Agent': 'Baci iPhone' })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      user: { id: 'user-1', email: 'ada@example.com' },
      merchant: { id: 'merchant-1', slug: 'analytical-engines' },
      message: 'Account created successfully',
    });
    expect(mocks.runLegacyMobileSignup).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'ada@example.com',
        password: 'StrongP@ss123!',
        slugIsCustom: true,
      })
    );
    expect(mocks.provisionAuthenticatedMerchant).toHaveBeenCalledWith({
      supabase,
      user,
      platform: 'ios',
      input: expect.objectContaining({
        businessName: 'Analytical Engines',
        slugIsCustom: true,
      }),
    });
    expect(mocks.afterCallbacks).toHaveLength(1);
    await Promise.all(mocks.afterCallbacks.map((callback) => callback()));
    expect(mocks.recordContract).toHaveBeenCalledOnce();
    expect(mocks.provisionCuratedHomepage).toHaveBeenCalledWith(
      expect.objectContaining({
        supabase,
        expectedOwnerUserId: 'user-1',
        merchantId: 'merchant-1',
        merchantSlug: 'analytical-engines',
        businessName: 'Analytical Engines',
      })
    );
  });

  it('keeps an omitted legacy completion slug auto-deduplicable', async () => {
    mocks.runLegacyMobileSignup.mockResolvedValue({
      ok: true,
      user,
      supabase,
      accountCreated: false,
    });

    await POST(
      request(validBody, { Authorization: 'Bearer existing-session' })
    );

    expect(mocks.provisionAuthenticatedMerchant).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({ slugIsCustom: false }),
      })
    );
  });

  it('waits for canonical homepage provisioning before returning success', async () => {
    mocks.provisionCuratedHomepage.mockResolvedValue({
      status: 'failed',
      stage: 'insert',
    });

    const response = await POST(request(validBody));

    expect(response.status).toBe(500);
    expect(mocks.provisionCuratedHomepage).toHaveBeenCalledWith(
      expect.objectContaining({
        supabase,
        expectedOwnerUserId: 'user-1',
        merchantId: 'merchant-1',
        merchantSlug: 'analytical-engines',
        businessName: 'Analytical Engines',
      })
    );
  });
});
