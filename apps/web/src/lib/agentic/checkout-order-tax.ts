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

interface VariantPriceRow {
  id: string;
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
    throw new Error(
      `Failed to load merchant VAT status: ${merchantError.message}`
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
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, price, vat_category_code, vat_rate')
    .in('id', productIds)
    .returns<ProductVatRow[]>();

  if (productsError) {
    throw new Error(
      `Failed to load products for VAT computation: ${productsError.message}`
    );
  }

  // Codex P1 (PR #1622 round 5, second iteration): the agentic
  // scoped supabase client's JWT uses `sub = merchant_id`. The
  // `product_variants` RLS policies (baseline:13970-14302) all key
  // on `merchants.user_id = auth.uid()`, so a direct SELECT here
  // returns ZERO rows in agentic context — the helper would fall
  // back to base product price, the RPC's per-line trigger would
  // compute against the true variant `price_override`, and the
  // parity guard would RAISE `tax_amount_mismatch` for every
  // variant-priced cart.
  //
  // Route through `get_storefront_product_variants` (baseline:3731):
  // SECURITY DEFINER, granted to anon/authenticated/service_role,
  // filters to active products + published merchants — exactly the
  // shape an agentic checkout is bound to. The function returns
  // more fields than we need; we only consume `id` and
  // `price_override`, so the runtime row shape is compatible with
  // `VariantPriceRow`.
  // The generated Supabase types for `get_storefront_product_variants`
  // mis-describe the RPC return as a single row (`RETURNS TABLE(...)`
  // generators sometimes do this for SETOF functions). The runtime
  // shape is a row array; we cast through `unknown` to a narrow type
  // exposing only the fields we read.
  const variantsRpcResult = variantIds.length
    ? await supabase.rpc('get_storefront_product_variants', {
        p_product_ids: productIds,
      })
    : { data: [], error: null };
  const variantsQuery = variantsRpcResult as unknown as {
    data: VariantPriceRow[] | null;
    error: { message: string } | null;
  };

  if (variantsQuery.error) {
    throw new Error(
      `Failed to load product variants for VAT computation: ${variantsQuery.error.message}`
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

    const variant = item.variant_id ? variantMap.get(item.variant_id) : null;
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
