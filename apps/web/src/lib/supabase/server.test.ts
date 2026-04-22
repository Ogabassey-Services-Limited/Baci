import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCookies = vi.fn();
const mockCreateServerClient = vi.fn();

vi.mock('next/headers', () => ({
  cookies: () => mockCookies(),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: (...args: unknown[]) => mockCreateServerClient(...args),
}));

vi.mock('@/env', () => ({
  getSupabaseAnonKey: () => 'test-anon-key',
  getSupabaseUrl: () => 'https://test.supabase.co',
}));

function createCookieStore(): ReadonlyRequestCookies {
  return {
    get: vi.fn(),
    set: vi.fn(),
  } as unknown as ReadonlyRequestCookies;
}

describe('createClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('creates a server client from the provided cookie store synchronously', async () => {
    const cookieStore = createCookieStore();
    const client = { from: vi.fn() };
    mockCreateServerClient.mockReturnValue(client);

    const { createClient } = await import('@/lib/supabase/server');
    const result = createClient(cookieStore);

    expect(result).toBe(client);
    expect(mockCookies).not.toHaveBeenCalled();
    expect(mockCreateServerClient).toHaveBeenCalledWith(
      'https://test.supabase.co',
      'test-anon-key',
      expect.objectContaining({
        cookies: expect.objectContaining({
          get: expect.any(Function),
          remove: expect.any(Function),
          set: expect.any(Function),
        }),
      })
    );
  });

  it('creates a server client from next headers cookies when no cookie store is provided', async () => {
    const cookieStore = createCookieStore();
    const client = { from: vi.fn() };
    mockCookies.mockResolvedValue(cookieStore);
    mockCreateServerClient.mockReturnValue(client);

    const { createClient } = await import('@/lib/supabase/server');
    const result = await createClient();

    expect(result).toBe(client);
    expect(mockCookies).toHaveBeenCalledTimes(1);
    expect(mockCreateServerClient).toHaveBeenCalledWith(
      'https://test.supabase.co',
      'test-anon-key',
      expect.objectContaining({
        cookies: expect.objectContaining({
          get: expect.any(Function),
          remove: expect.any(Function),
          set: expect.any(Function),
        }),
      })
    );
  });
});
