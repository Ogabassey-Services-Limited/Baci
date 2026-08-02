import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  getActionMocks,
  makeFormData,
  prevState,
  setupActionMocks,
  setupChainedMock,
  submitOnboarding,
  validFields,
} from './actions.test-support';

const mocks = getActionMocks();
describe('onboarding action starter storefront effects', () => {
  beforeEach(setupActionMocks);
  function readyMerchant() {
    mocks.adminMaybeSingle.mockResolvedValue({ data: null, error: null });
    setupChainedMock({ id: 'merchant-1', slug: 'teststore' });
  }
  it('uses one authenticated client to ensure the domain before canonical homepage provisioning', async () => {
    readyMerchant();
    const result = await submitOnboarding(prevState, makeFormData(validFields));
    expect(result).toMatchObject({ success: true, merchantId: 'merchant-1' });
    expect(mocks.ensureOnboardingDomain).toHaveBeenCalledWith(
      expect.objectContaining({ merchantId: 'merchant-1', slug: 'teststore' })
    );
    expect(mocks.provisionCuratedHomepage).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedOwnerUserId: 'user-123',
        merchantId: 'merchant-1',
      })
    );
  });
  it('blocks success and preserves a structured template failure log when canonical provisioning fails', async () => {
    readyMerchant();
    mocks.provisionCuratedHomepage.mockResolvedValue({
      status: 'failed',
      stage: 'insert',
    });
    const result = await submitOnboarding(prevState, makeFormData(validFields));
    expect(result.success).toBe(false);
    expect(mocks.loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Template generation failed',
        merchantId: 'merchant-1',
      })
    );
  });
  it('blocks success when the exact domain cannot be ensured', async () => {
    readyMerchant();
    mocks.ensureOnboardingDomain.mockResolvedValue({ status: 'conflict' });
    await expect(
      submitOnboarding(prevState, makeFormData(validFields))
    ).resolves.toMatchObject({ success: false });
    expect(mocks.provisionCuratedHomepage).not.toHaveBeenCalled();
  });
  it('contains no privileged client, AI enqueue, server event, or hero-assignment dependency', () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        'src/app/(platform)/onboarding/submit-onboarding-workflow.ts'
      ),
      'utf8'
    );
    for (const forbidden of [
      '@/lib/supabase/admin',
      '@/lib/supabase/service',
      'ai_jobs',
      'triggerAiStorefrontWorker',
      'recordPlatformDomainEvent',
      'assignHeroImagesToMerchant',
      'generateInitialTemplate',
    ])
      expect(source).not.toContain(forbidden);
  });
});
