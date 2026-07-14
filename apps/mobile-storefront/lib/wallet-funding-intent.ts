import { sanitizeResumableWalletReturnTo } from '@/lib/resumable-wallet-return-to';
import type { WalletReturnHref } from '@/lib/sanitize-wallet-return-to';
import { asyncStorage } from '@/lib/storage';

/**
 * Local, single-use record of "the customer opened the wallet funding surface
 * in order to resume <destination>".
 *
 * WHY THIS EXISTS: only CARD top-ups POST to `/wallet/top-up/initialize`, so
 * only they can persist `return_to` into the transaction metadata the webhook
 * reads. A DVA / bank-transfer top-up has no client initialize call at all —
 * the DVA is a standing account number and the transaction row is created by
 * `confirmPaystackWalletDvaTopUp` when the Paystack webhook lands, from
 * customer/provider metadata only. Bank transfer being the primary funding
 * path, the wallet-credited deep link would otherwise resume nothing.
 *
 * The app already knows the destination locally when the customer opens the
 * funding surface, so it is recorded here instead of in the database: no
 * migration (append-only, and a bad one blocks every deploy), no new
 * authenticated endpoint, no extra read on the money path. It degrades safely
 * — a credit landing on a different device simply opens `/wallet`.
 *
 * SAFETY: the value is validated against the strict resumable allowlist on
 * BOTH write and read, is single-use (removed the moment it is read), and
 * expires, so a stale intent cannot hijack a much later, unrelated credit.
 */
export const WALLET_FUNDING_INTENT_STORAGE_KEY =
  '@baci_storefront_wallet_funding_intent';

/** Matches the route-resume TTL: beyond this the "interrupted purchase" is stale. */
export const WALLET_FUNDING_INTENT_TTL_MS = 30 * 60 * 1000;

interface PersistedWalletFundingIntent {
  returnTo: string;
  savedAt: number;
}

// All helpers are fail-open, like push-token-storage: a storage failure must
// never break funding or a notification tap. The worst case is landing on
// `/wallet`, which is exactly the pre-existing behaviour.

export async function clearWalletFundingIntent(): Promise<void> {
  try {
    await asyncStorage.removeItem(WALLET_FUNDING_INTENT_STORAGE_KEY);
  } catch {
    // Fail-open
  }
}

/**
 * Records the destination to resume after the wallet is funded. A value that
 * fails the strict allowlist is never stored — and clears any previous intent,
 * so a hostile or non-resumable navigation cannot leave an older intent armed.
 */
export async function storeWalletFundingIntent(value: unknown): Promise<void> {
  const returnTo = sanitizeResumableWalletReturnTo(value);
  if (!returnTo) {
    await clearWalletFundingIntent();
    return;
  }

  try {
    await asyncStorage.setItem(
      WALLET_FUNDING_INTENT_STORAGE_KEY,
      JSON.stringify({
        returnTo,
        savedAt: Date.now(),
      } satisfies PersistedWalletFundingIntent)
    );
  } catch {
    // Fail-open
  }
}

/**
 * Reads and CLEARS the pending intent (single-use). Returns it only if it is
 * still within the TTL and still passes the strict resumable allowlist — the
 * stored value is re-validated on read so an allowlist tightening, or anything
 * that wrote to this key out of band, cannot produce a navigation the current
 * policy would reject.
 */
export async function consumeWalletFundingIntent(): Promise<
  WalletReturnHref | undefined
> {
  let raw: string | null = null;
  try {
    raw = await asyncStorage.getItem(WALLET_FUNDING_INTENT_STORAGE_KEY);
  } catch {
    return undefined;
  }

  // Cleared unconditionally: an unparseable or expired record must not survive
  // to be retried against a later credit.
  await clearWalletFundingIntent();

  if (!raw) {
    return undefined;
  }

  let parsed: Partial<PersistedWalletFundingIntent>;
  try {
    parsed = JSON.parse(raw) as Partial<PersistedWalletFundingIntent>;
  } catch {
    return undefined;
  }

  if (
    typeof parsed.savedAt !== 'number' ||
    !Number.isFinite(parsed.savedAt) ||
    Date.now() - parsed.savedAt > WALLET_FUNDING_INTENT_TTL_MS ||
    Date.now() < parsed.savedAt
  ) {
    return undefined;
  }

  return sanitizeResumableWalletReturnTo(parsed.returnTo);
}
