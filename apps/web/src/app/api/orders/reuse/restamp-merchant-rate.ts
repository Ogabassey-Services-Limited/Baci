import { resolveMerchantCurrencyConfig } from '@/lib/resolve-merchant-currency';
import { verifyOrderShippingRate } from '@/lib/shipping/merchant-rates/verify-order-shipping-rate';
import { createAdminClient } from '@/lib/supabase/admin';

interface RestampMerchantRateOnReuseParams {
  orderId: string;
  merchantId: string;
  /** The BARE merchant rate uuid forwarded by the checkout reuse request. */
  shippingRateId: string;
}

function isMissingMerchantRateMetadata(
  shippingProvider: unknown
): shippingProvider is null | undefined | string {
  return (
    shippingProvider === null ||
    shippingProvider === undefined ||
    (typeof shippingProvider === 'string' && shippingProvider.trim() === '')
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * The order's stored destination for zone matching. Prefer the ISO-2
 * `countryCode` (what `verifyOrderShippingRate` treats as authoritative);
 * fall back to a free-text `country` (ignored by the verifier unless ISO-2).
 */
function readOrderShippingAddressForVerify(value: unknown): {
  state: string | null;
  country: string | null;
} {
  if (!isRecord(value)) {
    return { state: null, country: null };
  }
  const state = typeof value.state === 'string' ? value.state : null;
  const country =
    typeof value.countryCode === 'string'
      ? value.countryCode
      : typeof value.country === 'string'
        ? value.country
        : null;
  return { state, country };
}

/**
 * Reuse-path analogue of the orders POST R9-5 re-stamp.
 *
 * A merchant-rate order stamps its fulfillment provider + rate-name via a
 * post-create UPDATE (the pickup-bypass create RPC has no provider param). If
 * that stamp failed on the FIRST attempt, the order exists but carries no
 * `shipping_provider` / `shipping_rate_name`. Reusing it (reopening the pending
 * order for a fresh payment) never re-runs the create-path stamp, so without
 * this the reopened order would keep a null provider forever and fulfillment
 * would lose the merchant-rate identity.
 *
 * R16-1 — never trust the request `shipping_rate_id` alone: a null
 * `shipping_provider` is ALSO the state of a legacy `pickup`/`airport` order
 * (fee 0, never a merchant rate). A customer holding their own order
 * token/email could otherwise POST any active rate id and corrupt an unrelated
 * order's fulfillment metadata. So the re-stamp is gated on SERVER-SIDE
 * EVIDENCE from the order's own persisted row: we re-run the exact order-time
 * verification (`verifyOrderShippingRate` — merchant-scoped rate load, zone
 * match against the order's stored `shipping_address`, fee recompute against
 * the order's stored `subtotal`) and only stamp when the recomputed fee equals
 * the order's stored `shipping_fee`. Two further guards make fee-equality safe
 * as an identity proxy — the create RPC never persists `shipping_rate_id`
 * atomically (only this post-create stamp and the idempotency hash carry it),
 * so there is NO trusted persisted rate identity to compare against:
 *   - ZERO-FEE SKIP: a recomputed fee of 0 cannot distinguish a genuine free
 *     merchant rate from a legacy free pickup/airport order (both equal a stored
 *     fee of 0 under the equality gate), so a zero fee proves nothing and the
 *     order is left unstamped (fail-safe).
 *   - COMPARE-AND-SET: the stamp UPDATE carries `.is('shipping_provider', null)`
 *     so a concurrent metadata writer that stamped a provider between the
 *     read-back and this UPDATE is never overwritten (only still-unstamped rows
 *     are touched).
 * A legacy pickup/airport order, a zero recomputed fee, or ANY mismatch → do
 * NOT stamp. Accepted residual: two DISTINCT non-zero rates that produce the
 * identical fee for the same zone + subtotal (e.g. an equal-priced ship vs
 * pickup rate) could still mislabel the fulfillment KIND — a narrow,
 * self-authenticated (the caller already holds the order token/email),
 * non-monetary metadata risk, since `shipping_fee` itself is persisted at
 * creation and unchanged here, accepted because there is no atomic rate identity
 * to compare against (re-architecting `create_storefront_order` is out of
 * scope). A recovered rate name/kind then configures fulfillment:
 *   - stamp provider + rate id (soft link) + rate name (durable snapshot);
 *   - a pickup rate stamps `MERCHANT_PICKUP` and snapshots its collection
 *     address, a shipped rate `MERCHANT`;
 *   - on a `23503` foreign-key violation (the rate was deleted between the
 *     verify load and the UPDATE) retry once dropping the soft-link id so the
 *     durable provider + name snapshot is still persisted.
 *
 * This NEVER throws or rejects the reuse: a re-stamp failure (or a rate-config
 * load outage — `verifyOrderShippingRate` throws, caught here) must not turn a
 * successful reuse into an error. When the metadata is already present it does
 * nothing (and never reloads the rate config).
 */
export async function restampMerchantRateOnReuse({
  orderId,
  merchantId,
  shippingRateId,
}: RestampMerchantRateOnReuseParams): Promise<void> {
  try {
    const admin = createAdminClient();

    // The prepare RPC's RETURNS TABLE does not carry these columns, and a guest
    // reuse holds no session that could pass orders RLS — so read the order's
    // persisted evidence back with the service-role client. The id is the
    // schema-validated order_id + merchant_id from the request.
    const { data: orderRow, error: readError } = await admin
      .from('orders')
      .select('shipping_provider, shipping_fee, subtotal, shipping_address')
      .eq('id', orderId)
      .eq('merchant_id', merchantId)
      .maybeSingle();
    if (readError) {
      console.warn('Reuse merchant-rate re-stamp order read-back failed', {
        orderId,
        merchantId,
        error: readError,
      });
      return;
    }

    if (!isMissingMerchantRateMetadata(orderRow?.shipping_provider)) {
      return;
    }

    const storedShippingFee = Number(orderRow?.shipping_fee);
    const storedSubtotal = Number(orderRow?.subtotal);
    if (
      !Number.isFinite(storedShippingFee) ||
      !Number.isFinite(storedSubtotal)
    ) {
      console.warn(
        'Reuse merchant-rate re-stamp skipped: order is missing a numeric shipping_fee/subtotal to verify against',
        { orderId, merchantId }
      );
      return;
    }

    // The verifier needs the store's canonical currency + country to reject a
    // stale-currency rate and resolve the domestic destination fallback.
    const { data: merchantRow, error: merchantError } = await admin
      .from('merchants')
      .select('country, payout_currency')
      .eq('id', merchantId)
      .maybeSingle();
    if (merchantError || !merchantRow) {
      console.warn('Reuse merchant-rate re-stamp merchant read-back failed', {
        orderId,
        merchantId,
        error: merchantError,
      });
      return;
    }

    // Re-run the order-time verification against the order's OWN persisted
    // evidence (stored subtotal + address). `verifyOrderShippingRate` loads the
    // merchant-scoped rate, matches the destination zone, and recomputes the
    // fee — throwing only on a rate-config LOAD outage, which we treat as
    // "cannot verify → do not stamp" (never failing the reuse).
    let verification: Awaited<ReturnType<typeof verifyOrderShippingRate>>;
    try {
      verification = await verifyOrderShippingRate({
        supabase: admin,
        merchantId,
        shippingRateId,
        shippingAddress: readOrderShippingAddressForVerify(
          orderRow?.shipping_address
        ),
        merchantCountry: merchantRow.country?.trim() || 'NG',
        merchantCurrency: resolveMerchantCurrencyConfig(merchantRow).code,
        canonicalSubtotal: storedSubtotal,
      });
    } catch (verificationError) {
      console.warn(
        'Reuse merchant-rate re-stamp could not verify the rate against the order; leaving the order unstamped',
        { orderId, merchantId, shippingRateId, error: verificationError }
      );
      return;
    }

    if (!verification.ok) {
      console.warn(
        'Reuse merchant-rate re-stamp skipped: the forwarded rate does not verify against this order',
        { orderId, merchantId, shippingRateId, code: verification.code }
      );
      return;
    }

    // (a) Zero-fee skip: a recomputed fee of 0 cannot distinguish a genuine
    // free merchant rate from a legacy free pickup/airport order — both equal a
    // stored shipping_fee of 0 under the equality gate below, so fee-equality
    // proves nothing about rate identity. Fail safe: leave the order unstamped.
    if (verification.amount <= 0.0001) {
      console.warn(
        'Reuse merchant-rate re-stamp skipped: a zero recomputed fee cannot distinguish a free merchant rate from a legacy free pickup/airport order',
        { orderId, merchantId, shippingRateId }
      );
      return;
    }

    // Server-side evidence gate: the recomputed fee must equal the order's
    // persisted shipping_fee. A legacy pickup/airport order (fee 0, no matching
    // merchant rate) or any tampered/unrelated rate id fails here and is NOT
    // stamped — the id alone is never trusted.
    if (Math.abs(verification.amount - storedShippingFee) > 0.01) {
      console.warn(
        'Reuse merchant-rate re-stamp skipped: recomputed rate fee does not match the order shipping_fee',
        {
          orderId,
          merchantId,
          shippingRateId,
          recomputedFee: verification.amount,
          storedShippingFee,
        }
      );
      return;
    }

    const shippingProvider =
      verification.kind === 'pickup' ? 'MERCHANT_PICKUP' : 'MERCHANT';
    // Snapshot the collection point for pickup rates so a reuse recovers the
    // same durable pickup address/instructions the create/replay path persists
    // (ship rates omit the field). Mirrors the create-path stamp.
    const pickupDetailsUpdate =
      verification.kind === 'pickup'
        ? { shipping_pickup_details: verification.pickupAddress ?? null }
        : {};
    // (b) Compare-and-set: `.is('shipping_provider', null)` so a concurrent
    // metadata writer that stamped a provider between the read-back and this
    // UPDATE is never overwritten — only still-unstamped rows are touched.
    const { error: stampError } = await admin
      .from('orders')
      .update({
        shipping_provider: shippingProvider,
        shipping_rate_id: shippingRateId,
        shipping_rate_name: verification.rateName,
        ...pickupDetailsUpdate,
      })
      .eq('id', orderId)
      .eq('merchant_id', merchantId)
      .is('shipping_provider', null);
    if (!stampError) {
      return;
    }

    // Mirror the create-path 23503 retry: the rate can be deleted between the
    // verify load and this UPDATE, so drop the soft-link id and keep the durable
    // provider + rate-name snapshot (the id is recoverable-as-null; the name
    // is not).
    if (stampError.code === '23503') {
      const { error: retryError } = await admin
        .from('orders')
        .update({
          shipping_provider: shippingProvider,
          shipping_rate_id: null,
          shipping_rate_name: verification.rateName,
          ...pickupDetailsUpdate,
        })
        .eq('id', orderId)
        .eq('merchant_id', merchantId)
        .is('shipping_provider', null);
      if (retryError) {
        console.error(
          'Failed to re-stamp reused merchant-rate order after dropping the deleted rate id',
          { orderId, merchantId, shippingProvider, error: retryError }
        );
      }
      return;
    }

    console.error(
      'Failed to re-stamp reused merchant-rate fulfillment metadata',
      { orderId, merchantId, shippingProvider, error: stampError }
    );
  } catch (error) {
    // Best-effort only: a re-stamp failure must never turn a successful reuse
    // into an error response.
    console.error(
      'Reused merchant-rate re-stamp raised unexpectedly; leaving the order metadata as-is',
      { orderId, merchantId, shippingRateId, error }
    );
  }
}
