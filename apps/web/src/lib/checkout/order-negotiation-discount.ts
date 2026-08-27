import {
  isProductNegotiable,
  MAX_AUTO_NEGOTIATION_DISCOUNT_RATE,
} from '@baci/shared/lib';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { CanonicalOrderSubtotalLoadError } from './canonical-order-subtotal';
import {
  computeEligibleLineDiscount,
  type EligibleLineDiscountResult,
  type NegotiationLineInput,
} from './eligible-line-discount';

type VariantPriceRow = {
  id: string;
  product_id: string;
  price_override: number | string | null;
};

type NegotiationCatalogRow = {
  id: string;
  name: string | null;
  brand: string | null;
  price: number | string | null;
  vat_category_code: string | null;
  vat_rate: number | string | null;
};

type NegotiationDiscountItem = {
  product_id?: string;
  variant_id?: string | null;
  quantity: number;
  price: number; // client negotiated unit price (orderItemsPayload[].price)
  // Set on orderItemsPayload only after server-side quiz-voucher token
  // verification. Such lines are legitimately priced at 0 (the voucher RPC
  // applies the award amount as the order discount), so they are EXEMPT from
  // the floor / non-negotiable checks below.
  voucher_award_id?: string | null;
};

export async function computeOrderNegotiationDiscount({
  items,
  merchantId,
  supabase,
  vatRegistered,
}: {
  items: NegotiationDiscountItem[];
  merchantId: string;
  supabase: SupabaseClient;
  // The route passes `merchant.vat_registration_status === 'registered'`.
  // Non-registered merchants charge no VAT, so the discount must not gross up.
  vatRegistered: boolean;
}): Promise<EligibleLineDiscountResult | null> {
  // Exempt verified quiz-voucher award lines entirely — they're legitimately
  // priced at 0 and dispatched to the voucher RPC. Excluding them from the id
  // lists means a pure-voucher order skips the products query and returns null
  // (so existing voucher tests need no products mock).
  const validatableItems = items
    .map((item, index) => ({ item, lineId: index + 1 }))
    .filter(({ item }) => !item.voucher_award_id);
  const productIds = Array.from(
    new Set(
      validatableItems
        .map(({ item }) => item.product_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    )
  );
  const variantIds = Array.from(
    new Set(
      validatableItems
        .map(({ item }) => item.variant_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    )
  );

  if (productIds.length === 0) {
    return null;
  }

  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, name, brand, price, vat_category_code, vat_rate')
    .eq('merchant_id', merchantId)
    .in('id', productIds)
    .overrideTypes<NegotiationCatalogRow[], { merge: false }>();

  if (productsError || !products) {
    logger.warn({
      message: 'Unable to load products for negotiation discount',
      error: productsError,
      merchantId,
    });
    throw new CanonicalOrderSubtotalLoadError(
      'Unable to load products for negotiation discount',
      { cause: productsError ?? undefined },
      (productsError as { code?: string } | null | undefined)?.code
    );
  }

  const { data: variantsData, error: variantsError } = variantIds.length
    ? ((await supabase.rpc('get_order_variant_overrides', {
        p_variant_ids: variantIds,
      })) as unknown as {
        data: VariantPriceRow[] | null;
        error: { message: string; code?: string } | null;
      })
    : { data: [] as VariantPriceRow[], error: null };

  if (variantsError) {
    throw new CanonicalOrderSubtotalLoadError(
      'Unable to load variants for negotiation discount',
      { cause: variantsError },
      variantsError.code
    );
  }

  const productMap = new Map(products.map((product) => [product.id, product]));
  const variantMap = new Map(
    (variantsData ?? []).map((variant) => [variant.id, variant])
  );

  const lines: NegotiationLineInput[] = [];
  for (const { item, lineId } of validatableItems) {
    if (!item.product_id) {
      return null;
    }
    const product = productMap.get(item.product_id);
    if (!product) {
      return null;
    }
    const candidateVariant = item.variant_id
      ? variantMap.get(item.variant_id)
      : null;
    const variant =
      candidateVariant && candidateVariant.product_id === item.product_id
        ? candidateVariant
        : null;
    lines.push({
      catalogUnitPrice: Number(variant?.price_override ?? product.price ?? 0),
      clientUnitPrice: Number(item.price),
      lineId,
      productId: item.product_id,
      quantity: Number(item.quantity),
      negotiable: isProductNegotiable({
        brand: product.brand,
        name: product.name,
      }),
      vatCategoryCode: product.vat_category_code,
      // Force rate 0 for non-registered merchants so the per-line discount
      // matches the RPC (which charges 0 VAT) — otherwise a valid 2% discount
      // over-discounts by the gross-up and trips order_total_mismatch.
      vatRate: vatRegistered
        ? product.vat_rate == null
          ? null
          : Number(product.vat_rate)
        : 0,
      variantId: item.variant_id ?? null,
    });
  }

  return computeEligibleLineDiscount(lines, MAX_AUTO_NEGOTIATION_DISCOUNT_RATE);
}
