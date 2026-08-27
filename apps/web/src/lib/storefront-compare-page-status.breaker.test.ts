import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  resetStorefrontComparePageStatusForTests,
  resolveStorefrontComparePageStatus,
} from './storefront-compare-page-status';
import {
  buildOptions,
  jsonResponse,
} from './storefront-compare-page-status.test-helpers';

describe('compare page status breaker regressions', () => {
  beforeEach(() => {
    resetStorefrontComparePageStatusForTests();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resets transport failures after a designed unknown verdict', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error('upstream down'))
      .mockRejectedValueOnce(new Error('upstream down'))
      .mockRejectedValueOnce(new Error('upstream down'))
      .mockRejectedValueOnce(new Error('upstream down'))
      .mockResolvedValueOnce(jsonResponse({ present: false, hasError: true }))
      .mockRejectedValueOnce(new Error('upstream down'))
      .mockResolvedValueOnce(jsonResponse({ present: false, hasError: false }));

    for (let attempt = 0; attempt < 4; attempt += 1) {
      await resolveStorefrontComparePageStatus(
        buildOptions(fetchImpl, {
          comparisonSlug: `left-failure-${attempt}-vs-right-${attempt}`,
        })
      );
    }
    await resolveStorefrontComparePageStatus(
      buildOptions(fetchImpl, {
        comparisonSlug: 'left-unknown-vs-right-unknown',
      })
    );
    await resolveStorefrontComparePageStatus(
      buildOptions(fetchImpl, {
        comparisonSlug:
          'left-after-unknown-failure-vs-right-after-unknown-failure',
      })
    );

    await expect(
      resolveStorefrontComparePageStatus(
        buildOptions(fetchImpl, {
          comparisonSlug: 'left-healthy-vs-right-healthy',
        })
      )
    ).resolves.toEqual({ kind: 'missing' });
    expect(fetchImpl).toHaveBeenCalledTimes(7);
    expect(console.warn).not.toHaveBeenCalledWith(
      '[storefront-internal-preflight] skip',
      expect.objectContaining({ reason: 'circuit-open' })
    );
  });

  it('resets the breaker after a request-validation 400 between failures', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error('upstream down'))
      .mockRejectedValueOnce(new Error('upstream down'))
      .mockRejectedValueOnce(new Error('upstream down'))
      .mockRejectedValueOnce(new Error('upstream down'))
      .mockResolvedValueOnce(jsonResponse({ error: 'Invalid input' }, 400))
      .mockRejectedValueOnce(new Error('upstream down'))
      .mockResolvedValueOnce(jsonResponse({ present: false, hasError: false }));

    for (let attempt = 0; attempt < 4; attempt += 1) {
      await resolveStorefrontComparePageStatus(
        buildOptions(fetchImpl, {
          comparisonSlug: `left-failure-${attempt}-vs-right-failure-${attempt}`,
        })
      );
    }
    await resolveStorefrontComparePageStatus(
      buildOptions(fetchImpl, {
        categorySlug: ' ',
        comparisonSlug: 'left-invalid-vs-right-invalid',
      })
    );
    await resolveStorefrontComparePageStatus(
      buildOptions(fetchImpl, {
        comparisonSlug:
          'left-after-invalid-failure-vs-right-after-invalid-failure',
      })
    );

    await expect(
      resolveStorefrontComparePageStatus(
        buildOptions(fetchImpl, {
          comparisonSlug: 'left-healthy-vs-right-healthy',
        })
      )
    ).resolves.toEqual({ kind: 'missing' });
    expect(fetchImpl).toHaveBeenCalledTimes(7);
    expect(console.warn).not.toHaveBeenCalledWith(
      '[storefront-internal-preflight] skip',
      expect.objectContaining({ reason: 'circuit-open' })
    );
  });

  it('opens the breaker after repeated authentication failures', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'Unauthorized' }, 401))
      .mockResolvedValueOnce(jsonResponse({ error: 'Unauthorized' }, 401))
      .mockResolvedValueOnce(jsonResponse({ error: 'Unauthorized' }, 401))
      .mockResolvedValueOnce(jsonResponse({ error: 'Unauthorized' }, 401))
      .mockResolvedValueOnce(jsonResponse({ error: 'Unauthorized' }, 401))
      .mockResolvedValueOnce(jsonResponse({ present: false, hasError: false }));

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await resolveStorefrontComparePageStatus(
        buildOptions(fetchImpl, {
          comparisonSlug: `left-auth-${attempt}-vs-right-auth-${attempt}`,
        })
      );
    }

    await expect(
      resolveStorefrontComparePageStatus(
        buildOptions(fetchImpl, {
          comparisonSlug: 'left-after-auth-vs-right-after-auth',
        })
      )
    ).resolves.toEqual({ kind: 'renderable-or-unknown' });
    expect(fetchImpl).toHaveBeenCalledTimes(5);
    expect(console.warn).toHaveBeenCalledWith(
      '[storefront-internal-preflight] skip',
      expect.objectContaining({ reason: 'circuit-open' })
    );
  });
});
