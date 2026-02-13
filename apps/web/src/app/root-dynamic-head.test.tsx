import { describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({
  headers: vi.fn(() =>
    Promise.resolve({
      get: vi.fn(() => 'test-nonce'),
    })
  ),
}));
vi.mock('@/config/platform', () => ({
  PLATFORM_CONFIG: {
    name: 'Baci',
    url: 'https://usebaci.com',
    description: 'AI-powered e-commerce',
  },
  PLATFORM_PRICING: {
    plans: [],
  },
}));
vi.mock('@/lib/sanitize-json-ld', () => ({
  safeJsonLdStringify: vi.fn((obj: unknown) => JSON.stringify(obj)),
}));
vi.mock('@/lib/seo-utils', () => ({
  generateOrganizationSchema: vi.fn(() => ({ '@type': 'Organization' })),
  generateWebSiteSchema: vi.fn(() => ({ '@type': 'WebSite' })),
  generateSoftwareApplicationSchema: vi.fn(() => ({
    '@type': 'SoftwareApplication',
  })),
}));

import { RootDynamicHead } from './root-dynamic-head';

describe('RootDynamicHead', () => {
  it('is an async server component that returns JSX', async () => {
    const result = await RootDynamicHead();
    expect(result).toBeDefined();
  });
});
