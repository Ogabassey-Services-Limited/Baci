import type { SupabaseClient } from '@supabase/supabase-js';
import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Database } from '@/types/supabase';

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <
    Value,
  >() => Value extends Right ? 1 : 2
    ? true
    : false;
type Expect<Value extends true> = Value;

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

// biome-ignore format: compile-only last-overload exactness proof.
type ServerReturnIsLegacy = Expect<Equal<ReturnType<typeof createClient>, SupabaseClient>>;
function compileServerFactoryTypes() {
  const exactReturn: ServerReturnIsLegacy = true;
  const cookieStore = {} as ReadonlyRequestCookies;
  const legacyNoArg: Promise<ReturnType<typeof createClient>> = createClient();
  const legacyCookie: ReturnType<typeof createClient> =
    createClient(cookieStore);
  const noArgCompatibility: Promise<SupabaseClient> = legacyNoArg;
  const cookieCompatibility: SupabaseClient = legacyCookie;
  const sentinelNoArg: Promise<SupabaseClient<Database>> =
    createClient('event-pipeline');
  const sentinelCookie: SupabaseClient<Database> = createClient(
    cookieStore,
    'event-pipeline'
  );
  void [
    exactReturn,
    noArgCompatibility,
    cookieCompatibility,
    sentinelNoArg,
    sentinelCookie,
  ];
}
void compileServerFactoryTypes;

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

  it('provides opt-in typed event-pipeline overloads without changing legacy calls', async () => {
    mockCookies.mockResolvedValue(cookieStore);

    await createClient('event-pipeline');
    createClient(cookieStore, 'event-pipeline');

    expect(mockCreateServerClient).toHaveBeenCalledTimes(2);
    expect(mockCookies).toHaveBeenCalledOnce();
  });
});
