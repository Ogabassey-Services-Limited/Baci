import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCreateClient, mockCreateStorefrontPublicReadFetch } = vi.hoisted(
  () => ({
    mockCreateClient: vi.fn(),
    mockCreateStorefrontPublicReadFetch: vi.fn((_timeoutMs?: number) => fetch),
  })
);

vi.mock('@/env', () => ({
  getSupabaseAnonKey: vi.fn(() => 'test-anon-key'),
  getSupabaseUrl: vi.fn(() => 'https://test.supabase.co'),
}));
vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));
vi.mock('./storefront-public-read-fetch', () => ({
  createStorefrontPublicReadFetch: (timeoutMs?: number) =>
    mockCreateStorefrontPublicReadFetch(timeoutMs),
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

    expect(mockCreateStorefrontPublicReadFetch).toHaveBeenCalledTimes(2);
  });

  it('uses the 30-second build deadline instead of the 10-second runtime cap', () => {
    vi.stubEnv('BACI_STOREFRONT_BUILD_READS', 'bounded');
    mockCreateClient.mockReturnValue({ from: vi.fn() });

    getPublicSupabaseClient();

    expect(mockCreateStorefrontPublicReadFetch).toHaveBeenCalledWith(undefined);
  });

  it('leaves runtime public reads ungated', () => {
    mockCreateClient.mockReturnValue({ from: vi.fn() });

    getPublicSupabaseClient();

    expect(mockCreateStorefrontPublicReadFetch).toHaveBeenCalledWith(undefined);
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
