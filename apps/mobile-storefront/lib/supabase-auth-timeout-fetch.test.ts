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

function pendingAbortAwareFetch(): jest.MockedFunction<typeof fetch> {
  return jest.fn<typeof fetch>(
    (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        const abort = () => reject(new DOMException('Aborted', 'AbortError'));
        if (init?.signal?.aborted) {
          abort();
          return;
        }
        init?.signal?.addEventListener('abort', abort, { once: true });
      })
  );
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
    const fetchImpl = pendingAbortAwareFetch();
    const timedFetch = createSupabaseAuthTimeoutFetch(fetchImpl, 100);
    const result = timedFetch(
      'https://project.supabase.co/auth/v1/token?grant_type=refresh_token',
      { method: 'POST' }
    );

    await jest.advanceTimersByTimeAsync(100);

    await expect(result).resolves.toMatchObject({ status: 408 });
    expect(fetchImpl.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  });

  it('returns a successful refresh response before the deadline without aborting it', async () => {
    jest.useFakeTimers();
    const response = Response.json({ access_token: 'fresh-token' });
    let requestSignal: AbortSignal | undefined;
    const fetchImpl = jest.fn<typeof fetch>(async (_input, init) => {
      requestSignal = init?.signal ?? undefined;
      return response;
    });
    const timedFetch = createSupabaseAuthTimeoutFetch(fetchImpl, 100);

    await expect(
      timedFetch(
        'https://project.supabase.co/auth/v1/token?grant_type=refresh_token',
        { method: 'POST' }
      )
    ).resolves.toBe(response);
    await jest.advanceTimersByTimeAsync(100);

    expect(requestSignal?.aborted).toBe(false);
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
    const pendingFetch = pendingAbortAwareFetch();
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
    await jest.advanceTimersByTimeAsync(100);
    await expect(firstRead).resolves.toBeDefined();

    const secondRead = client.auth.getSession();
    await jest.advanceTimersByTimeAsync(100);
    await expect(secondRead).resolves.toBeDefined();
    expect(pendingFetch).toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  it('uses the explicitly supplied refresh token without rotating an expired stored session first', async () => {
    const storedSession = {
      access_token: accessToken(Math.floor(Date.now() / 1000) - 60),
      expires_at: Math.floor(Date.now() / 1000) - 60,
      refresh_token: 'stored-refresh-token',
      token_type: 'bearer',
      user: { id: 'user-a' },
    } as Session;
    const storage = {
      getItem: jest.fn(async () => JSON.stringify(storedSession)),
      removeItem: jest.fn(async () => undefined),
      setItem: jest.fn(async () => undefined),
    };
    const fetchImpl = jest.fn<typeof fetch>(async () =>
      Response.json({
        access_token: accessToken(Math.floor(Date.now() / 1000) + 3_600),
        expires_in: 3_600,
        refresh_token: 'rotated-refresh-token',
        token_type: 'bearer',
        user: { id: 'user-a' },
      })
    );
    const client = createClient(
      'https://project.supabase.co',
      'publishable-key',
      {
        auth: {
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: true,
          storage,
        },
        global: { fetch: fetchImpl },
      }
    );

    await expect(
      client.auth.refreshSession({ refresh_token: 'stored-refresh-token' })
    ).resolves.toMatchObject({ data: { session: expect.any(Object) } });

    const tokenRequests = fetchImpl.mock.calls.filter(([input]) =>
      String(input).includes('/auth/v1/token')
    );
    expect(tokenRequests).toHaveLength(1);
  });

  it('discards an explicit checkout refresh after auth storage switches accounts', async () => {
    const accountBSession = {
      access_token: accessToken(Math.floor(Date.now() / 1000) + 3_600),
      expires_at: Math.floor(Date.now() / 1000) + 3_600,
      refresh_token: 'account-b-refresh-token',
      token_type: 'bearer',
      user: { id: 'user-b' },
    } as Session;
    const storage = {
      getItem: jest.fn(async () => JSON.stringify(accountBSession)),
      removeItem: jest.fn(async () => undefined),
      setItem: jest.fn(async () => undefined),
    };
    const fetchImpl = jest.fn<typeof fetch>();
    const client = createClient(
      'https://project.supabase.co',
      'publishable-key',
      {
        auth: {
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: true,
          storage,
        },
        global: { fetch: fetchImpl },
      }
    );

    const result = await client.auth.refreshSession({
      refresh_token: 'account-a-refresh-token',
      require_storage_match: true,
    });

    expect(result.error?.name).toBe('AuthRefreshDiscardedError');
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
  });
});
