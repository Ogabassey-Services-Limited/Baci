import { shouldIncludeProductSchemaSpec } from '@/lib/product-schema-specs';
import type { ProductKeySpecs } from '@/lib/products';

interface ProductSpecAcceptanceInput {
  categories?: { name?: string | null; slug?: string | null } | null;
  category?: string | null;
  product_key_specs?: ProductKeySpecs | null;
}

const CATEGORY_AGNOSTIC_POSITIVE_MEASUREMENT_SPEC_KEYS = new Set([
  'front_camera_mp',
  'main_camera_mp',
]);

function isCategoryAgnosticPositiveMeasurement(
  input: ProductSpecAcceptanceInput,
  key: string,
  value: unknown
) {
  return (
    !input.categories?.name?.trim() &&
    !input.categories?.slug?.trim() &&
    !input.category?.trim() &&
    CATEGORY_AGNOSTIC_POSITIVE_MEASUREMENT_SPEC_KEYS.has(key) &&
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value > 0
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
      isCategoryAgnosticPositiveMeasurement(input, key, value)
  );
}
