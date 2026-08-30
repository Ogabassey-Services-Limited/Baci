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
    mockSecureStore.getItemAsync.mockReset();
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
    ['read', () => authSessionStorage.getItem('auth-key')],
    ['write', () => authSessionStorage.setItem('auth-key', 'session-json')],
    ['delete', () => authSessionStorage.removeItem('auth-key')],
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

    const result = run();
    const rejection = expect(result).rejects.toThrow(
      `Supabase auth storage ${operation} timed out`
    );
    await jest.advanceTimersByTimeAsync(4_000);

    await rejection;
  });

  it('allows a later storage read after a post-checkout read stalls', async () => {
    jest.useFakeTimers();
    mockSecureStore.getItemAsync
      .mockResolvedValueOnce('captured-session-json')
      .mockImplementationOnce(() => new Promise<never>(() => undefined))
      .mockResolvedValueOnce('current-session-json');

    await expect(authSessionStorage.getItem('auth-key')).resolves.toBe(
      'captured-session-json'
    );
    const stalledRead = authSessionStorage.getItem('auth-key');
    const rejection = expect(stalledRead).rejects.toThrow(
      'Supabase auth storage read timed out'
    );
    await jest.advanceTimersByTimeAsync(4_000);
    await rejection;

    await expect(authSessionStorage.getItem('auth-key')).resolves.toBe(
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
});
