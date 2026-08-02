import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getMobileBearerUser: vi.fn(),
  provisionAuthenticatedMerchant: vi.fn(),
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
});
