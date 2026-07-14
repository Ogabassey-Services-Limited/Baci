import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

const mockGetItem = jest.fn<(key: string) => Promise<string | null>>();
const mockSetItem = jest.fn<(key: string, value: string) => Promise<void>>();
const mockRemoveItem = jest.fn<(key: string) => Promise<void>>();

jest.mock('@/lib/storage', () => ({
  asyncStorage: {
    getItem: mockGetItem,
    setItem: mockSetItem,
    removeItem: mockRemoveItem,
  },
}));

const {
  WALLET_FUNDING_SESSION_TTL_MS,
  clearWalletFundingSession,
  readWalletFundingSession,
  startWalletFundingSession,
  walletFundingSessionKey,
} =
  require('./wallet-funding-session') as typeof import('./wallet-funding-session');

const CUSTOMER_ID = 'cus-1';
const NOW = Date.parse('2026-07-13T12:00:00.000Z');

describe('wallet-funding-session', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    mockGetItem.mockResolvedValue(null);
    mockSetItem.mockResolvedValue(undefined);
    mockRemoveItem.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('scopes the storage key per customer', () => {
    expect(walletFundingSessionKey('cus-a')).not.toBe(
      walletFundingSessionKey('cus-b')
    );
    expect(walletFundingSessionKey(CUSTOMER_ID)).toContain(CUSTOMER_ID);
  });

  it('starts a session stamped with the current time', async () => {
    const session = await startWalletFundingSession(CUSTOMER_ID);

    expect(session).toEqual({ customerId: CUSTOMER_ID, startedAt: NOW });
    expect(mockSetItem).toHaveBeenCalledWith(
      walletFundingSessionKey(CUSTOMER_ID),
      JSON.stringify({ customerId: CUSTOMER_ID, startedAt: NOW })
    );
  });

  it('preserves an existing session instead of restamping it on remount', async () => {
    const startedAt = NOW - 5 * 60 * 1000;
    mockGetItem.mockResolvedValue(
      JSON.stringify({ customerId: CUSTOMER_ID, startedAt })
    );

    const session = await startWalletFundingSession(CUSTOMER_ID);

    // Restamping would baseline against the credit that landed while the
    // customer was away in their bank app — the exact bug this marker fixes.
    expect(session).toEqual({ customerId: CUSTOMER_ID, startedAt });
    expect(mockSetItem).not.toHaveBeenCalled();
  });

  it('reads back an unexpired session', async () => {
    const startedAt = NOW - 60 * 1000;
    mockGetItem.mockResolvedValue(
      JSON.stringify({ customerId: CUSTOMER_ID, startedAt })
    );

    await expect(readWalletFundingSession(CUSTOMER_ID)).resolves.toEqual({
      customerId: CUSTOMER_ID,
      startedAt,
    });
  });

  it('clears and ignores a session past the TTL', async () => {
    mockGetItem.mockResolvedValue(
      JSON.stringify({
        customerId: CUSTOMER_ID,
        startedAt: NOW - WALLET_FUNDING_SESSION_TTL_MS - 1,
      })
    );

    await expect(readWalletFundingSession(CUSTOMER_ID)).resolves.toBeNull();
    expect(mockRemoveItem).toHaveBeenCalledWith(
      walletFundingSessionKey(CUSTOMER_ID)
    );
  });

  it('ignores a marker written by another customer', async () => {
    mockGetItem.mockResolvedValue(
      JSON.stringify({ customerId: 'someone-else', startedAt: NOW })
    );

    await expect(readWalletFundingSession(CUSTOMER_ID)).resolves.toBeNull();
  });

  it('ignores malformed payloads and unusable timestamps', async () => {
    mockGetItem.mockResolvedValue('not-json');
    await expect(readWalletFundingSession(CUSTOMER_ID)).resolves.toBeNull();

    mockGetItem.mockResolvedValue(
      JSON.stringify({ customerId: CUSTOMER_ID, startedAt: 'yesterday' })
    );
    await expect(readWalletFundingSession(CUSTOMER_ID)).resolves.toBeNull();
  });

  it('ignores a session that claims to start in the future (clock rollback)', async () => {
    mockGetItem.mockResolvedValue(
      JSON.stringify({ customerId: CUSTOMER_ID, startedAt: NOW + 60 * 1000 })
    );

    await expect(readWalletFundingSession(CUSTOMER_ID)).resolves.toBeNull();
  });

  it('is fail-open when storage throws on read', async () => {
    mockGetItem.mockRejectedValue(new Error('storage unavailable'));

    await expect(readWalletFundingSession(CUSTOMER_ID)).resolves.toBeNull();
  });

  it('is fail-open when storage throws on write', async () => {
    mockSetItem.mockRejectedValue(new Error('storage unavailable'));

    await expect(startWalletFundingSession(CUSTOMER_ID)).resolves.toBeNull();
  });

  it('is fail-open when storage throws on clear', async () => {
    mockRemoveItem.mockRejectedValue(new Error('storage unavailable'));

    await expect(
      clearWalletFundingSession(CUSTOMER_ID)
    ).resolves.toBeUndefined();
  });

  it('is a no-op without a customer id', async () => {
    await expect(readWalletFundingSession('')).resolves.toBeNull();
    await expect(startWalletFundingSession('')).resolves.toBeNull();
    await clearWalletFundingSession('');

    expect(mockGetItem).not.toHaveBeenCalled();
    expect(mockSetItem).not.toHaveBeenCalled();
    expect(mockRemoveItem).not.toHaveBeenCalled();
  });

  it('removes the marker on clear', async () => {
    await clearWalletFundingSession(CUSTOMER_ID);

    expect(mockRemoveItem).toHaveBeenCalledWith(
      walletFundingSessionKey(CUSTOMER_ID)
    );
  });
});
