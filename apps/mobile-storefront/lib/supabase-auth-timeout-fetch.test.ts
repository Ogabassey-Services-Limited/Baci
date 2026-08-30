import { jest } from '@jest/globals';
import { createClient, type Session } from '@supabase/supabase-js';
import { createSupabaseAuthTimeoutFetch } from './supabase-auth-timeout-fetch';

function accessToken(exp: number): string {
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
    exp,
    sub: 'user-a',
  })}.signature`;
}

describe('createSupabaseAuthTimeoutFetch', () => {
  let consoleErrorSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    jest.useRealTimers();
  });

  it('aborts and settles a pending auth refresh request at the client boundary', async () => {
    jest.useFakeTimers();
    const fetchImpl = jest.fn<typeof fetch>(
      () => new Promise<Response>(() => undefined)
    );
    const timedFetch = createSupabaseAuthTimeoutFetch(fetchImpl, 100);
    const result = timedFetch(
      'https://project.supabase.co/auth/v1/token?grant_type=refresh_token',
      { method: 'POST' }
    );

    await jest.advanceTimersByTimeAsync(100);

    await expect(result).resolves.toMatchObject({ status: 503 });
    expect(fetchImpl.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  });

  it('does not add a timeout to non-refresh Supabase requests', async () => {
    const response = new Response(null, { status: 204 });
    const fetchImpl = jest.fn<typeof fetch>(async () => response);
    const timedFetch = createSupabaseAuthTimeoutFetch(fetchImpl);

    await expect(
      timedFetch('https://project.supabase.co/rest/v1/products')
    ).resolves.toBe(response);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://project.supabase.co/rest/v1/products',
      undefined
    );
  });

  it('releases the shared Auth refresh single-flight after a provider request hangs', async () => {
    jest.useFakeTimers();
    const storedSession = {
      access_token: accessToken(Math.floor(Date.now() / 1000) - 60),
      expires_at: Math.floor(Date.now() / 1000) - 60,
      refresh_token: 'refresh-token',
      token_type: 'bearer',
      user: { id: 'user-a' },
    } as Session;
    const storage = {
      getItem: jest.fn(async () => JSON.stringify(storedSession)),
      removeItem: jest.fn(async () => undefined),
      setItem: jest.fn(async () => undefined),
    };
    const pendingFetch = jest.fn<typeof fetch>(
      () => new Promise<Response>(() => undefined)
    );
    const client = createClient(
      'https://project.supabase.co',
      'publishable-key',
      {
        auth: {
          autoRefreshToken: true,
          detectSessionInUrl: false,
          persistSession: true,
          storage,
        },
        global: {
          fetch: createSupabaseAuthTimeoutFetch(pendingFetch, 100),
        },
      }
    );

    const firstRead = client.auth.getSession();
    await jest.advanceTimersByTimeAsync(31_000);
    await expect(firstRead).resolves.toBeDefined();

    const secondRead = client.auth.getSession();
    await jest.advanceTimersByTimeAsync(100);
    await expect(secondRead).resolves.toBeDefined();
    expect(pendingFetch).toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
  });
});
