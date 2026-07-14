import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import type { WalletFundingSession } from './wallet-funding-session';

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
  anchorWalletFundingSession,
  clearWalletFundingSession,
  readWalletFundingSession,
  startWalletFundingSession,
  walletFundingSessionKey,
} =
  require('./wallet-funding-session') as typeof import('./wallet-funding-session');

const CUSTOMER_ID = 'cus-1';
const NOW = Date.parse('2026-07-13T12:00:00.000Z');
const INTENT_A = 'intent-a';
const INTENT_B = 'intent-b';
const ANCHOR = {
  createdAt: Date.parse('2026-07-13T09:00:00.000Z'),
  id: 'tx-old',
};

function stored(session: WalletFundingSession) {
  return JSON.stringify(session);
}

function unanchored(
  overrides: Partial<WalletFundingSession> = {}
): WalletFundingSession {
  return {
    anchor: null,
    customerId: CUSTOMER_ID,
    intentId: INTENT_A,
    isAnchored: false,
    startedAt: NOW,
    ...overrides,
  };
}

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

  it('starts an UNANCHORED session for the arriving intent', async () => {
    // The ledger position is captured separately, once the ledger loads; the
    // session records only WHO expressed intent, never a device-clock anchor.
    const session = await startWalletFundingSession(CUSTOMER_ID, INTENT_A);

    expect(session).toEqual(unanchored());
    expect(mockSetItem).toHaveBeenCalledWith(
      walletFundingSessionKey(CUSTOMER_ID),
      stored(unanchored())
    );
  });

  it('preserves an existing session — and its anchor — when the SAME intent remounts', async () => {
    const existing = unanchored({
      anchor: ANCHOR,
      isAnchored: true,
      startedAt: NOW - 5 * 60 * 1000,
    });
    mockGetItem.mockResolvedValue(stored(existing));

    const session = await startWalletFundingSession(CUSTOMER_ID, INTENT_A);

    // Re-anchoring would baseline against the credit that landed while the
    // customer was away in their bank app — the exact bug this marker fixes.
    expect(session).toEqual(existing);
    expect(mockSetItem).not.toHaveBeenCalled();
  });

  it('RESTAMPS when a genuinely new intent arrives inside the TTL', async () => {
    // Regression (codex #1): a second bank-transfer attempt started before the
    // first was ever acknowledged must NOT inherit the first attempt's anchor.
    // If it did, the credit from the FIRST attempt would sit after the anchor
    // and be announced as this attempt's — crediting money that arrived earlier.
    mockGetItem.mockResolvedValue(
      stored(
        unanchored({
          anchor: ANCHOR,
          isAnchored: true,
          startedAt: NOW - 5 * 60 * 1000,
        })
      )
    );

    const session = await startWalletFundingSession(CUSTOMER_ID, INTENT_B);

    expect(session).toEqual(unanchored({ intentId: INTENT_B }));
    expect(mockSetItem).toHaveBeenCalledWith(
      walletFundingSessionKey(CUSTOMER_ID),
      stored(unanchored({ intentId: INTENT_B }))
    );
  });

  it('restamps an unidentifiable arrival rather than adopting a stale anchor', async () => {
    // No nonce on the URL → we cannot prove this is the same intent, so we take
    // the direction that can only under-report (a timeout), never over-report.
    mockGetItem.mockResolvedValue(
      stored(
        unanchored({
          anchor: ANCHOR,
          isAnchored: true,
          startedAt: NOW - 5 * 60 * 1000,
        })
      )
    );

    await expect(startWalletFundingSession(CUSTOMER_ID)).resolves.toEqual(
      unanchored({ intentId: '' })
    );

    // ...and an anchor that never carried an intent id cannot be "matched" by an
    // empty arrival either — it always restamps.
    mockSetItem.mockClear();
    mockGetItem.mockResolvedValue(
      stored(unanchored({ intentId: '', startedAt: NOW - 5 * 60 * 1000 }))
    );
    await expect(startWalletFundingSession(CUSTOMER_ID, '')).resolves.toEqual(
      unanchored({ intentId: '' })
    );
    expect(mockSetItem).toHaveBeenCalled();
  });

  it('anchors an unanchored session to the ledger position it is given', async () => {
    const existing = unanchored();
    mockGetItem.mockResolvedValue(stored(existing));

    const session = await anchorWalletFundingSession(existing, ANCHOR);

    expect(session).toEqual(unanchored({ anchor: ANCHOR, isAnchored: true }));
    expect(mockSetItem).toHaveBeenCalledWith(
      walletFundingSessionKey(CUSTOMER_ID),
      stored(unanchored({ anchor: ANCHOR, isAnchored: true }))
    );
  });

  it('anchors an empty ledger as "no top-up existed yet"', async () => {
    const existing = unanchored();
    mockGetItem.mockResolvedValue(stored(existing));

    await expect(anchorWalletFundingSession(existing, null)).resolves.toEqual(
      unanchored({ anchor: null, isAnchored: true })
    );
  });

  it('never overwrites an anchor that was already captured', async () => {
    const alreadyAnchored = unanchored({ anchor: ANCHOR, isAnchored: true });
    mockGetItem.mockResolvedValue(stored(alreadyAnchored));

    const session = await anchorWalletFundingSession(alreadyAnchored, {
      createdAt: Date.parse('2026-07-13T11:00:00.000Z'),
      id: 'tx-newer',
    });

    // Moving the anchor forward is harmless, but moving it BACKWARD (a stale
    // ledger snapshot) would widen the "new" window, so the stored one wins.
    expect(session).toEqual(alreadyAnchored);
    expect(mockSetItem).not.toHaveBeenCalled();
  });

  it('refuses to anchor a session that a newer intent has replaced', async () => {
    const stale = unanchored({ startedAt: NOW - 60 * 1000 });
    mockGetItem.mockResolvedValue(stored(unanchored({ intentId: INTENT_B })));

    await expect(anchorWalletFundingSession(stale, ANCHOR)).resolves.toBeNull();
    expect(mockSetItem).not.toHaveBeenCalled();
  });

  it('reads back an unexpired session', async () => {
    const session = unanchored({
      anchor: ANCHOR,
      isAnchored: true,
      startedAt: NOW - 60 * 1000,
    });
    mockGetItem.mockResolvedValue(stored(session));

    await expect(readWalletFundingSession(CUSTOMER_ID)).resolves.toEqual(
      session
    );
  });

  it('ignores a legacy device-clock marker written by an older build', async () => {
    // The old shape anchored on `startedAt` (a device timestamp) and carries no
    // `isAnchored`. Trusting it would reintroduce the device-vs-server clock
    // comparison; refusing it costs at most a timeout.
    mockGetItem.mockResolvedValue(
      JSON.stringify({
        customerId: CUSTOMER_ID,
        intentId: INTENT_A,
        startedAt: NOW - 60 * 1000,
      })
    );

    await expect(readWalletFundingSession(CUSTOMER_ID)).resolves.toBeNull();
  });

  it('ignores a session whose stored anchor is unusable', async () => {
    for (const anchor of [
      { createdAt: 'yesterday', id: 'tx-old' },
      { createdAt: Number.NaN, id: 'tx-old' },
      { createdAt: ANCHOR.createdAt, id: '' },
      'tx-old',
    ]) {
      mockGetItem.mockResolvedValue(
        JSON.stringify({
          anchor,
          customerId: CUSTOMER_ID,
          intentId: INTENT_A,
          isAnchored: true,
          startedAt: NOW - 60 * 1000,
        })
      );

      await expect(readWalletFundingSession(CUSTOMER_ID)).resolves.toBeNull();
    }
  });

  it('clears and ignores a session past the TTL', async () => {
    mockGetItem.mockResolvedValue(
      stored(unanchored({ startedAt: NOW - WALLET_FUNDING_SESSION_TTL_MS - 1 }))
    );

    await expect(readWalletFundingSession(CUSTOMER_ID)).resolves.toBeNull();
    expect(mockRemoveItem).toHaveBeenCalledWith(
      walletFundingSessionKey(CUSTOMER_ID)
    );
  });

  it('ignores a marker written by another customer', async () => {
    mockGetItem.mockResolvedValue(
      stored(unanchored({ customerId: 'someone-else' }))
    );

    await expect(readWalletFundingSession(CUSTOMER_ID)).resolves.toBeNull();
  });

  it('ignores malformed payloads and unusable timestamps', async () => {
    mockGetItem.mockResolvedValue('not-json');
    await expect(readWalletFundingSession(CUSTOMER_ID)).resolves.toBeNull();

    mockGetItem.mockResolvedValue(
      JSON.stringify({
        anchor: null,
        customerId: CUSTOMER_ID,
        isAnchored: false,
        startedAt: 'yesterday',
      })
    );
    await expect(readWalletFundingSession(CUSTOMER_ID)).resolves.toBeNull();
  });

  it('ignores a session that claims to start in the future (clock rollback)', async () => {
    mockGetItem.mockResolvedValue(
      stored(unanchored({ startedAt: NOW + 60 * 1000 }))
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

    mockGetItem.mockResolvedValue(stored(unanchored()));
    await expect(
      anchorWalletFundingSession(unanchored(), ANCHOR)
    ).resolves.toBeNull();
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
