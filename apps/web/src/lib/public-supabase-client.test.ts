import { describe, expect, it, vi } from 'vitest';

const mockCreateClient = vi.fn();

vi.mock('@/env', () => ({
  getSupabaseAnonKey: vi.fn(() => 'test-anon-key'),
  getSupabaseUrl: vi.fn(() => 'https://test.supabase.co'),
}));
vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

import { getSupabaseAnonKey, getSupabaseUrl } from '@/env';
import { getPublicSupabaseClient } from './public-supabase-client';

describe('getPublicSupabaseClient', () => {
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
