import { afterEach, describe, expect, it } from 'vitest';
import { isEventPipelineCanaryMerchant } from './event-pipeline-canary-merchant';

const original = process.env.EVENT_PIPELINE_CANARY_MERCHANT_IDS;

afterEach(() => {
  if (original === undefined)
    delete process.env.EVENT_PIPELINE_CANARY_MERCHANT_IDS;
  else process.env.EVENT_PIPELINE_CANARY_MERCHANT_IDS = original;
});

describe('isEventPipelineCanaryMerchant', () => {
  it('matches configured merchant ids without case sensitivity', () => {
    process.env.EVENT_PIPELINE_CANARY_MERCHANT_IDS = ' Merchant-One,other ';
    expect(isEventPipelineCanaryMerchant('merchant-one')).toBe(true);
    expect(isEventPipelineCanaryMerchant('missing')).toBe(false);
  });

  it('supports the explicit all-merchants canary', () => {
    process.env.EVENT_PIPELINE_CANARY_MERCHANT_IDS = '*';
    expect(isEventPipelineCanaryMerchant()).toBe(true);
  });

  it('scopes active routing to configured canaries', () => {
    process.env.EVENT_PIPELINE_CANARY_MERCHANT_IDS =
      '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a235';

    expect(
      isEventPipelineCanaryMerchant('019bbd89-8f5f-7f8c-a4fd-42b5d7e7a235')
    ).toBe(true);
    expect(
      isEventPipelineCanaryMerchant('019bbd89-8f5f-7f8c-a4fd-42b5d7e7a299')
    ).toBe(false);
  });
});
