import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type {
  WalletFundingSession,
  WalletLedgerPosition,
} from '@/lib/wallet-funding-session';

const mockRead =
  jest.fn<(customerId: string) => Promise<WalletFundingSession | null>>();
const mockAnchor =
  jest.fn<
    (
      session: WalletFundingSession,
      position: WalletLedgerPosition | null
    ) => Promise<WalletFundingSession | null>
  >();

jest.mock('@/lib/wallet-funding-session', () => ({
  anchorWalletFundingSession: (
    session: WalletFundingSession,
    position: WalletLedgerPosition | null
  ) => mockAnchor(session, position),
  readWalletFundingSession: (customerId: string) => mockRead(customerId),
}));

const { resolveWalletCreditBaseline } =
  require('./resolve-wallet-credit-baseline') as typeof import('./resolve-wallet-credit-baseline');

const CUSTOMER_ID = 'cus-1';
const OLD_POSITION: WalletLedgerPosition = {
  createdAt: Date.parse('2026-07-01T09:00:00.000Z'),
  id: 'tx-old',
};
const HEAD: WalletLedgerPosition = {
  createdAt: Date.parse('2026-07-13T09:00:00.000Z'),
  id: 'tx-new',
};

function session(
  overrides: Partial<WalletFundingSession> = {}
): WalletFundingSession {
  return {
    anchor: null,
    customerId: CUSTOMER_ID,
    intentId: 'intent-1',
    isAnchored: false,
    startedAt: Date.parse('2026-07-13T08:55:00.000Z'),
    ...overrides,
  };
}

describe('resolveWalletCreditBaseline', () => {
  beforeEach(() => {
    mockRead.mockReset();
    mockAnchor.mockReset();
  });

  it('baselines on the ledger head when there is no funding session', async () => {
    mockRead.mockResolvedValue(null);

    await expect(
      resolveWalletCreditBaseline(CUSTOMER_ID, HEAD)
    ).resolves.toEqual(HEAD);
    expect(mockAnchor).not.toHaveBeenCalled();
  });

  it('captures the ledger head as the anchor on the arrival that expressed intent', async () => {
    const arriving = session();
    mockRead.mockResolvedValue(arriving);
    mockAnchor.mockResolvedValue(
      session({ anchor: OLD_POSITION, isAnchored: true })
    );

    await expect(
      resolveWalletCreditBaseline(CUSTOMER_ID, OLD_POSITION)
    ).resolves.toEqual(OLD_POSITION);
    expect(mockAnchor).toHaveBeenCalledWith(arriving, OLD_POSITION);
  });

  it('reuses a stored anchor instead of the (now newer) ledger head', async () => {
    // The remount-after-credit case: the transfer already landed, so the head is
    // the credit itself. Re-anchoring on it would swallow the credit; the stored
    // pre-transfer position keeps it detectable.
    mockRead.mockResolvedValue(
      session({ anchor: OLD_POSITION, isAnchored: true })
    );

    await expect(
      resolveWalletCreditBaseline(CUSTOMER_ID, HEAD)
    ).resolves.toEqual(OLD_POSITION);
    expect(mockAnchor).not.toHaveBeenCalled();
  });

  it('treats an anchored-but-empty ledger as "any top-up is new"', async () => {
    mockRead.mockResolvedValue(session({ anchor: null, isAnchored: true }));

    await expect(
      resolveWalletCreditBaseline(CUSTOMER_ID, HEAD)
    ).resolves.toBeNull();
  });

  it('falls back to the ledger head when the anchor cannot be captured', async () => {
    // A newer intent replaced the session mid-flight, or storage refused the
    // write. The head can only under-report — never credit.
    mockRead.mockResolvedValue(session());
    mockAnchor.mockResolvedValue(null);

    await expect(
      resolveWalletCreditBaseline(CUSTOMER_ID, HEAD)
    ).resolves.toEqual(HEAD);
  });

  it('falls back to the ledger head when the session read throws', async () => {
    mockRead.mockRejectedValue(new Error('storage unavailable'));

    await expect(
      resolveWalletCreditBaseline(CUSTOMER_ID, HEAD)
    ).resolves.toEqual(HEAD);
  });

  it('falls back to the ledger head when the anchor write throws', async () => {
    mockRead.mockResolvedValue(session());
    mockAnchor.mockRejectedValue(new Error('storage unavailable'));

    await expect(
      resolveWalletCreditBaseline(CUSTOMER_ID, HEAD)
    ).resolves.toEqual(HEAD);
  });
});
