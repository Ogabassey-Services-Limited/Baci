import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateClient = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

// Reset the cached singleton between tests by re-importing
describe('createAnonClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
    mockCreateClient.mockReturnValue({ auth: {} });
  });

  it('re-exports createPublicClient from public module', async () => {
    const anonModule = await import('@/lib/supabase/anon');
    expect(anonModule.createPublicClient).toBeDefined();
  });

  it('creates a Supabase client with anon key and no session persistence', async () => {
    const { createAnonClient } = await import('@/lib/supabase/anon');

    createAnonClient();

    expect(mockCreateClient).toHaveBeenCalledWith(
      'https://test.supabase.co',
      'test-anon-key',
      expect.objectContaining({
        auth: expect.objectContaining({
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        }),
      })
    );
  });

  it('returns the same cached instance on subsequent calls', async () => {
    const { createAnonClient } = await import('@/lib/supabase/anon');

    const client1 = createAnonClient();
    const client2 = createAnonClient();

    expect(client1).toBe(client2);
    expect(mockCreateClient).toHaveBeenCalledTimes(1);
  });
});
