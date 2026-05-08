import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateServerClient = vi.fn((..._args: unknown[]) => ({
  auth: { getUser: vi.fn() },
}));
const mockCookies = vi.fn();

vi.mock('@supabase/ssr', () => ({
  createServerClient: (...args: unknown[]) => mockCreateServerClient(...args),
}));

vi.mock('next/headers', () => ({
  cookies: () => mockCookies(),
}));

vi.mock('@/env', () => ({
  getSupabaseAnonKey: () => 'anon-key',
  getSupabaseUrl: () => 'https://example.supabase.co',
}));

import { createClient } from './server';

describe('server supabase createClient', () => {
  const cookieStore = {
    get: vi.fn(),
    set: vi.fn(),
  } as unknown as ReadonlyRequestCookies;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a server client from a provided cookie store synchronously', () => {
    const client = createClient(cookieStore);

    expect(client).toEqual({ auth: { getUser: expect.any(Function) } });
    expect(mockCookies).not.toHaveBeenCalled();
    expect(mockCreateServerClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'anon-key',
      expect.objectContaining({
        cookies: expect.any(Object),
      })
    );
  });

  it('creates a server client from request cookies when no cookie store is provided', async () => {
    mockCookies.mockResolvedValue(cookieStore);

    const client = await createClient();

    expect(client).toEqual({ auth: { getUser: expect.any(Function) } });
    expect(mockCookies).toHaveBeenCalledOnce();
    expect(mockCreateServerClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'anon-key',
      expect.objectContaining({
        cookies: expect.any(Object),
      })
    );
  });
});
