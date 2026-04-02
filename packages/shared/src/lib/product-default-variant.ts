export interface ProductDefaultVariantLike {
  id: string;
  attributes?: Record<string, string> | null;
  compare_at_price?: number | null;
  in_stock?: boolean | null;
  price?: number | null;
  price_modifier?: number | null;
  price_override?: number | null;
  stock_quantity?: number | null;
}

export interface ProductWithDefaultVariantLike<
  TVariant extends ProductDefaultVariantLike = ProductDefaultVariantLike,
> {
  compare_at_price?: number | null;
  manage_stock?: boolean | null;
  price: number;
  variants?: TVariant[] | null;
}

export interface ResolvedProductVariantSelection<
  TVariant extends ProductDefaultVariantLike = ProductDefaultVariantLike,
> {
  attributes: Record<string, string>;
  color?: string;
  compareAtPrice?: number;
  price: number;
  storage?: string;
  variant: TVariant;
}

interface VariantCandidate<TVariant extends ProductDefaultVariantLike> {
  index: number;
  variant: TVariant;
}

function normalizeAttributeValue(value: string | null | undefined) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeSelectedAttributes(
  attributes: Record<string, string | null | undefined> | null | undefined
) {
  const normalized: Record<string, string> = {};

  for (const [key, value] of Object.entries(attributes || {})) {
    const normalizedValue = normalizeAttributeValue(value);
    if (!normalizedValue) {
      continue;
    }

    normalized[key] = normalizedValue;
  }

  return normalized;
}

function getVariantPrice(
  basePrice: number,
  variant: ProductDefaultVariantLike
): number {
  if (typeof variant.price_override === 'number') {
    return variant.price_override;
  }

  if (typeof variant.price === 'number') {
    return variant.price;
  }

  if (typeof variant.price_modifier === 'number') {
    return Math.max(0, basePrice + variant.price_modifier);
  }

  return basePrice;
}

function isVariantPurchasable(
  manageStock: boolean | null | undefined,
  variant: ProductDefaultVariantLike
) {
  if (manageStock === false) {
    return true;
  }

  if (typeof variant.stock_quantity === 'number') {
    return variant.stock_quantity > 0;
  }

  if (typeof variant.in_stock === 'boolean') {
    return variant.in_stock;
  }

  return true;
}

function sortByDefaultPreference<TVariant extends ProductDefaultVariantLike>(
  basePrice: number,
  candidates: VariantCandidate<TVariant>[]
) {
  return [...candidates].sort((left, right) => {
    const leftPrice = getVariantPrice(basePrice, left.variant);
    const rightPrice = getVariantPrice(basePrice, right.variant);

    if (leftPrice !== rightPrice) {
      return leftPrice - rightPrice;
    }

    return left.index - right.index;
  });
}

function toResolvedSelection<TVariant extends ProductDefaultVariantLike>(
  product: ProductWithDefaultVariantLike<TVariant>,
  variant: TVariant
): ResolvedProductVariantSelection<TVariant> {
  const attributes = normalizeSelectedAttributes(variant.attributes);
  const storage = normalizeAttributeValue(attributes.storage);
  const color = normalizeAttributeValue(attributes.color);

  return {
    variant,
    attributes,
    storage: storage || undefined,
    color: color || undefined,
    price: getVariantPrice(product.price, variant),
    compareAtPrice:
      typeof variant.compare_at_price === 'number'
        ? variant.compare_at_price
        : typeof product.compare_at_price === 'number'
          ? product.compare_at_price
          : undefined,
  };
}

export function resolveDefaultVariantSelection<
  TVariant extends ProductDefaultVariantLike,
>(product: ProductWithDefaultVariantLike<TVariant>) {
  const variants = product.variants || [];
  if (variants.length === 0) {
    return null;
  }

  const purchasableVariants = variants
    .map((variant, index) => ({ variant, index }))
    .filter(({ variant }) => isVariantPurchasable(product.manage_stock, variant));

  if (purchasableVariants.length === 0) {
    return null;
  }

  const [defaultVariant] = sortByDefaultPreference(
    product.price,
    purchasableVariants
  );

  return defaultVariant
    ? toResolvedSelection(product, defaultVariant.variant)
    : null;
}

export function resolveVariantSelection<
  TVariant extends ProductDefaultVariantLike,
>(
  product: ProductWithDefaultVariantLike<TVariant>,
  options: {
    attributes?: Record<string, string | null | undefined> | null;
    variantId?: string | null;
  }
) {
  const variants = product.variants || [];
  if (variants.length === 0) {
    return null;
  }

  const normalizedAttributes = normalizeSelectedAttributes(options.attributes);
  const attributeKeys = Object.keys(normalizedAttributes);
  const purchasableVariants = variants
    .map((variant, index) => ({ variant, index }))
    .filter(({ variant }) => isVariantPurchasable(product.manage_stock, variant));

  if (purchasableVariants.length === 0) {
    return null;
  }

  if (attributeKeys.length > 0) {
    const matchingVariants = purchasableVariants.filter(({ variant }) => {
      const variantAttributes = normalizeSelectedAttributes(variant.attributes);

      return attributeKeys.every(
        (key) => variantAttributes[key] === normalizedAttributes[key]
      );
    });

    if (matchingVariants.length === 0) {
      return null;
    }

    const exactVariant = matchingVariants.find(
      ({ variant }) => options.variantId && variant.id === options.variantId
    );

    if (exactVariant) {
      return toResolvedSelection(product, exactVariant.variant);
    }

    return toResolvedSelection(
      product,
      sortByDefaultPreference(product.price, matchingVariants)[0].variant
    );
  }

  if (options.variantId) {
    const variant = purchasableVariants.find(
      ({ variant: candidate }) => candidate.id === options.variantId
    );

    if (variant) {
      return toResolvedSelection(product, variant.variant);
    }
  }

  return null;
}
