import type { NegotiationCartLine } from '@baci/shared/lib';
import type { CartItem } from '@/hooks/cart';
import {
  getCartItemCheckoutUnitPrice,
  isQuizVoucherCartItem,
} from '@/lib/checkout/cart-entitlement-sanitizer';

export function foldCartLineVariantSelection(item: CartItem) {
  const variantAttributes: Record<string, string> = {
    ...(item.variantAttributes ?? {}),
  };
  const variantParts = Object.entries(variantAttributes).map(
    ([key, value]) => `${key}: ${value}`
  );
  const seenLabels = new Set(
    Object.keys(variantAttributes).map((key) => key.trim().toLowerCase())
  );
  const seenPairs = new Set(
    Object.entries(variantAttributes).map(
      ([key, value]) =>
        `${key.trim().toLowerCase()}::${value.trim().toLowerCase()}`
    )
  );

  for (const [label, value] of [
    ['Color', item.selectedColor],
    ['Secondary color', item.secondaryColor],
    ['Storage', item.selectedStorage],
  ] as const) {
    const normalized = value?.trim().toLowerCase();
    const normalizedLabel = label.toLowerCase();
    const pairKey = `${normalizedLabel}::${normalized}`;
    if (
      !value ||
      !normalized ||
      seenLabels.has(normalizedLabel) ||
      seenPairs.has(pairKey)
    ) {
      continue;
    }

    variantAttributes[label] = value;
    variantParts.push(`${label}: ${value}`);
    seenLabels.add(normalizedLabel);
    seenPairs.add(pairKey);
  }

  return {
    variantAttributes:
      Object.keys(variantAttributes).length > 0 ? variantAttributes : undefined,
    variantName: [...new Set(variantParts)].join(' · ') || undefined,
  };
}

export function toNegotiationCartLine(
  item: CartItem
): Partial<NegotiationCartLine> {
  const { variantName } = foldCartLineVariantSelection(item);

  return {
    product_id: item.id,
    name: item.name,
    price: isQuizVoucherCartItem(item) ? 0 : getCartItemCheckoutUnitPrice(item),
    quantity: item.quantity,
    image: item.image,
    variant_id: item.variantId,
    variant_name: variantName,
    brand: item.brand,
    condition: item.condition,
  };
}

export function deriveCartLineNegotiationProps(item: CartItem): {
  itemId: string;
  variantId?: string;
  variantAttributes?: Record<string, string>;
  condition?: string;
  productSlug?: string;
  productBrand?: string;
} {
  const { variantAttributes } = foldCartLineVariantSelection(item);

  return {
    itemId: item.cartItemId,
    variantId: item.variantId,
    variantAttributes,
    condition: item.condition,
    productSlug: item.slug,
    productBrand: item.brand,
  };
}
