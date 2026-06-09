import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createBrowserClient = vi.fn(() => ({ auth: {} }));

vi.mock('@supabase/ssr', () => ({
  createBrowserClient,
}));

vi.mock('@/env', () => {
  throw new Error('browser Supabase client must not import zod-backed env');
});

describe('browser Supabase client', () => {
  beforeEach(() => {
    vi.resetModules();
    createBrowserClient.mockClear();
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://supabase.example.com');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('creates the client from static public env without importing the zod env module', async () => {
    const { createClient } = await import('./client');

    const client = createClient();

    expect(client).toEqual({ auth: {} });
    expect(createBrowserClient).toHaveBeenCalledWith(
      'https://supabase.example.com',
      'anon-key'
    );
  });

  it('fails closed when the public Supabase URL is missing', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    const { createClient } = await import('./client');

    expect(() => createClient()).toThrow(
      'NEXT_PUBLIC_SUPABASE_URL is not defined'
    );
    expect(createBrowserClient).not.toHaveBeenCalled();
  });

  it('fails closed when the public Supabase anon key is missing', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
    const { createClient } = await import('./client');

    expect(() => createClient()).toThrow(
      'NEXT_PUBLIC_SUPABASE_ANON_KEY is not defined'
    );
    expect(createBrowserClient).not.toHaveBeenCalled();
  });
});
