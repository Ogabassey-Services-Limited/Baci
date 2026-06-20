import type { Product as CartProduct, ProductVariant } from '@/lib/products';

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

  const variantImage = selection.variant.images?.[0];

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

export function getVariantAxesWithMultipleOptions(variants: ProductVariant[]) {
  const axisValues: Record<string, Set<string>> = {};

  for (const variant of variants) {
    for (const [axis, value] of Object.entries(variant.attributes || {})) {
      if (!value) {
        continue;
      }

      if (!axisValues[axis]) {
        axisValues[axis] = new Set<string>();
      }

      axisValues[axis].add(value);
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

  const selectableAxes = new Set([
    ...renderableVariantAxes,
    ...Object.keys(explicitAttributes || {}),
  ]);

  return Object.fromEntries(
    Object.entries(selection.attributes).filter(([axis]) =>
      selectableAxes.has(axis)
    )
  );
}
