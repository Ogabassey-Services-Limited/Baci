import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCreateClient, mockCreateStorefrontBuildReadFetch } = vi.hoisted(
  () => ({
    mockCreateClient: vi.fn(),
    mockCreateStorefrontBuildReadFetch: vi.fn(
      (fetcher: typeof fetch) => fetcher
    ),
  })
);

vi.mock('@/env', () => ({
  getSupabaseAnonKey: vi.fn(() => 'test-anon-key'),
  getSupabaseUrl: vi.fn(() => 'https://test.supabase.co'),
}));
vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));
vi.mock('./storefront-build-read-fetch', () => ({
  createStorefrontBuildReadFetch: (fetcher: typeof fetch) =>
    mockCreateStorefrontBuildReadFetch(fetcher),
}));

import { getSupabaseAnonKey, getSupabaseUrl } from '@/env';
import { getPublicSupabaseClient } from './public-supabase-client';

describe('getPublicSupabaseClient', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('shares one read gate across public clients during production builds', () => {
    vi.stubEnv('BACI_STOREFRONT_BUILD_READS', 'bounded');
    mockCreateClient.mockReturnValue({ from: vi.fn() });

    getPublicSupabaseClient();
    getPublicSupabaseClient();

    expect(mockCreateStorefrontBuildReadFetch).toHaveBeenCalledTimes(2);
  });

  it('leaves runtime public reads ungated', () => {
    mockCreateClient.mockReturnValue({ from: vi.fn() });

    getPublicSupabaseClient();

    expect(mockCreateStorefrontBuildReadFetch).not.toHaveBeenCalled();
  });

  it('creates a cookie-free anonymous client for cached public reads', () => {
    mockCreateClient.mockReturnValue({ from: vi.fn() });

    getPublicSupabaseClient();

    expect(mockCreateClient).toHaveBeenCalledWith(
      'https://test.supabase.co',
      'test-anon-key',
      expect.objectContaining({
        auth: expect.objectContaining({
          autoRefreshToken: false,
          persistSession: false,
        }),
      })
    );
  });

  it('fails closed when public Supabase configuration is missing', () => {
    vi.mocked(getSupabaseUrl).mockReturnValueOnce('');

    expect(() => getPublicSupabaseClient()).toThrow(
      'Supabase configuration is missing'
    );

    vi.mocked(getSupabaseAnonKey).mockReturnValueOnce('');

    expect(() => getPublicSupabaseClient()).toThrow(
      'Supabase configuration is missing'
    );
  });
});
