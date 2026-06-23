/**
 * Cart repricing against the live catalog.
 *
 * The cart persists the unit price captured at add-to-cart time. Catalog prices
 * can drift afterwards (merchant edits, promos ending), leaving the cart stale.
 * The order API validates each line against the LIVE catalog
 * (`variant.price_override ?? product.price`) — so a stale cart price triggers
 * confusing checkout rejections (e.g. `negotiated_price_below_floor`).
 *
 * This service re-fetches the authoritative unit price for each cart line using
 * the SAME sources the server's order validation uses:
 *   - base price  -> products.price
 *   - variant     -> get_order_variant_overrides RPC (RLS-safe, anon-granted)
 * so the reconciled cart basis matches what checkout will accept.
 */

import { createLogger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import type { CartItem } from '@/stores/cart-store';

const log = createLogger('CartReprice');

// Mirror the RPC's ±1 NGN parity tolerance so display rounding is not treated
// as a price change.
const PRICE_TOLERANCE = 1;

export interface CartPriceChange {
  id: string;
  name: string;
  oldPrice: number;
  newPrice: number;
}

export interface RepriceResult {
  /** Live unit price keyed by cart line id (only lines we could resolve). */
  priceById: Record<string, number>;
  /** Lines whose unit price drifted beyond tolerance. */
  changes: CartPriceChange[];
}

type VariantOverrideRow = {
  id: string;
  product_id: string;
  price_override: number | string | null;
};

const EMPTY_RESULT: RepriceResult = { priceById: {}, changes: [] };

export async function repriceCartItems(
  items: CartItem[],
  merchantId: string
): Promise<RepriceResult> {
  const productIds = Array.from(
    new Set(items.map((item) => item.product_id).filter(Boolean))
  );
  if (productIds.length === 0 || !merchantId) {
    return EMPTY_RESULT;
  }

  try {
    const variantIds = Array.from(
      new Set(
        items
          .map((item) => item.variant_id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0)
      )
    );

    // Base prices (active products only — mirrors the order RPC's catalog read).
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, price')
      .eq('merchant_id', merchantId)
      .eq('status', 'active')
      .in('id', productIds);

    if (productsError || !products) {
      // Fail open: keep the existing cart prices rather than blocking the cart.
      log.warn('Reprice products lookup failed; keeping cart prices', {
        error: productsError?.message,
      });
      return EMPTY_RESULT;
    }

    const productPrice = new Map<string, number>();
    for (const product of products) {
      productPrice.set(product.id, Number(product.price));
    }

    // Variant overrides via the same RLS-safe RPC the order validation uses.
    const variantOverride = new Map<string, number | null>();
    if (variantIds.length > 0) {
      const { data: variants, error: variantsError } = (await supabase.rpc(
        'get_order_variant_overrides',
        { p_variant_ids: variantIds }
      )) as unknown as {
        data: VariantOverrideRow[] | null;
        error: { message: string } | null;
      };
      if (variantsError) {
        // Fail open on the variant leg: fall back to base product price.
        log.warn('Reprice variant override lookup failed; using base prices', {
          error: variantsError.message,
        });
      } else {
        for (const variant of variants ?? []) {
          variantOverride.set(
            variant.id,
            variant.price_override == null
              ? null
              : Number(variant.price_override)
          );
        }
      }
    }

    const result: RepriceResult = { priceById: {}, changes: [] };
    for (const item of items) {
      const basePrice = productPrice.get(item.product_id);
      if (basePrice == null) {
        // Product missing/inactive — leave the line untouched; availability is
        // validated separately at checkout.
        continue;
      }
      // Authoritative unit price: variant.price_override ?? product.price.
      const override = item.variant_id
        ? variantOverride.get(item.variant_id)
        : undefined;
      const liveUnitPrice = override != null ? override : basePrice;
      if (!Number.isFinite(liveUnitPrice) || liveUnitPrice <= 0) {
        continue;
      }

      result.priceById[item.id] = liveUnitPrice;
      if (Math.abs(liveUnitPrice - item.price) > PRICE_TOLERANCE) {
        result.changes.push({
          id: item.id,
          name: item.name,
          oldPrice: item.price,
          newPrice: liveUnitPrice,
        });
      }
    }

    return result;
  } catch (error) {
    // Network/unexpected failure must never block the cart or checkout.
    log.warn('Reprice failed unexpectedly; keeping cart prices', {
      error: error instanceof Error ? error.message : String(error),
    });
    return EMPTY_RESULT;
  }
}
