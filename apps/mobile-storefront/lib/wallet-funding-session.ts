import { asyncStorage as AsyncStorage } from '@/lib/storage';

/**
 * Persisted marker for "the customer expressed bank-transfer funding intent".
 *
 * The wallet credit watch cannot baseline against "whatever top-ups exist at
 * first render": in the real bank-transfer flow the customer LEAVES for their
 * bank app, so the wallet screen is frequently backgrounded or killed and
 * remounts with the credit ALREADY in the ledger. Baselining on first render
 * would then baseline against the very credit the watch exists to detect.
 *
 * The only sound anchor is WHEN the customer expressed the intent, which must
 * survive a remount and an app kill — hence AsyncStorage (precedent:
 * `lib/push-token-storage.ts`). Any top-up strictly newer than `startedAt` is a
 * genuine new credit; anything at or before it already existed.
 *
 * NOTE: PR #3107 (a different branch) adds `lib/wallet-funding-intent.ts` for a
 * related purpose. The filenames are deliberately distinct so the two cannot
 * conflict on merge; they should be unified in a follow-up.
 *
 * Every helper is fail-open at the STORAGE layer (errors → "no session"), which
 * is also fail-CLOSED at the product layer: with no session the credit watch
 * reverts to its row-snapshot baseline and can only under-report, never claim a
 * credit that did not land.
 */

const STORAGE_KEY_PREFIX = '@baci_storefront_wallet_funding_session_';

/** Per-customer key: a shared device must never read another customer's marker. */
export const walletFundingSessionKey = (customerId: string) =>
  `${STORAGE_KEY_PREFIX}${customerId}`;

/**
 * Beyond this age a marker is treated as abandoned: nobody is still waiting on
 * a bank transfer two hours later, and a stale anchor would let an unrelated
 * later top-up (e.g. a card funding) be reported as "your transfer landed".
 */
export const WALLET_FUNDING_SESSION_TTL_MS = 2 * 60 * 60 * 1000;

export interface WalletFundingSession {
  customerId: string;
  startedAt: number;
}

function parseSession(
  raw: string | null,
  customerId: string
): WalletFundingSession | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }
    const record = parsed as Record<string, unknown>;
    const startedAt = record.startedAt;
    // Scope check is belt-and-braces on top of the per-customer key.
    if (record.customerId !== customerId) {
      return null;
    }
    if (typeof startedAt !== 'number' || !Number.isFinite(startedAt)) {
      return null;
    }
    return { customerId, startedAt };
  } catch {
    return null;
  }
}

/**
 * The customer's active bank-transfer session, or `null` when there is none,
 * it belongs to another customer, it is unparseable, or it has aged out (which
 * also clears it). Never throws.
 */
export async function readWalletFundingSession(
  customerId: string
): Promise<WalletFundingSession | null> {
  if (!customerId) {
    return null;
  }
  let raw: string | null = null;
  try {
    raw = await AsyncStorage.getItem(walletFundingSessionKey(customerId));
  } catch {
    return null;
  }
  const session = parseSession(raw, customerId);
  if (!session) {
    return null;
  }
  const age = Date.now() - session.startedAt;
  if (age > WALLET_FUNDING_SESSION_TTL_MS || age < 0) {
    // Aged out, or a clock rollback made it "start in the future" — either way
    // it is not a trustworthy anchor.
    await clearWalletFundingSession(customerId);
    return null;
  }
  return session;
}

/**
 * Marks the start of a bank-transfer funding session, PRESERVING an existing
 * unexpired one. Idempotence is the whole point: the write-site re-runs on every
 * remount (including the remount after the customer comes back from their bank
 * app), and overwriting `startedAt` then would re-introduce exactly the bug this
 * marker fixes — baselining against a credit that already landed.
 */
export async function startWalletFundingSession(
  customerId: string
): Promise<WalletFundingSession | null> {
  if (!customerId) {
    return null;
  }
  const existing = await readWalletFundingSession(customerId);
  if (existing) {
    return existing;
  }
  const session: WalletFundingSession = {
    customerId,
    startedAt: Date.now(),
  };
  try {
    await AsyncStorage.setItem(
      walletFundingSessionKey(customerId),
      JSON.stringify(session)
    );
  } catch {
    // Fail-open: without the marker the watch falls back to its row snapshot.
    return null;
  }
  return session;
}

/** Clears the marker (acknowledged credit, or an aged-out session). */
export async function clearWalletFundingSession(
  customerId: string
): Promise<void> {
  if (!customerId) {
    return;
  }
  try {
    await AsyncStorage.removeItem(walletFundingSessionKey(customerId));
  } catch {
    // Fail-open
  }
}
