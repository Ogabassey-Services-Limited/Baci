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
 * The anchor is therefore a LEDGER POSITION, not a wall-clock timestamp: the
 * newest `wallet_topup` credit that already existed at the moment of intent
 * (`WalletLedgerPosition`). Detection compares SERVER `created_at` against
 * SERVER `created_at`, so the device clock is never part of the comparison.
 * That matters because a device clock running BEHIND the server would shift a
 * time-based anchor EARLIER, and a top-up that PREDATES the intent would then
 * read as "new" — a false credit. Device time survives here for ONE purpose:
 * the TTL below, where a wrong reading can only expire the session early and
 * degrade to a timeout.
 *
 * NOTE: PR #3107 (a different branch) adds `lib/wallet-funding-intent.ts` for a
 * related purpose. The filenames are deliberately distinct so the two cannot
 * conflict on merge; they should be unified in a follow-up.
 *
 * Every helper is fail-open at the STORAGE layer (errors → "no session"), which
 * is also fail-CLOSED at the product layer: with no session the credit watch
 * reverts to its ledger-head snapshot, which can only under-report (a timeout),
 * never claim a credit that did not land.
 *
 * A session is minted ONLY by an explicit bank-transfer intent. There is
 * deliberately no "restart"/"re-anchor at now" helper — see the comment on
 * `reset()` in `hooks/use-wallet-credit-watch.ts` for why minting a marker at a
 * moment of NO intent is a false-credit vector.
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

/**
 * A point in the wallet ledger: the identity of one `wallet_topup` credit row.
 * `createdAt` is the SERVER `created_at` parsed to epoch ms — it is only ever
 * compared with other server timestamps, never with `Date.now()`.
 */
export interface WalletLedgerPosition {
  createdAt: number;
  id: string;
}

export interface WalletFundingSession {
  /**
   * Newest top-up credit that already existed when the customer expressed the
   * intent. `null` with `isAnchored` true means the ledger held no top-up at
   * all, so any top-up is new.
   */
  anchor: WalletLedgerPosition | null;
  customerId: string;
  /**
   * Identity of the NAVIGATION that expressed the intent — a nonce minted per
   * tap of "Pay with Bank Transfer" and carried in the
   * `/wallet?action=bank-transfer&intent=…` URL. Route params alone cannot tell
   * a genuine second attempt from a remount of the first (both replay the same
   * `action`/`returnTo`); the nonce can, because a remount replays the SAME
   * nonce while a new tap mints a new one.
   *
   * `''` means "an arrival we cannot identify" (a link minted without a nonce).
   * It never matches, so such an arrival always restamps — the direction that
   * can only under-report, never falsely credit.
   */
  intentId: string;
  /**
   * False between the moment of intent and the moment the ledger first loads
   * (milliseconds, and strictly BEFORE any account number can be on screen, so
   * no transfer can land inside it). The watch captures the anchor on that
   * first load; until then there is nothing to compare against.
   */
  isAnchored: boolean;
  /** Device clock. TTL/expiry ONLY — NEVER compared with a server timestamp. */
  startedAt: number;
}

function parseAnchor(
  record: Record<string, unknown>
): { anchor: WalletLedgerPosition | null } | null {
  const { anchor } = record;
  if (anchor === null || anchor === undefined) {
    return { anchor: null };
  }
  if (typeof anchor !== 'object') {
    return null;
  }
  const { createdAt, id } = anchor as Record<string, unknown>;
  if (typeof id !== 'string' || id === '') {
    return null;
  }
  if (typeof createdAt !== 'number' || !Number.isFinite(createdAt)) {
    return null;
  }
  return { anchor: { createdAt, id } };
}

/**
 * Anything unexpected yields `null` (= "no session"), including a marker
 * written by an older build (which carried a device-clock anchor and no
 * `isAnchored` flag). Refusing to trust it costs at most a timeout; trusting it
 * would reintroduce the device-clock comparison this model exists to remove.
 */
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
    // Scope check is belt-and-braces on top of the per-customer key.
    if (record.customerId !== customerId) {
      return null;
    }
    const { isAnchored, startedAt } = record;
    if (typeof startedAt !== 'number' || !Number.isFinite(startedAt)) {
      return null;
    }
    if (typeof isAnchored !== 'boolean') {
      return null;
    }
    const parsedAnchor = parseAnchor(record);
    if (!parsedAnchor) {
      return null;
    }
    const intentId =
      typeof record.intentId === 'string' ? record.intentId.trim() : '';
    return {
      anchor: isAnchored ? parsedAnchor.anchor : null,
      customerId,
      intentId,
      isAnchored,
      startedAt,
    };
  } catch {
    return null;
  }
}

async function writeSession(
  session: WalletFundingSession
): Promise<WalletFundingSession | null> {
  try {
    await AsyncStorage.setItem(
      walletFundingSessionKey(session.customerId),
      JSON.stringify(session)
    );
  } catch {
    // Fail-open: without the marker the watch falls back to the ledger head.
    return null;
  }
  return session;
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
    // it is not a trustworthy marker. Expiring early is the safe direction: it
    // only costs a timeout.
    await clearWalletFundingSession(customerId);
    return null;
  }
  return session;
}

/**
 * Marks the start of a bank-transfer funding session for `intentId`, UNANCHORED:
 * the ledger position is captured separately, by the watch, as soon as the
 * ledger loads (see `anchorWalletFundingSession`).
 *
 * Idempotent for the SAME intent and only for the same intent. The write-site
 * re-runs on every remount of `/wallet?action=bank-transfer&intent=…` (including
 * the remount after the customer comes back from their bank app), and a fresh
 * session then would re-anchor on a ledger that ALREADY contains the credit —
 * baselining away the very thing this marker exists to detect. But a genuinely
 * NEW attempt inside the TTL (a second tap of the nudge, which mints a new
 * nonce) MUST restamp: carrying the first attempt's anchor forward would let a
 * credit from that first attempt read as "new" for the second and announce money
 * that arrived earlier.
 *
 * Restamping is the fail-safe direction (a stale anchor can falsely credit; a
 * fresh one can only under-report and time out), so an arrival with no
 * `intentId` — which we cannot match against anything — restamps too.
 */
export async function startWalletFundingSession(
  customerId: string,
  intentId?: string | null
): Promise<WalletFundingSession | null> {
  if (!customerId) {
    return null;
  }
  const normalizedIntentId = intentId?.trim() ?? '';
  const existing = await readWalletFundingSession(customerId);
  if (
    existing &&
    normalizedIntentId !== '' &&
    existing.intentId === normalizedIntentId
  ) {
    // Same navigation, re-observed (remount / app relaunch): keep the anchor.
    return existing;
  }
  return writeSession({
    anchor: null,
    customerId,
    intentId: normalizedIntentId,
    isAnchored: false,
    startedAt: Date.now(),
  });
}

/**
 * Pins `session` to the ledger position that existed at the moment of intent —
 * called once, with the ledger head, the first time the ledger loads after the
 * customer arrived with intent.
 *
 * Refuses to overwrite: if the stored session has since been restamped by a new
 * intent, or was already anchored, the stored one wins (`null` is returned for
 * the restamped case so the caller falls back to the current ledger head, which
 * can only under-report). Never throws.
 */
export async function anchorWalletFundingSession(
  session: WalletFundingSession,
  position: WalletLedgerPosition | null
): Promise<WalletFundingSession | null> {
  const current = await readWalletFundingSession(session.customerId);
  if (
    !current ||
    current.intentId !== session.intentId ||
    current.startedAt !== session.startedAt
  ) {
    // A newer intent replaced this one mid-flight; its own anchor capture owns
    // the marker now.
    return null;
  }
  if (current.isAnchored) {
    return current;
  }
  return writeSession({ ...current, anchor: position, isAnchored: true });
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
