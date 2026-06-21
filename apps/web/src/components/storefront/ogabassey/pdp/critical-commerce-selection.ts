import type { Product as CartProduct, ProductVariant } from '@/lib/products';
import { canonicalizeVariantAxis } from '@/components/storefront/ogabassey/variant-attributes';

export interface InitialCriticalVariantSelection {
  attributes?: Record<string, string>;
  condition?: string;
  variantId?: string;
}

export interface ResolvedCriticalVariantSelection {
  attributes: Record<string, string>;
  color?: string;
  compareAtPrice?: number;
  condition?: string;
  price: number;
  storage?: string;
  variant: ProductVariant;
}

const PRICE_FORMATTER: Intl.NumberFormat = new Intl.NumberFormat('en-NG', {
  currency: 'NGN',
  maximumFractionDigits: 0,
  style: 'currency',
});

export function formatCriticalPrice(price: number) {
  return PRICE_FORMATTER.format(price);
}

function getVariantStock(
  cartProduct: CartProduct,
  selection: ResolvedCriticalVariantSelection | null
) {
  if (!selection) {
    return cartProduct.stock;
  }

  return typeof selection.variant.stock_quantity === 'number'
    ? selection.variant.stock_quantity
    : cartProduct.stock;
}

export function buildVariantCartProduct(
  cartProduct: CartProduct,
  selection: ResolvedCriticalVariantSelection | null
): CartProduct {
  if (!selection) {
    return cartProduct;
  }

  const variantImage =
    selection.variant.primary_image || selection.variant.images?.[0];

  return {
    ...cartProduct,
    compare_at_price: selection.compareAtPrice ?? cartProduct.compare_at_price,
    condition:
      (selection.condition as CartProduct['condition'] | undefined) ??
      cartProduct.condition,
    image: variantImage ?? cartProduct.image,
    imageLarge: variantImage ?? cartProduct.imageLarge,
    price: selection.price,
    stock: getVariantStock(cartProduct, selection),
  };
}

export function compactVariantOptions(
  options: Record<string, Record<string, string> | string | undefined>
) {
  return Object.fromEntries(
    Object.entries(options).filter(([, value]) => value !== undefined)
  );
}

export function normalizeCriticalVariantAttributes(
  attributes: Record<string, string> | null | undefined
) {
  const normalized: Record<string, string> = {};

  for (const [rawAxis, value] of Object.entries(attributes || {})) {
    const axis = canonicalizeVariantAxis(rawAxis);
    const trimmedValue = value.trim();

    if (!axis || !trimmedValue) {
      continue;
    }

    normalized[axis] = trimmedValue;
  }

  return normalized;
}

export function normalizeCriticalVariantProduct(
  cartProduct: CartProduct
): CartProduct {
  if (!cartProduct.variants || cartProduct.variants.length === 0) {
    return cartProduct;
  }

  return {
    ...cartProduct,
    variants: cartProduct.variants.map((variant) => ({
      ...variant,
      attributes: normalizeCriticalVariantAttributes(variant.attributes),
    })),
  };
}

export function getVariantAxesWithMultipleOptions(variants: ProductVariant[]) {
  const axisValues: Record<string, Set<string>> = {};

  const addAxisValue = (rawAxis: string, value: string | null | undefined) => {
    const axis = canonicalizeVariantAxis(rawAxis);
    const trimmedValue = value?.trim();

    if (!axis || !trimmedValue) {
      return;
    }

    if (!axisValues[axis]) {
      axisValues[axis] = new Set<string>();
    }

    axisValues[axis].add(trimmedValue);
  };

  for (const variant of variants) {
    addAxisValue('condition', variant.condition);

    for (const [rawAxis, value] of Object.entries(variant.attributes || {})) {
      addAxisValue(rawAxis, value);
    }
  }

  return Object.entries(axisValues)
    .filter(([, values]) => values.size > 1)
    .map(([axis]) => axis);
}

export function pickInitialSelectedAttributes({
  explicitAttributes,
  renderableVariantAxes,
  selection,
}: {
  explicitAttributes?: Record<string, string>;
  renderableVariantAxes: string[];
  selection: ResolvedCriticalVariantSelection | null;
}) {
  if (!selection) {
    return {};
  }

  const normalizedExplicitAttributes =
    normalizeCriticalVariantAttributes(explicitAttributes);
  const normalizedSelectionAttributes = normalizeCriticalVariantAttributes(
    selection.attributes
  );
  const normalizedSelectionCondition = selection.condition?.trim();
  if (normalizedSelectionCondition) {
    normalizedSelectionAttributes.condition = normalizedSelectionCondition;
  }
  const selectableAxes = new Set([
    ...renderableVariantAxes.map(canonicalizeVariantAxis).filter(Boolean),
    ...Object.keys(normalizedExplicitAttributes),
  ]);

  return Object.fromEntries(
    Object.entries(normalizedSelectionAttributes).filter(([axis]) =>
      selectableAxes.has(axis)
    )
  );
}
