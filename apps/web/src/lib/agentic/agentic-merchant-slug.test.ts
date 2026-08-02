import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getConfiguredAgenticMerchantSlug } from './agentic-merchant-slug';

describe('getConfiguredAgenticMerchantSlug', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('reads the BACI tenant slug', () => {
    vi.stubEnv('BACI_AGENTIC_MERCHANT_SLUG', 'winter-store');

    expect(getConfiguredAgenticMerchantSlug()).toBe('winter-store');
  });

  it('supports the legacy OPENAI tenant slug alias', () => {
    vi.stubEnv('OPENAI_AGENTIC_MERCHANT_SLUG', 'legacy-store');

    expect(getConfiguredAgenticMerchantSlug()).toBe('legacy-store');
  });
});
