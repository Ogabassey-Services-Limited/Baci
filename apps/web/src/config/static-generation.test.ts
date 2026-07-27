import { describe, expect, it } from 'vitest';
import { STATIC_GENERATION_LIMITS } from './static-generation';

describe('STATIC_GENERATION_LIMITS', () => {
  it('bounds build pressure and retries transient page failures', () => {
    expect(STATIC_GENERATION_LIMITS).toEqual({
      staticGenerationMaxConcurrency: 1,
      staticGenerationMinPagesPerWorker: 1_600,
      staticGenerationRetryCount: 3,
    });
  });
});
