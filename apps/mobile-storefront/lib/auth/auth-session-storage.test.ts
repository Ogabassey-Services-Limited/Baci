const mockLoggerWarn = jest.fn();

jest.mock('../logger', () => ({
  createLogger: () => ({
    warn: mockLoggerWarn,
  }),
}));

jest.mock('expo-secure-store', () => ({
  deleteItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

const { authSessionStorage, getDefaultSupabaseAuthStorageKey } =
  jest.requireActual<typeof import('./auth-session-storage')>(
    './auth-session-storage'
  );
const mockSecureStore = jest.requireMock<typeof import('expo-secure-store')>(
  'expo-secure-store'
) as jest.Mocked<typeof import('expo-secure-store')>;

describe('auth session storage keys', () => {
  it.each([
    ['https://abc123.supabase.co', 'sb-abc123-auth-token'],
    ['https://abc123.supabase.co/', 'sb-abc123-auth-token'],
    ['https://abc123.supabase.co/auth/v1', 'sb-abc123-auth-token'],
    ['https://abc123.supabase.co:443', 'sb-abc123-auth-token'],
    [
      'https://abc123.supabase.co/auth/v1?redirect_to=ogabassey://auth',
      'sb-abc123-auth-token',
    ],
  ])('derives the Supabase default auth key from %s', (url, expected) => {
    expect(getDefaultSupabaseAuthStorageKey(url)).toBe(expected);
  });

  it('throws a controlled error for invalid Supabase URLs', () => {
    expect(() => getDefaultSupabaseAuthStorageKey('not-a-url')).toThrow(
      '[Supabase] Invalid Supabase URL; cannot derive default auth storage key.'
    );
  });
});

describe('authSessionStorage', () => {
  beforeEach(() => {
    mockSecureStore.deleteItemAsync.mockReset().mockResolvedValue(undefined);
    mockSecureStore.getItemAsync.mockReset().mockResolvedValue(null);
    mockSecureStore.setItemAsync.mockReset().mockResolvedValue(undefined);
    mockLoggerWarn.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('stores native Supabase sessions in SecureStore', async () => {
    mockSecureStore.getItemAsync.mockResolvedValue('session-json');

    await expect(authSessionStorage.getItem('auth-key')).resolves.toBe(
      'session-json'
    );
    await authSessionStorage.setItem('auth-key', 'next-json');
    await authSessionStorage.removeItem('auth-key');

    expect(mockSecureStore.getItemAsync).toHaveBeenCalledWith('auth-key');
    expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
      'auth-key',
      'next-json'
    );
    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('auth-key');
  });

  it('preserves null values from the underlying storage adapter', async () => {
    mockSecureStore.getItemAsync.mockResolvedValue(null);

    await expect(authSessionStorage.getItem('auth-key')).resolves.toBeNull();

    expect(mockSecureStore.getItemAsync).toHaveBeenCalledWith('auth-key');
  });

  it('propagates read and delete errors from the underlying storage adapter', async () => {
    const storageError = new Error('storage unavailable');
    mockSecureStore.getItemAsync.mockRejectedValue(storageError);
    mockSecureStore.deleteItemAsync.mockRejectedValue(storageError);

    await expect(authSessionStorage.getItem('auth-key')).rejects.toBe(
      storageError
    );
    await expect(authSessionStorage.removeItem('auth-key')).rejects.toBe(
      storageError
    );
  });

  it('rejects when SecureStore cannot persist rotated session credentials', async () => {
    const storageError = new Error('session payload too large');
    mockSecureStore.setItemAsync.mockRejectedValue(storageError);

    await expect(
      authSessionStorage.setItem('auth-key', 'session-json')
    ).rejects.toBe(storageError);

    expect(mockLoggerWarn).toHaveBeenCalledWith(
      'Unable to persist Supabase auth session in SecureStore.',
      storageError
    );
  });

  it.each([
    ['read', () => authSessionStorage.getItem('stalled-read-key')],
    [
      'write',
      () => authSessionStorage.setItem('stalled-write-key', 'session-json'),
    ],
    ['delete', () => authSessionStorage.removeItem('stalled-delete-key')],
  ])('bounds a stalled SecureStore %s operation', async (operation, run) => {
    jest.useFakeTimers();
    mockSecureStore.getItemAsync.mockImplementation(
      () => new Promise<never>(() => undefined)
    );
    mockSecureStore.setItemAsync.mockImplementation(
      () => new Promise<never>(() => undefined)
    );
    mockSecureStore.deleteItemAsync.mockImplementation(
      () => new Promise<never>(() => undefined)
    );
    if (operation !== 'read') {
      mockSecureStore.getItemAsync.mockResolvedValue(null);
    }

    const result = run();
    const rejection = expect(result).rejects.toThrow(
      `Supabase auth storage ${operation} timed out`
    );
    await jest.advanceTimersByTimeAsync(0);
    await jest.advanceTimersByTimeAsync(4_000);

    await rejection;
  });

  it('allows a later storage read after a post-checkout read stalls', async () => {
    jest.useFakeTimers();
    mockSecureStore.getItemAsync
      .mockResolvedValueOnce('captured-session-json')
      .mockImplementationOnce(() => new Promise<never>(() => undefined))
      .mockResolvedValueOnce('current-session-json');

    await expect(authSessionStorage.getItem('read-recovery-key')).resolves.toBe(
      'captured-session-json'
    );
    const stalledRead = authSessionStorage.getItem('read-recovery-key');
    const rejection = expect(stalledRead).rejects.toThrow(
      'Supabase auth storage read timed out'
    );
    await jest.advanceTimersByTimeAsync(0);
    await jest.advanceTimersByTimeAsync(4_000);
    await rejection;

    await expect(authSessionStorage.getItem('read-recovery-key')).resolves.toBe(
      'current-session-json'
    );
  });

  it('restores a replacement session after a timed-out stale write completes', async () => {
    jest.useFakeTimers();
    let completeStaleWrite: (() => void) | undefined;
    mockSecureStore.setItemAsync
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            completeStaleWrite = resolve;
          })
      )
      .mockResolvedValue(undefined);

    const staleWrite = authSessionStorage.setItem(
      'auth-key',
      'previous-account-session'
    );
    const rejection = expect(staleWrite).rejects.toThrow(
      'Supabase auth storage write timed out'
    );
    await jest.advanceTimersByTimeAsync(0);
    await jest.advanceTimersByTimeAsync(4_000);
    await rejection;

    await authSessionStorage.setItem('auth-key', 'replacement-session');
    completeStaleWrite?.();
    await jest.advanceTimersByTimeAsync(0);

    expect(mockSecureStore.setItemAsync).toHaveBeenLastCalledWith(
      'auth-key',
      'replacement-session'
    );
    expect(mockSecureStore.setItemAsync).toHaveBeenCalledTimes(3);
  });

  it('retries a failed correction before reading a stale replaced session', async () => {
    jest.useFakeTimers();
    let completeStaleWrite: (() => void) | undefined;
    mockSecureStore.setItemAsync
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            completeStaleWrite = resolve;
          })
      )
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('correction unavailable'))
      .mockResolvedValueOnce(undefined);
    mockSecureStore.getItemAsync
      .mockResolvedValueOnce(null)
      .mockResolvedValue('replacement-session');

    const staleWrite = authSessionStorage.setItem(
      'retry-auth-key',
      'previous-account-session'
    );
    const rejection = expect(staleWrite).rejects.toThrow(
      'Supabase auth storage write timed out'
    );
    await jest.advanceTimersByTimeAsync(0);
    await jest.advanceTimersByTimeAsync(4_000);
    await rejection;
    await authSessionStorage.setItem('retry-auth-key', 'replacement-session');

    completeStaleWrite?.();
    await jest.advanceTimersByTimeAsync(0);

    await expect(authSessionStorage.getItem('retry-auth-key')).resolves.toBe(
      'replacement-session'
    );
    expect(mockSecureStore.setItemAsync).toHaveBeenLastCalledWith(
      'retry-auth-key',
      'replacement-session'
    );
    expect(mockSecureStore.setItemAsync).toHaveBeenCalledTimes(4);
  });

  it('keeps a failed delete reconciliation unreadable after a stale write completes', async () => {
    jest.useFakeTimers();
    let completeStaleWrite: (() => void) | undefined;
    mockSecureStore.setItemAsync.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          completeStaleWrite = resolve;
        })
    );
    mockSecureStore.deleteItemAsync
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValue(new Error('delete correction unavailable'));

    const staleWrite = authSessionStorage.setItem(
      'delete-auth-key',
      'previous-account-session'
    );
    const rejection = expect(staleWrite).rejects.toThrow(
      'Supabase auth storage write timed out'
    );
    await jest.advanceTimersByTimeAsync(0);
    await jest.advanceTimersByTimeAsync(4_000);
    await rejection;
    await authSessionStorage.removeItem('delete-auth-key');

    completeStaleWrite?.();
    await jest.advanceTimersByTimeAsync(0);

    const storageReadsBeforeTombstoneCheck =
      mockSecureStore.getItemAsync.mock.calls.length;
    await expect(
      authSessionStorage.getItem('delete-auth-key')
    ).resolves.toBeNull();
    expect(mockSecureStore.getItemAsync).toHaveBeenCalledTimes(
      storageReadsBeforeTombstoneCheck
    );
  });

  it('restores the prior session when a timed-out current write later completes', async () => {
    jest.useFakeTimers();
    let storedValue: string | null = 'previous-session';
    let completeTimedOutWrite: (() => void) | undefined;
    mockSecureStore.getItemAsync.mockImplementation(async () => storedValue);
    mockSecureStore.setItemAsync
      .mockImplementationOnce(
        (_key, value) =>
          new Promise<void>((resolve) => {
            completeTimedOutWrite = () => {
              storedValue = value;
              resolve();
            };
          })
      )
      .mockImplementation(async (_key, value) => {
        storedValue = value;
      });

    const timedOutWrite = authSessionStorage.setItem(
      'abandoned-auth-key',
      'unreported-session'
    );
    const rejection = expect(timedOutWrite).rejects.toThrow(
      'Supabase auth storage write timed out'
    );
    await jest.advanceTimersByTimeAsync(0);
    await jest.advanceTimersByTimeAsync(4_000);
    await rejection;

    completeTimedOutWrite?.();
    await jest.advanceTimersByTimeAsync(0);

    await expect(
      authSessionStorage.getItem('abandoned-auth-key')
    ).resolves.toBe('previous-session');
    expect(storedValue).toBe('previous-session');
  });

  it('rolls back a failed interleaved write to the preceding session', async () => {
    let storedValue: string | null = null;
    let completeFirstWrite: (() => void) | undefined;
    let markFirstWriteStarted: (() => void) | undefined;
    const firstWriteStarted = new Promise<void>((resolve) => {
      markFirstWriteStarted = resolve;
    });
    mockSecureStore.getItemAsync.mockImplementation(async () => storedValue);
    mockSecureStore.setItemAsync
      .mockImplementationOnce(
        (_key, value) =>
          new Promise<void>((resolve) => {
            markFirstWriteStarted?.();
            completeFirstWrite = () => {
              storedValue = value;
              resolve();
            };
          })
      )
      .mockRejectedValueOnce(new Error('later write failed'));

    const firstWrite = authSessionStorage.setItem(
      'interleaved-auth-key',
      'first-session'
    );
    const failedLaterWrite = authSessionStorage.setItem(
      'interleaved-auth-key',
      'failed-later-session'
    );
    await firstWriteStarted;
    expect(mockSecureStore.setItemAsync).toHaveBeenCalledTimes(1);

    completeFirstWrite?.();
    await firstWrite;
    await expect(failedLaterWrite).rejects.toThrow('later write failed');

    await expect(
      authSessionStorage.getItem('interleaved-auth-key')
    ).resolves.toBe('first-session');
    expect(storedValue).toBe('first-session');
  });

  it('does not mutate storage when the rollback baseline is unknown', async () => {
    const snapshotError = new Error('rollback snapshot unavailable');
    mockSecureStore.getItemAsync.mockRejectedValue(snapshotError);

    await expect(
      authSessionStorage.setItem('unknown-baseline-key', 'new-session')
    ).rejects.toBe(snapshotError);
    await expect(
      authSessionStorage.removeItem('unknown-delete-baseline-key')
    ).rejects.toBe(snapshotError);

    expect(mockSecureStore.setItemAsync).not.toHaveBeenCalled();
    expect(mockSecureStore.deleteItemAsync).not.toHaveBeenCalled();
  });
});
