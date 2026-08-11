import { shouldIncludeProductSchemaSpec } from '@/lib/product-schema-specs';
import { getKeySpecCategoriesForFamily } from '@/lib/storefront-specs/spec-category-families';
import type {
  ComparableProductKeySpecs,
  ProductSpecFamily,
  SpecField,
} from '@/lib/storefront-specs/spec-taxonomy';
import { getProductSpecFamily } from '@/lib/storefront-specs/spec-taxonomy';
import { normalizeSpecValueText } from '@/lib/storefront-specs/spec-value-normalization';

const METADATA_SPEC_KEYS = new Set([
  'id',
  'product_id',
  'merchant_id',
  'created_at',
  'updated_at',
  'deleted_at',
]);
const FAMILY_CONTEXT_SPEC_LABELS: Record<
  ProductSpecFamily,
  Record<string, string>
> = {
  mobile: {
    has_ois: 'OIS',
    announced_date: 'Announced',
    release_date: 'Release date',
    recommended_for: 'Recommended for',
  },
  computer: {
    processor: 'Processor',
  },
  camera: {
    has_ois: 'OIS',
  },
  general: {
    format: 'Format',
    platform: 'Platform',
  },
};
function normalizeText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeSpecValue(value: unknown): string | null {
  if (Array.isArray(value)) {
    const normalizedItems = value
      .map((item) => normalizeSpecValue(item))
      .filter((item): item is string => Boolean(item));
    return normalizedItems.length > 0 ? normalizedItems.join(', ') : null;
  }

  const normalized = normalizeSpecValueText(value);
  return normalized || null;
}

function humanizeSpecKey(key: string) {
  const normalizedKey = key.toLowerCase();
  const exactLabels: Record<string, string> = {
    battery_mah: 'battery',
    display_resolution: 'display resolution',
    main_camera_mp: 'main camera',
    ram_gb: 'RAM',
    storage_gb: 'storage',
  };

  if (normalizedKey in exactLabels) {
    return exactLabels[normalizedKey];
  }

  return key
    .replace(/[_-]+/g, ' ')
    .replace(/\bgb\b/gi, 'GB')
    .replace(/\bmp\b/gi, 'MP')
    .trim();
}

export function buildProductContextSpecFacts(
  productKeySpecs: Record<string, unknown> | null | undefined,
  categoryName: string
) {
  if (!productKeySpecs) return [];

  const comparableSpecs = productKeySpecs as ComparableProductKeySpecs;
  const family = getProductSpecFamily(categoryName);
  const orderedFields = getKeySpecCategoriesForFamily(
    family,
    categoryName
  ).flatMap((category) => category.fields);
  const fieldsByKey = new Map<string, SpecField>(
    orderedFields.map((field) => [field.key, field])
  );
  const fieldPriorityByKey = new Map(
    orderedFields.map((field, index) => [field.key, index])
  );

  return Object.entries(productKeySpecs)
    .flatMap(([key, value]) => {
      if (METADATA_SPEC_KEYS.has(key)) return [];

      const field = fieldsByKey.get(key);
      const contextLabel = FAMILY_CONTEXT_SPEC_LABELS[family][key];
      if (!field && !contextLabel) {
        return [];
      }
      if (field?.condition && !field.condition(comparableSpecs)) return [];
      if (
        !shouldIncludeProductSchemaSpec(
          {
            category: categoryName,
            categories: null,
            product_key_specs: comparableSpecs,
          },
          { key, value }
        )
      ) {
        return [];
      }

      const scalarValue = normalizeSpecValue(value);
      if (!scalarValue) return [];

      const normalized = field?.transform
        ? normalizeText(field.transform(value, comparableSpecs))
        : scalarValue;
      if (!normalized) return [];

      const label =
        field?.dynamicLabel?.(comparableSpecs) ||
        field?.label ||
        contextLabel ||
        humanizeSpecKey(key);
      return [
        {
          key,
          priority: fieldPriorityByKey.get(key) ?? Number.MAX_SAFE_INTEGER,
          text: `${label}: ${normalized}`,
        },
      ];
    })
    .toSorted((left, right) =>
      left.priority === right.priority
        ? left.key.localeCompare(right.key)
        : left.priority - right.priority
    )
    .slice(0, 5)
    .map((fact) => fact.text);
}
