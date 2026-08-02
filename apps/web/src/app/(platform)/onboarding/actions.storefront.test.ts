import { beforeEach, describe, expect, it } from 'vitest';
import {
  flushAfterCallbacks,
  getActionMocks,
  makeFormData,
  prevState,
  setupActionMocks,
  setupChainedMock,
  submitOnboarding,
  updatedAt,
  validFields,
} from './actions.test-support';

const mocks = getActionMocks();

describe('onboarding action starter storefront effects', () => {
  beforeEach(setupActionMocks);

  function readyMerchant() {
    mocks.adminMaybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    setupChainedMock({ id: 'merchant-1', slug: 'teststore' });
  }

  it('durably records signup completion from the trusted server producer', async () => {
    mocks.isEventPipelineEnqueueEnabled.mockReturnValue(true);
    readyMerchant();

    const result = await submitOnboarding(prevState, makeFormData(validFields));

    expect(result.success).toBe(true);
    expect(mocks.recordPlatformDomainEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        deliveryData: { email: 'merchant@example.com' },
        eventName: 'platform.merchant_signup_completed.v1',
        externalEventId: 'merchant_signup_completed:merchant-1',
        merchantId: 'merchant-1',
        producer: 'worker',
        trustLevel: 'server',
      })
    );
  });

  it('does not enqueue an AI job or report success when starter page insert fails', async () => {
    readyMerchant();
    const error = { message: 'insert failed' };
    mocks.pageConfigSingle.mockResolvedValueOnce({
      data: null,
      error,
    });
    mocks.isAiStorefrontGenerationEnabled.mockReturnValue(true);

    const result = await submitOnboarding(prevState, makeFormData(validFields));

    expect(result.success).toBe(false);
    expect(result.message).toContain('Failed to create starter page config');
    expect(mocks.aiJobsInsert).not.toHaveBeenCalled();
    expect(mocks.loggerError).toHaveBeenCalledWith({
      message: 'Template generation failed',
      merchantId: 'merchant-1',
      error: expect.objectContaining({
        message: 'Failed to create starter page config: insert failed',
      }),
    });
  });

  it('enqueues a storefront generation job when the rollout flag is enabled', async () => {
    readyMerchant();
    mocks.isAiStorefrontGenerationEnabled.mockReturnValue(true);

    const result = await submitOnboarding(prevState, makeFormData(validFields));

    expect(result.success).toBe(true);
    expect(mocks.aiJobsInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        merchant_id: 'merchant-1',
        type: 'storefront_layout_generation',
        status: 'pending',
        idempotency_key: 'storefront-layout:merchant-1:home:onboarding',
        input: expect.objectContaining({
          pageSlug: 'home',
          businessName: 'TestStore',
          businessType: 'fashion',
          createdPageConfigUpdatedAt: updatedAt,
        }),
        model: 'gemma4:e4b',
      })
    );
  });

  it('triggers the VPS storefront worker after onboarding enqueues a storefront job', async () => {
    readyMerchant();
    mocks.isAiStorefrontGenerationEnabled.mockReturnValue(true);

    const result = await submitOnboarding(prevState, makeFormData(validFields));

    expect(result.success).toBe(true);
    await flushAfterCallbacks();
    expect(mocks.triggerAiStorefrontWorker).toHaveBeenCalledWith({
      merchantId: 'merchant-1',
      source: 'onboarding',
    });
  });

  it('triggers the VPS storefront worker when the onboarding AI job already exists', async () => {
    readyMerchant();
    mocks.isAiStorefrontGenerationEnabled.mockReturnValue(true);
    mocks.aiJobsInsert.mockResolvedValueOnce({
      data: null,
      error: { message: 'duplicate key', code: '23505' },
    });

    const result = await submitOnboarding(prevState, makeFormData(validFields));

    expect(result.success).toBe(true);
    await flushAfterCallbacks();
    expect(mocks.triggerAiStorefrontWorker).toHaveBeenCalledWith({
      merchantId: 'merchant-1',
      source: 'onboarding',
    });
  });

  it('keeps onboarding successful when the storefront worker trigger fails', async () => {
    readyMerchant();
    mocks.isAiStorefrontGenerationEnabled.mockReturnValue(true);
    mocks.triggerAiStorefrontWorker.mockRejectedValueOnce(
      new Error('trigger unavailable')
    );

    const result = await submitOnboarding(prevState, makeFormData(validFields));

    expect(result.success).toBe(true);
    await flushAfterCallbacks();
    expect(mocks.triggerAiStorefrontWorker).toHaveBeenCalledWith({
      merchantId: 'merchant-1',
      source: 'onboarding',
    });
  });

  it('keeps onboarding successful when AI job enqueue fails', async () => {
    readyMerchant();
    mocks.isAiStorefrontGenerationEnabled.mockReturnValue(true);
    mocks.aiJobsInsert.mockResolvedValueOnce({
      data: null,
      error: { message: 'queue unavailable', code: 'XX000' },
    });

    const result = await submitOnboarding(prevState, makeFormData(validFields));

    expect(result.success).toBe(true);
    expect(mocks.aiJobsInsert).toHaveBeenCalled();
  });

  it('does not enqueue a storefront generation job when the rollout flag is disabled', async () => {
    readyMerchant();

    const result = await submitOnboarding(prevState, makeFormData(validFields));

    expect(result.success).toBe(true);
    expect(mocks.aiJobsInsert).not.toHaveBeenCalled();
  });
});
