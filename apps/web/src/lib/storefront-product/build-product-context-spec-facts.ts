import { getKeySpecCategoriesForFamily } from '@/lib/storefront-specs/spec-category-families';
import type {
  ComparableProductKeySpecs,
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
const MOBILE_CONTEXT_SPEC_LABELS: Record<string, string> = {
  has_ois: 'OIS',
  announced_date: 'Announced',
  release_date: 'Release date',
  recommended_for: 'Recommended for',
};
const KNOWN_DEVICE_SPEC_FIELDS_BY_KEY = new Set(
  getKeySpecCategoriesForFamily('mobile')
    .flatMap((category) => category.fields)
    .map((field) => field.key)
);
const GENERIC_UNSUPPORTED_VALUES = new Set([
  '',
  'false',
  'no',
  'n/a',
  'na',
  'none',
  'not applicable',
  'not available',
  'not listed',
  'not published',
  'not supported',
  'unsupported',
  'unavailable',
]);

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

function isGenericUnsupportedValue(value: unknown) {
  if (typeof value === 'boolean') return !value;
  if (typeof value === 'number') return value === 0;
  if (typeof value !== 'string') return false;

  const normalized = value.trim().toLowerCase();
  return (
    GENERIC_UNSUPPORTED_VALUES.has(normalized) ||
    normalized.startsWith('not published') ||
    normalized.startsWith('not listed') ||
    normalized.startsWith('confirm exact')
  );
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
  const fieldsByKey = new Map<string, SpecField>(
    getKeySpecCategoriesForFamily(family, categoryName)
      .flatMap((category) => category.fields)
      .map((field) => [field.key, field])
  );

  return Object.entries(productKeySpecs)
    .flatMap(([key, value]) => {
      if (METADATA_SPEC_KEYS.has(key)) return [];

      const field = fieldsByKey.get(key);
      const contextLabel =
        family === 'mobile' ? MOBILE_CONTEXT_SPEC_LABELS[key] : undefined;
      if (
        !field &&
        !contextLabel &&
        (family !== 'general' || KNOWN_DEVICE_SPEC_FIELDS_BY_KEY.has(key))
      ) {
        return [];
      }
      if (field?.condition && !field.condition(comparableSpecs)) return [];
      if (family === 'general' && isGenericUnsupportedValue(value)) return [];

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
      return [`${label}: ${normalized}`];
    })
    .slice(0, 5);
}
