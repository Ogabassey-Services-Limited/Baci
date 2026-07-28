import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  captureServerEvent: vi.fn(),
}));

vi.mock('@/lib/posthog/server', () => ({
  captureServerEvent: mocks.captureServerEvent,
}));

import { recordMobileOnboardingContractInvocation } from './mobile-onboarding-contract-telemetry';

describe('recordMobileOnboardingContractInvocation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('POSTHOG_RELEASE_VERSION', 'release-1');
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('VERCEL_GIT_COMMIT_REF', 'main');
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'sha-1');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    'v1_legacy',
    'v2_authenticated',
  ] as const)('captures the %s contract with release context and no request data', async (contract) => {
    mocks.captureServerEvent.mockResolvedValue(true);

    await recordMobileOnboardingContractInvocation(contract);

    expect(mocks.captureServerEvent).toHaveBeenCalledTimes(1);
    expect(mocks.captureServerEvent).toHaveBeenCalledWith(
      'mobile_onboarding_contract_invoked',
      {
        contract,
        release_version: 'release-1',
        git_commit_sha: 'sha-1',
        git_commit_ref: 'main',
        vercel_environment: 'production',
      }
    );
    const serialized = JSON.stringify(
      mocks.captureServerEvent.mock.calls[0]
    ).toLowerCase();
    for (const forbidden of [
      'email',
      'password',
      'token',
      'business',
      'phone',
      'slug',
      'authorization',
      'headers',
      'body',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('emits a stable structured telemetry-gap warning when capture fails', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mocks.captureServerEvent.mockResolvedValue(false);

    await expect(
      recordMobileOnboardingContractInvocation('v2_authenticated')
    ).resolves.toBeUndefined();

    expect(warning).toHaveBeenCalledWith(
      'mobile_onboarding_contract_telemetry_gap %s',
      JSON.stringify({
        contract: 'v2_authenticated',
        release_version: 'release-1',
        git_commit_sha: 'sha-1',
        git_commit_ref: 'main',
        vercel_environment: 'production',
      })
    );
    warning.mockRestore();
  });
});
