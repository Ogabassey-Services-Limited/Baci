import { isFiniteNumber } from './is-finite-number';
import type { NegotiationItemInfo } from './negotiation-cart-snapshot';

export interface NegotiationSingleItemInfoInput {
  itemId?: string;
  productName: string;
  productBrand?: string;
  currentPrice: number;
  productSlug?: string;
  variantId?: string;
  variantName?: string;
  variantAttributes?: Record<string, string>;
  condition?: string;
}

function cleanOptionalString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function cleanVariantAttributes(
  attributes: Record<string, string> | undefined
): Record<string, string> | undefined {
  const entries = Object.entries(attributes ?? {}).flatMap(([key, value]) => {
    const cleanKey = cleanOptionalString(key);
    const cleanValue = cleanOptionalString(value);
    return cleanKey && cleanValue ? [[cleanKey, cleanValue] as const] : [];
  });
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

export function buildNegotiationSingleItemInfo(
  input: NegotiationSingleItemInfoInput
): NegotiationItemInfo {
  const itemInfo: NegotiationItemInfo = {
    name: input.productName.trim(),
  };

  if (isFiniteNumber(input.currentPrice) && input.currentPrice >= 0) {
    itemInfo.current_price = input.currentPrice;
  }

  const id = cleanOptionalString(input.itemId);
  if (id) itemInfo.id = id;
  const productSlug = cleanOptionalString(input.productSlug);
  if (productSlug) itemInfo.product_slug = productSlug;
  const brand = cleanOptionalString(input.productBrand);
  if (brand) itemInfo.brand = brand;
  const variantId = cleanOptionalString(input.variantId);
  if (variantId) itemInfo.variant_id = variantId;
  const variantName = cleanOptionalString(input.variantName);
  if (variantName) itemInfo.variant_name = variantName;
  const variantAttributes = cleanVariantAttributes(input.variantAttributes);
  if (variantAttributes) itemInfo.variant_attributes = variantAttributes;
  const condition = cleanOptionalString(input.condition);
  if (condition) itemInfo.condition = condition;

  return itemInfo;
}
