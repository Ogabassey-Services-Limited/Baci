import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ ensureActionRateLimit: vi.fn() }));

vi.mock('@/lib/ensure-action-rate-limit', () => ({
  ensureActionRateLimit: mocks.ensureActionRateLimit,
}));

import { runSubmitOnboardingWorkflow } from './submit-onboarding-workflow';

describe('runSubmitOnboardingWorkflow', () => {
  beforeEach(() => {
    mocks.ensureActionRateLimit.mockReset();
  });

  it('retains the action rate-limit response before reaching authentication', async () => {
    mocks.ensureActionRateLimit.mockResolvedValue(false);

    await expect(
      runSubmitOnboardingWorkflow(
        { success: false, message: '' },
        new FormData()
      )
    ).resolves.toEqual({
      success: false,
      message: 'Too many onboarding attempts. Please try again later.',
    });
  });
});
