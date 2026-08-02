import { getKeySpecCategoriesForFamily } from './spec-category-families';
import type { ProductSpecSection } from './spec-data';
import type {
  ComparableProductKeySpecs,
  ProductSpecFamily,
} from './spec-taxonomy';

const UNSUPPORTED_PLACEHOLDER_VALUES = new Set([
  '',
  '0',
  'false',
  'n/a',
  'na',
  'none',
  'not applicable',
  'not available',
  'not listed',
  'not published',
  'not supported',
  'no',
  'unsupported',
  'unavailable',
]);

function isUnsupportedPlaceholderValue(value: unknown) {
  if (typeof value === 'boolean') return !value;
  if (typeof value === 'number') return !Number.isFinite(value) || value === 0;
  if (typeof value !== 'string') return false;

  const normalized = value.trim().toLowerCase();
  return (
    UNSUPPORTED_PLACEHOLDER_VALUES.has(normalized) ||
    normalized.startsWith('confirm exact')
  );
}

export function buildDetailedSpecsFromKeySpecs(
  keySpecs: ComparableProductKeySpecs,
  family: ProductSpecFamily,
  categoryName?: string
): ProductSpecSection[] {
  return getKeySpecCategoriesForFamily(family, categoryName)
    .map(({ category, fields }) => ({
      category,
      items: fields
        .filter(({ key, condition }) => {
          const value = keySpecs[key];
          return (
            value !== null &&
            value !== undefined &&
            (typeof value !== 'string' || value.trim().length > 0) &&
            ((family !== 'general' && family !== 'camera') ||
              !isUnsupportedPlaceholderValue(value)) &&
            (!condition || condition(keySpecs))
          );
        })
        .map((field) => {
          const value = keySpecs[field.key];
          return {
            label: field.dynamicLabel
              ? field.dynamicLabel(keySpecs)
              : field.label,
            value: field.transform
              ? field.transform(value, keySpecs)
              : String(value),
          };
        }),
    }))
    .filter((section) => section.items.length > 0);
}
