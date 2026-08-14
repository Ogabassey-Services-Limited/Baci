import { shouldIncludeProductSchemaSpec } from '@/lib/product-schema-specs';
import type { ProductKeySpecs } from '@/lib/products';
import { isUnsupportedSpecValue } from '@/lib/storefront-specs/is-unsupported-spec-value';

interface ProductSpecAcceptanceInput {
  categories?: { name?: string | null; slug?: string | null } | null;
  category?: string | null;
  category_slug?: string | null;
  product_key_specs?: ProductKeySpecs | null;
}

const CATEGORY_AGNOSTIC_FEED_SPEC_KEYS = new Set([
  'display_resolution',
  'front_camera_mp',
  'main_camera_mp',
  'ram_gb',
  'screen_size_inches',
  'storage_gb',
  'weight_g',
]);

function hasResolvableFeedCategory(input: ProductSpecAcceptanceInput) {
  return Boolean(
    input.categories?.name?.trim() ||
      input.categories?.slug?.trim() ||
      input.category?.trim() ||
      input.category_slug?.trim()
  );
}

function isCategoryAgnosticFeedSpec(
  input: ProductSpecAcceptanceInput,
  key: string,
  value: unknown
) {
  if (hasResolvableFeedCategory(input)) {
    return false;
  }

  if (!CATEGORY_AGNOSTIC_FEED_SPEC_KEYS.has(key)) {
    return false;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0;
  }

  if ((key === 'ram_gb' || key === 'storage_gb') && typeof value === 'string') {
    return !isUnsupportedSpecValue(value);
  }

  if (key === 'display_resolution' && typeof value === 'string') {
    return !isUnsupportedSpecValue(value);
  }

  return false;
}

function isNeutralMerchandisingAttribute(key: string, value: unknown) {
  return (
    key === 'available_colors' &&
    typeof value === 'string' &&
    !isUnsupportedSpecValue(value)
  );
}

export function getFirstAcceptedSpecValue(
  input: ProductSpecAcceptanceInput,
  key: string,
  ...values: unknown[]
) {
  return values.find(
    (value) =>
      shouldIncludeProductSchemaSpec(input, { key, value }) ||
      isCategoryAgnosticFeedSpec(input, key, value) ||
      isNeutralMerchandisingAttribute(key, value)
  );
}
