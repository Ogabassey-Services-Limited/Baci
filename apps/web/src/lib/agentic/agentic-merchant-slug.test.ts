import { afterEach, describe, expect, it, vi } from 'vitest';
import { getConfiguredAgenticMerchantSlug } from './agentic-merchant-slug';

describe('getConfiguredAgenticMerchantSlug', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('prefers the trimmed BACI tenant slug over the legacy alias', () => {
    vi.stubEnv('BACI_AGENTIC_MERCHANT_SLUG', '  primary-store  ');
    vi.stubEnv('OPENAI_AGENTIC_MERCHANT_SLUG', 'legacy-store');

    expect(getConfiguredAgenticMerchantSlug()).toBe('primary-store');
  });

  it('falls back to the trimmed legacy alias when the BACI slug is blank', () => {
    vi.stubEnv('BACI_AGENTIC_MERCHANT_SLUG', '   ');
    vi.stubEnv('OPENAI_AGENTIC_MERCHANT_SLUG', '  legacy-store  ');

    expect(getConfiguredAgenticMerchantSlug()).toBe('legacy-store');
  });

  it('returns undefined when neither tenant slug is configured', () => {
    vi.stubEnv('BACI_AGENTIC_MERCHANT_SLUG', '');
    vi.stubEnv('OPENAI_AGENTIC_MERCHANT_SLUG', '');

    expect(getConfiguredAgenticMerchantSlug()).toBeUndefined();
  });
});
