import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getMobileBearerUser: vi.fn(),
  provisionAuthenticatedMerchant: vi.fn(),
  loadMobileMerchantStarterFacts: vi.fn(),
  provisionCuratedHomepage: vi.fn(),
  recordContract: vi.fn(),
}));

vi.mock('./get-mobile-bearer-user', () => ({
  getMobileBearerUser: mocks.getMobileBearerUser,
}));
vi.mock('./provision-authenticated-merchant', async () => {
  const actual = await vi.importActual<
    typeof import('./provision-authenticated-merchant')
  >('./provision-authenticated-merchant');
  return {
    ...actual,
    provisionAuthenticatedMerchant: mocks.provisionAuthenticatedMerchant,
  };
});
vi.mock('@/lib/storefront-defaults/provision-curated-homepage', () => ({
  provisionCuratedHomepage: mocks.provisionCuratedHomepage,
}));
vi.mock('./load-mobile-merchant-starter-facts', async () => {
  const actual = await vi.importActual<
    typeof import('./load-mobile-merchant-starter-facts')
  >('./load-mobile-merchant-starter-facts');
  return {
    ...actual,
    loadMobileMerchantStarterFacts: mocks.loadMobileMerchantStarterFacts,
  };
});
vi.mock('@/lib/posthog/mobile-onboarding-contract-telemetry', () => ({
  recordMobileOnboardingContractInvocation: mocks.recordContract,
}));
vi.mock('next/server', async () => {
  const actual =
    await vi.importActual<typeof import('next/server')>('next/server');
  return { ...actual, after: vi.fn() };
});

import { POST } from './route';

const validBody = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  businessName: '  Analytical   Engines  ',
  businessType: 'technology',
  country: 'NG',
  slug: 'analytical-engines',
  slugIsCustom: true,
  brandColors: { primary: '#111111', background: '#ffffff', accent: '#f59e0b' },
};
const user = { id: 'user-1', email: 'ada@example.com' };
const supabase = { rpc: vi.fn() };

function request(body: Record<string, unknown>): NextRequest {
  return new NextRequest(
    'https://usebaci.com/api/mobile/merchant-provisioning',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token',
        'X-Baci-Platform': 'ios',
      },
      body: JSON.stringify(body),
    }
  );
}

describe('authenticated mobile canonical provisioning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getMobileBearerUser.mockResolvedValue({
      authenticated: true,
      user,
      supabase,
    });
    mocks.provisionAuthenticatedMerchant.mockResolvedValue({
      merchantId: 'merchant-1',
      merchantSlug: 'analytical-engines',
      created: true,
    });
    mocks.loadMobileMerchantStarterFacts.mockResolvedValue({
      merchantId: 'merchant-1',
      merchantSlug: 'analytical-engines',
      businessName: 'Analytical Engines',
      businessType: 'technology',
      merchantLogoUrl: null,
      brandColors: validBody.brandColors,
    });
    mocks.provisionCuratedHomepage.mockResolvedValue({
      status: 'created',
      updatedAt: null,
    });
  });

  it('treats an existing canonical home as a successful provisioning outcome', async () => {
    mocks.provisionCuratedHomepage.mockResolvedValue({
      status: 'already_exists',
      updatedAt: null,
    });

    const response = await POST(request(validBody));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true });
  });

  it('uses the shared fallback palette when the client omits one', async () => {
    mocks.loadMobileMerchantStarterFacts.mockResolvedValue({
      merchantId: 'merchant-1',
      merchantSlug: 'analytical-engines',
      businessName: 'Analytical Engines',
      businessType: 'technology',
      merchantLogoUrl: null,
      brandColors: {
        primary: '#000000',
        background: '#ffffff',
        accent: '#F59E0B',
      },
    });
    const { brandColors: _brandColors, ...bodyWithoutPalette } = validBody;

    const response = await POST(request(bodyWithoutPalette));

    expect(response.status).toBe(200);
    expect(mocks.provisionCuratedHomepage).toHaveBeenCalledWith(
      expect.objectContaining({
        brandColors: {
          primary: '#000000',
          background: '#ffffff',
          accent: '#F59E0B',
        },
      })
    );
  });

  it('rebuilds a missing authenticated home from persisted optional starter facts', async () => {
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
    const { brandColors: _brandColors, ...omitted } = validBody;

    const response = await POST(request(omitted));

    expect(response.status).toBe(200);
    expect(mocks.loadMobileMerchantStarterFacts).toHaveBeenCalledWith({
      supabase,
      merchantId: 'merchant-1',
      ownerUserId: 'user-1',
    });
    expect(mocks.provisionCuratedHomepage).toHaveBeenCalledWith(
      expect.objectContaining({
        merchantSlug: 'persisted-store',
        businessName: 'Persisted Store',
        businessType: 'technology',
        merchantLogoUrl: 'https://cdn.example.com/persisted-logo.png',
      })
    );
  });

  it('blocks success when the authenticated persisted fact read fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const starterFactsError = new Error(
      'Could not load persisted store setup.'
    );
    starterFactsError.name = 'MobileMerchantStarterFactsError';
    mocks.loadMobileMerchantStarterFacts.mockRejectedValue(starterFactsError);

    const response = await POST(request(validBody));

    expect(response.status).toBe(500);
    expect(mocks.provisionCuratedHomepage).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      'mobile-merchant-provisioning %s',
      'provisioning_failed',
      JSON.stringify({ stage: 'facts_read', pgCode: null })
    );
    errorSpy.mockRestore();
  });
});
