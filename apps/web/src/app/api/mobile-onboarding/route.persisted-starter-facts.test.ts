import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  runLegacyMobileSignup: vi.fn(),
  provisionAuthenticatedMerchant: vi.fn(),
  loadMobileMerchantStarterFacts: vi.fn(),
  provisionCuratedHomepage: vi.fn(),
  recordContract: vi.fn(),
}));

vi.mock('./legacy-mobile-signup', () => ({
  runLegacyMobileSignup: mocks.runLegacyMobileSignup,
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
vi.mock(
  '../mobile/merchant-provisioning/load-mobile-merchant-starter-facts',
  async () => {
    const actual = await vi.importActual<
      typeof import('../mobile/merchant-provisioning/load-mobile-merchant-starter-facts')
    >('../mobile/merchant-provisioning/load-mobile-merchant-starter-facts');
    return {
      ...actual,
      loadMobileMerchantStarterFacts: mocks.loadMobileMerchantStarterFacts,
    };
  }
);
vi.mock('@/lib/storefront-defaults/provision-curated-homepage', () => ({
  provisionCuratedHomepage: mocks.provisionCuratedHomepage,
}));
vi.mock('@/lib/posthog/mobile-onboarding-contract-telemetry', () => ({
  recordMobileOnboardingContractInvocation: mocks.recordContract,
}));
vi.mock('next/server', async () => {
  const actual =
    await vi.importActual<typeof import('next/server')>('next/server');
  return { ...actual, after: vi.fn() };
});

import { POST } from './route';

const user = { id: 'user-1', email: 'ada@example.com' };
const supabase = { rpc: vi.fn(), from: vi.fn() };
const validBody = {
  email: 'ada@example.com',
  password: 'StrongP@ss123!',
  confirmPassword: 'StrongP@ss123!',
  firstName: 'Ada',
  lastName: 'Lovelace',
  businessName: 'Submitted Store',
  businessType: 'fashion',
  country: 'NG',
  slug: 'submitted-store',
  brandColors: 'null',
};

function request(body: Record<string, unknown>) {
  return new NextRequest('https://usebaci.com/api/mobile-onboarding', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('legacy mobile persisted starter facts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.runLegacyMobileSignup.mockResolvedValue({
      ok: true,
      user,
      supabase,
      accountCreated: false,
    });
    mocks.provisionAuthenticatedMerchant.mockResolvedValue({
      merchantId: 'merchant-1',
      merchantSlug: 'rpc-slug',
      created: false,
    });
    mocks.loadMobileMerchantStarterFacts.mockResolvedValue({
      merchantId: 'merchant-1',
      merchantSlug: 'persisted-store',
      businessName: 'Persisted Store',
      businessType: 'technology',
      merchantLogoUrl: 'https://cdn.example.com/persisted-logo.png',
      brandColors: {
        primary: '#112233',
        background: '#ffffff',
        accent: '#445566',
      },
    });
    mocks.provisionCuratedHomepage.mockResolvedValue({
      status: 'created',
      updatedAt: null,
    });
  });

  it('rebuilds a missing home from persisted facts rather than omitted request fields', async () => {
    const response = await POST(request(validBody));

    expect(response.status).toBe(200);
    expect(mocks.loadMobileMerchantStarterFacts).toHaveBeenCalledWith({
      supabase,
      merchantId: 'merchant-1',
      ownerUserId: 'user-1',
    });
    expect(mocks.provisionCuratedHomepage).toHaveBeenCalledWith(
      expect.objectContaining({
        merchantId: 'merchant-1',
        merchantSlug: 'persisted-store',
        businessName: 'Persisted Store',
        businessType: 'technology',
        merchantLogoUrl: 'https://cdn.example.com/persisted-logo.png',
        brandColors: {
          primary: '#112233',
          background: '#ffffff',
          accent: '#445566',
        },
      })
    );
  });

  it('blocks success when the persisted fact read fails', async () => {
    mocks.loadMobileMerchantStarterFacts.mockRejectedValue(
      new Error('RLS read failed')
    );

    const response = await POST(request(validBody));

    expect(response.status).toBe(500);
    expect(mocks.provisionCuratedHomepage).not.toHaveBeenCalled();
  });
});
