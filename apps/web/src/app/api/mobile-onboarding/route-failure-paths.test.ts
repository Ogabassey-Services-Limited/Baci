import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MobileProvisioningError } from '../mobile/merchant-provisioning/provision-authenticated-merchant';

const mocks = vi.hoisted(() => ({
  signup: vi.fn(),
  provision: vi.fn(),
  callbacks: [] as Array<() => Promise<void>>,
}));

vi.mock('./legacy-mobile-signup', () => ({
  runLegacyMobileSignup: mocks.signup,
}));
vi.mock(
  '../mobile/merchant-provisioning/provision-authenticated-merchant',
  async () => {
    const actual = await vi.importActual<
      typeof import('../mobile/merchant-provisioning/provision-authenticated-merchant')
    >('../mobile/merchant-provisioning/provision-authenticated-merchant');
    return { ...actual, provisionAuthenticatedMerchant: mocks.provision };
  }
);
vi.mock(
  '../mobile/merchant-provisioning/run-deferred-merchant-provisioning',
  () => ({
    runDeferredMerchantProvisioning: vi.fn(),
  })
);
vi.mock('@/lib/posthog/mobile-onboarding-contract-telemetry', () => ({
  recordMobileOnboardingContractInvocation: vi.fn(),
}));
vi.mock('next/server', async () => {
  const actual =
    await vi.importActual<typeof import('next/server')>('next/server');
  return {
    ...actual,
    after: vi.fn((callback: () => Promise<void>) => {
      mocks.callbacks.push(callback);
    }),
  };
});

import { POST } from './route';

const body = {
  email: 'ada@example.com',
  password: 'StrongP@ss123!',
  confirmPassword: 'StrongP@ss123!',
  firstName: 'Ada',
  lastName: 'Lovelace',
  businessName: 'Analytical Engines',
  businessType: 'fashion',
  country: 'NG',
  slug: 'analytical-engines',
  brandColors: '{"primary":"#111","background":"#fff","accent":"#f59e0b"}',
};

function request(): NextRequest {
  return new NextRequest('https://usebaci.com/api/mobile-onboarding', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/mobile-onboarding provisioning failures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.callbacks.length = 0;
    mocks.signup.mockResolvedValue({
      ok: true,
      user: { id: 'user-1', email: 'ada@example.com' },
      supabase: { rpc: vi.fn() },
      accountCreated: false,
    });
  });

  it('returns slug_unavailable for an authenticated retry', async () => {
    mocks.provision.mockRejectedValue(new MobileProvisioningError('PT409'));

    const response = await POST(request());

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: 'slug_unavailable',
    });
  });

  it('routes a just-created account to sign-in recovery after a rare provisioning race', async () => {
    mocks.signup.mockResolvedValue({
      ok: true,
      user: { id: 'user-1', email: 'ada@example.com' },
      supabase: { rpc: vi.fn() },
      accountCreated: true,
    });
    mocks.provision.mockRejectedValue(new MobileProvisioningError('PT409'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await POST(request());

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      code: 'account_created_store_setup_failed',
      error: expect.stringMatching(/sign in/i),
    });
  });

  it('routes a just-created account to sign-in recovery after RPC validation fails', async () => {
    mocks.signup.mockResolvedValue({
      ok: true,
      user: { id: 'user-1', email: 'ada@example.com' },
      supabase: { rpc: vi.fn() },
      accountCreated: true,
    });
    mocks.provision.mockRejectedValue(new MobileProvisioningError('PT400'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await POST(request());

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      code: 'account_created_store_setup_failed',
      error: expect.stringMatching(/sign in/i),
    });
  });

  it('never exposes an unexpected database error message', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.provision.mockRejectedValue(
      Object.assign(new Error('password=raw-secret'), { code: '42501' })
    );

    const response = await POST(request());
    const responseBody = await response.json();

    expect(response.status).toBe(500);
    expect(responseBody).toEqual({
      error: 'Internal Server Error',
      code: 'onboarding_failed',
    });
    expect(JSON.stringify(responseBody)).not.toContain('raw-secret');
  });
});
