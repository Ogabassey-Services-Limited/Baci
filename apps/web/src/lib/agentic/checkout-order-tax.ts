import type { SupabaseClient } from '@supabase/supabase-js';

// Codex P1 (PR #1622 round 5): agentic checkout dispatch builds its
// payload from `calculateCheckoutSession`, which currently computes
// `tax: 0` for every line item and emits no `tax` total. Before
// B3.5 that was harmless — the trigger silently recomputed
// `orders.tax_amount` post-insert and the RPC returned the trigger's
// view. With B3.5's `tax_amount_mismatch` guard, a VAT-registered
// merchant gets RAISE → 400 → checkout broken.
//
// Until `calculateCheckoutSession` learns about VAT (deferred —
// changing the agentic session calc shape touches every consumer of
// `GPTLineItem` / `GPTTotal`), the dispatch layer recomputes the
// expected per-item VAT itself and overrides `p_tax_amount`. The
// formula MUST mirror the RPC's `v_expected_tax` block byte-for-byte
// (which in turn mirrors `populate_order_item_tax` +
// `update_order_tax_totals` triggers) or the dispatch and RPC
// disagree and we're back to mismatch land:
//
//   per-line: vat_category 'S' →
//     ROUND(ROUND(quantity * price, 2) * vat_rate / 100, 2)
//   else: 0
//   total: SUM(per-line)
//
// NULL fallbacks match the `order_items` column defaults the
// BEFORE-INSERT trigger inherits:
//   * vat_category_code → 'S'
//   * vat_rate          → 7.5
// (NOT the merchant rate — the trigger doesn't consult merchant
// rate for the per-line vat_amount.)
//
// For VAT-not-registered merchants the helper returns 0 because the
// RPC enforces `p_tax_amount ≤ 1` in that case.
//
// IMPORTANT: the `supabase` argument MUST be a service-role client
// (e.g., `createAdminClient()` from `@/lib/supabase/admin`). The
// variant lookup needs to bypass `product_variants` RLS to read
// `price_override` rows for unpublished merchants and for agentic
// JWTs whose `sub = merchant_id` doesn't match any
// `merchants.user_id`. The helper is server-only and only performs
// query-shaped reads; RLS bypass is bounded to those reads.

interface AgenticTaxItem {
  // Optional to accept the dispatch's pre-validation payload shape
  // where `product_id` is `string | undefined` (the dispatch guards
  // missing IDs and returns 400 before we get here). The helper
  // itself skips items with missing product_id defensively.
  product_id?: string;
  variant_id?: string | null;
  quantity: number;
}

interface ProductVatRow {
  id: string;
  price: number | string | null;
  vat_category_code: string | null;
  vat_rate: number | string | null;
}

// Codex P2 (PR #1622 round 7): the helper's `.in('id', productIds)` /
// `.in('id', variantIds)` queries hit Postgres's UUID parser with the
// raw client strings. Zod only validates these as `string`, so a
// malformed item id (e.g. a slug, a stale autoincrement int) makes the
// DB return error code `22P02` ("invalid input syntax for type
// uuid"). The previous behavior at /api/orders mapped 22P02 as a
// CLIENT error (see `clientErrorCodes` in the route — '22P02' is in
// the list). The new pre-RPC tax compute was reporting those as
// `TAX_COMPUTE_FAILED` 500, regressing that mapping. Carry the pg
// code on the thrown error so callers can map 22P02 → 4xx and
// everything else → 5xx.
export class TaxComputeError extends Error {
  readonly pgCode: string | undefined;
  constructor(message: string, pgCode?: string | null | undefined) {
    super(message);
    this.name = 'TaxComputeError';
    this.pgCode = typeof pgCode === 'string' ? pgCode : undefined;
  }
}

/** True if the helper failed due to a Postgres UUID parse error. */
export function isTaxComputeUuidError(err: unknown): boolean {
  return err instanceof TaxComputeError && err.pgCode === '22P02';
}

interface VariantPriceRow {
  id: string;
  // High finding (PR #1622 review): variants must be validated to
  // belong to the same product the order line claims. The RPC's
  // LEFT JOIN enforces `v.product_id = p.id` (so a mismatched
  // variant_id falls through to NULL and price_override defaults to
  // base price). The helper must mirror that or it can apply the
  // wrong override and trip the parity guard for orders containing
  // a spoofed cross-product variant_id.
  product_id: string;
  price_override: number | string | null;
}

function roundToCents(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function computeAgenticOrderTax({
  items,
  merchantId,
  supabase,
}: {
  items: AgenticTaxItem[];
  merchantId: string;
  supabase: SupabaseClient;
}): Promise<number> {
  if (items.length === 0 || !merchantId) {
    return 0;
  }

  // Codex P2 (PR #1622 round 5): destructuring `{ data: merchant }`
  // alone drops the `error` field, so a transient DB/RLS failure
  // looks identical to "merchant not registered" — helper returned
  // 0, dispatch sent `p_tax_amount: 0`, RPC RAISEd
  // `tax_amount_mismatch`, dispatch reported 400. That made
  // server-side infra failures look like client validation errors
  // and the caller (GPT agent) would not retry. Throw on real
  // errors so the dispatch's catch maps to 500 and the caller
  // retries the call as an infrastructure issue. NULL `data` with
  // no error is still treated as "not registered" — the merchant
  // may have been deleted mid-flow; `create_storefront_order` will
  // RAISE `merchant_not_found` shortly after and the dispatch will
  // map that to 400, which is correct.
  const { data: merchant, error: merchantError } = await supabase
    .from('merchants')
    .select('vat_registration_status')
    .eq('id', merchantId)
    .maybeSingle();

  if (merchantError) {
    throw new TaxComputeError(
      `Failed to load merchant VAT status: ${merchantError.message}`,
      (merchantError as { code?: string }).code
    );
  }

  if (merchant?.vat_registration_status !== 'registered') {
    return 0;
  }

  const productIds = Array.from(
    new Set(items.map((i) => i.product_id).filter((id): id is string => !!id))
  );
  const variantIds = Array.from(
    new Set(
      items
        .map((i) => i.variant_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    )
  );

  if (productIds.length === 0) return 0;

  // Same Codex P2 reasoning as the merchant lookup: a query error
  // here must not silently degrade to "0 tax" because that pretends
  // to be a successful compute and trips the RPC parity guard with
  // a misleading 4xx. Propagate as a throwable so the dispatch's
  // try/catch returns 500 and the caller retries.
  //
  // High finding (PR #1622 review): the products SELECT MUST be
  // scoped to `merchant_id`. `products_select_policy` (baseline:15317)
  // allows `status = 'active'` reads from any client, including
  // anonymous and agentic-scoped JWTs. Without `.eq('merchant_id',
  // merchantId)`, a caller could pass cross-tenant product IDs and
  // the helper would compute tax against another merchant's prices
  // / VAT categories — the RPC itself scopes
  // `products p ON p.id = r.product_id AND p.merchant_id = p_merchant_id`,
  // so the helper must match.
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, price, vat_category_code, vat_rate')
    .eq('merchant_id', merchantId)
    .in('id', productIds)
    .returns<ProductVatRow[]>();

  if (productsError) {
    throw new TaxComputeError(
      `Failed to load products for VAT computation: ${productsError.message}`,
      (productsError as { code?: string }).code
    );
  }

  // Codex P2 (PR #1622 round 6): an earlier iteration of this
  // helper routed variant reads through
  // `get_storefront_product_variants`, but that SDF filters
  // `WHERE m.is_published = TRUE` (baseline:3758). Agentic
  // checkout merchant resolution is NOT publication-gated, and
  // the storefront API route also handles draft merchants via
  // authed merchant access — so an unpublished VAT-registered
  // merchant with variant overrides would get an empty variants
  // set here, the helper would fall back to product base price,
  // the RPC's per-line trigger would compute against the TRUE
  // variant `price_override`, and the parity guard would RAISE
  // `tax_amount_mismatch` despite a perfectly valid order. Codex
  // surfaced this as a P2 because the user-facing failure mode
  // (a 400 on a real cart) is severe even if the population is
  // small.
  //
  // Direct SELECT on `product_variants` requires service-role —
  // every RLS policy on this table keys on
  // `merchants.user_id = auth.uid()` (baseline:13970-14302).
  // Callers of `computeAgenticOrderTax` MUST pass a service-role
  // client (e.g., `createAdminClient()`). The merchant_id has
  // already been validated upstream and the helper's only writes
  // are query-shaped reads, so RLS bypass here is bounded.
  const { data: variantsData, error: variantsError } = variantIds.length
    ? await supabase
        .from('product_variants')
        .select('id, product_id, price_override')
        .in('id', variantIds)
        .returns<VariantPriceRow[]>()
    : { data: [], error: null };
  const variantsQuery: {
    data: VariantPriceRow[] | null;
    error: { message: string; code?: string } | null;
  } = { data: variantsData, error: variantsError };

  if (variantsQuery.error) {
    throw new TaxComputeError(
      `Failed to load product variants for VAT computation: ${variantsQuery.error.message}`,
      variantsQuery.error.code
    );
  }

  const productMap = new Map((products ?? []).map((p) => [p.id, p]));
  const variantMap = new Map((variantsQuery.data ?? []).map((v) => [v.id, v]));

  let total = 0;
  for (const item of items) {
    if (!item.product_id) continue;
    const product = productMap.get(item.product_id);
    if (!product) continue;

    const category = product.vat_category_code ?? 'S';
    if (category !== 'S') continue;

    // High finding (PR #1622 review): variant must belong to the
    // SAME product the order line claims. The RPC's LEFT JOIN
    // (`v.product_id = p.id`) enforces this and falls back to base
    // price for mismatched variant_ids; the helper must mirror it
    // or a caller can spoof a variant_id from a different product
    // and trip the parity guard. SDF returns variants for ALL
    // products in `productIds`, so cross-line ambiguity exists when
    // multiple products are in the cart.
    const candidateVariant = item.variant_id
      ? variantMap.get(item.variant_id)
      : null;
    const variant =
      candidateVariant && candidateVariant.product_id === item.product_id
        ? candidateVariant
        : null;
    const priceRaw = variant?.price_override ?? product.price ?? 0;
    const price = Number(priceRaw);
    if (!Number.isFinite(price) || price <= 0) continue;

    const quantity = Number(item.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) continue;

    const rate = Number(product.vat_rate ?? 7.5);
    if (!Number.isFinite(rate) || rate < 0) continue;

    const lineExtension = roundToCents(quantity * price);
    const lineTax = roundToCents((lineExtension * rate) / 100);
    total += lineTax;
  }

  return roundToCents(total);
}
