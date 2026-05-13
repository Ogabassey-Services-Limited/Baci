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

  const { data: merchant } = await supabase
    .from('merchants')
    .select('vat_registration_status')
    .eq('id', merchantId)
    .maybeSingle();

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

  const { data: products } = await supabase
    .from('products')
    .select('id, price, vat_category_code, vat_rate')
    .in('id', productIds)
    .returns<ProductVatRow[]>();

  const variantsQuery = variantIds.length
    ? await supabase
        .from('product_variants')
        .select('id, price_override')
        .in('id', variantIds)
        .returns<VariantPriceRow[]>()
    : { data: [] as VariantPriceRow[] };

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
