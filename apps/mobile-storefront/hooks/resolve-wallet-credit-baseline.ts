import {
  anchorWalletFundingSession,
  readWalletFundingSession,
  type WalletFundingSession,
  type WalletLedgerPosition,
} from '@/lib/wallet-funding-session';

/**
 * The ledger position the credit watch measures "new" against, for `customerId`.
 *
 * Three cases, all of which resolve to a position that can only be at or AFTER
 * the true pre-transfer position — i.e. every failure mode under-reports (a
 * timeout) and none can manufacture a credit:
 *
 *   1. No bank-transfer session (never started, expired, another customer's,
 *      unreadable): the customer expressed no intent we can trust, so baseline
 *      on the CURRENT ledger head. A credit that landed before this moment is
 *      part of the baseline and will never be announced — correct, because we
 *      have no evidence it was theirs to expect.
 *   2. A session that is already anchored (they left for their bank app and the
 *      screen remounted, possibly after an app kill): reuse the STORED position.
 *      It is the ledger head as it was at the moment of intent, so a credit that
 *      landed while they were away is strictly newer and is detected. A stored
 *      anchor of `null` means the ledger held no top-up at all back then, so any
 *      top-up is new.
 *   3. A session that is not anchored yet (this mount IS the arrival): capture
 *      `ledgerHead` as the anchor and persist it, so a later remount takes case
 *      2. The gap between arrival and this first ledger load is milliseconds and
 *      strictly BEFORE any account number can be on screen, so no transfer can
 *      have landed inside it.
 *
 * Nothing here reads the device clock: every comparison downstream is between
 * two server `created_at` values.
 */
export async function resolveWalletCreditBaseline(
  customerId: string,
  ledgerHead: WalletLedgerPosition | null
): Promise<WalletLedgerPosition | null> {
  // The session helpers already swallow storage errors; the `catch`es are a
  // belt-and-braces guarantee that a storage failure degrades to the ledger head
  // (a timeout) rather than to "no baseline" (which would credit anything).
  let session: WalletFundingSession | null = null;
  try {
    session = await readWalletFundingSession(customerId);
  } catch {
    return ledgerHead;
  }
  if (!session) {
    return ledgerHead;
  }
  if (session.isAnchored) {
    return session.anchor;
  }
  try {
    const anchored = await anchorWalletFundingSession(session, ledgerHead);
    return anchored?.isAnchored ? anchored.anchor : ledgerHead;
  } catch {
    return ledgerHead;
  }
}
