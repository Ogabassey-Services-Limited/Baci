import { describe, expect, it } from 'vitest';
import { STATIC_GENERATION_LIMITS } from './static-generation';

const OBSERVED_STATIC_WORKERS = 3;
const STOREFRONT_READ_ENVELOPE = 3;

async function simulateStorefrontPrerenders(pagesPerWorker: number) {
  let activeReads = 0;
  const readPage = async () => {
    activeReads += 1;
    try {
      if (activeReads > STOREFRONT_READ_ENVELOPE) {
        throw new Error('merchant_snapshot timeout');
      }
      await Promise.resolve();
    } finally {
      activeReads -= 1;
    }
  };

  await Promise.all(
    Array.from({ length: OBSERVED_STATIC_WORKERS * pagesPerWorker }, readPage)
  );
}

describe('STATIC_GENERATION_LIMITS', () => {
  it('bounds build pressure and retries transient page failures', () => {
    expect(STATIC_GENERATION_LIMITS).toEqual({
      staticGenerationMaxConcurrency: 1,
      staticGenerationMinPagesPerWorker: 1_600,
      staticGenerationRetryCount: 3,
    });
  });

  it('keeps three-worker storefront reads inside the production envelope', async () => {
    await expect(simulateStorefrontPrerenders(4)).rejects.toThrow(
      'merchant_snapshot timeout'
    );
    await expect(
      simulateStorefrontPrerenders(
        STATIC_GENERATION_LIMITS.staticGenerationMaxConcurrency
      )
    ).resolves.toBeUndefined();
  });
});
