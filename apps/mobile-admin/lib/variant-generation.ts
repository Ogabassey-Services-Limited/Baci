import type { EditableProductCondition } from '@/lib/product-condition';
import {
  buildVariantAttributeRecord,
  createEmptyEditableVariant,
  createEmptyVariantAttribute,
  type EditableProductVariant,
} from '@/lib/product-variant-form';
import { isMetaAttributeKey } from './variant-attribute-display';

export interface VariantOptionValueDraft {
  id: string;
  value: string;
}

export interface VariantOptionDraft {
  id: string;
  name: string;
  values: VariantOptionValueDraft[];
}

export interface VariantGenerationDefaults {
  costPrice: number;
  images: string[];
  price: number;
}

// A phone with 5 colours × 4 storage × 3 conditions is already 60 rows; beyond
// this the on-device form stops being editable, so we refuse to generate.
export const MAX_GENERATED_VARIANTS = 100;

interface CleanOption {
  name: string;
  values: string[];
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const key = value.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(value);
    }
  }
  return result;
}

function cleanOptions(options: VariantOptionDraft[]): CleanOption[] {
  const merged = new Map<string, CleanOption>();

  for (const option of options) {
    const name = option.name.trim();
    const values = dedupeStrings(
      option.values.map((value) => value.value.trim()).filter(Boolean)
    );
    if (name.length === 0 || values.length === 0) {
      continue;
    }

    const key = name.toLowerCase();
    const existing = merged.get(key);
    if (existing) {
      existing.values = dedupeStrings([...existing.values, ...values]);
    } else {
      merged.set(key, { name, values });
    }
  }

  return Array.from(merged.values());
}

/**
 * Number of variants a given option/condition selection would produce. Used to
 * preview the result and to gate generation behind {@link MAX_GENERATED_VARIANTS}.
 */
export function countVariantCombinations(
  options: VariantOptionDraft[],
  conditions: EditableProductCondition[]
): number {
  const cleaned = cleanOptions(options);
  const optionProduct = cleaned.reduce(
    (total, option) => total * option.values.length,
    1
  );
  const conditionFactor = conditions.length > 0 ? conditions.length : 1;

  // No options and no conditions means there is nothing to build.
  if (cleaned.length === 0 && conditions.length === 0) {
    return 0;
  }

  return optionProduct * conditionFactor;
}

/**
 * Expand option groups (Colour, Storage, …) and optional conditions into the
 * cartesian product of concrete variants, each seeded with default pricing.
 */
export function buildVariantsFromOptions(params: {
  conditions: EditableProductCondition[];
  defaults: VariantGenerationDefaults;
  options: VariantOptionDraft[];
}): EditableProductVariant[] {
  const cleaned = cleanOptions(params.options);

  let attributeCombos: Array<Array<{ key: string; value: string }>> = [[]];
  for (const option of cleaned) {
    attributeCombos = attributeCombos.flatMap((combo) =>
      option.values.map((value) => [...combo, { key: option.name, value }])
    );
  }

  const conditionList: Array<EditableProductCondition | undefined> =
    params.conditions.length > 0 ? params.conditions : [undefined];

  const variants: EditableProductVariant[] = [];
  for (const combo of attributeCombos) {
    for (const condition of conditionList) {
      // Skip the fully-empty variant (no attributes and no condition).
      if (combo.length === 0 && !condition) {
        continue;
      }

      const base = createEmptyEditableVariant({
        condition,
        costPrice: params.defaults.costPrice,
        images: params.defaults.images,
        price: params.defaults.price,
      });

      variants.push({
        ...base,
        // Fresh attribute objects per variant so ids stay unique and edits to
        // one variant never mutate a shared reference in another.
        attributes: combo.map((attribute) =>
          createEmptyVariantAttribute(attribute.key, attribute.value)
        ),
      });
    }
  }

  return variants;
}

/**
 * Stable identity for a variant based on its condition + human attribute
 * values, used to skip duplicates when merging generated variants into an
 * existing set. Machine attributes (e.g. color_hex) are excluded so a
 * builder-generated "Red" still matches a web-created "Red" that carries a hex.
 */
export function getVariantSignature(variant: {
  attributes: Array<{ key: string; value: string }>;
  condition?: EditableProductCondition;
}): string {
  const record = buildVariantAttributeRecord(variant.attributes);
  const attributePart = Object.entries(record)
    .filter(([key]) => !isMetaAttributeKey(key))
    .map(([key, value]) => `${key.toLowerCase()}=${value.toLowerCase()}`)
    .sort()
    .join('|');

  return `${(variant.condition ?? '').toLowerCase()}::${attributePart}`;
}

/**
 * A variant the user has not meaningfully filled in yet — e.g. the blank row
 * created by toggling "has variants" on. These are replaced when generating.
 * When `defaults` is provided, a price/cost the merchant changed away from the
 * defaults also counts as "touched", so a hand-priced row is never discarded.
 */
export function isPlaceholderVariant(
  variant: EditableProductVariant,
  defaults?: { costPrice: number; price: number }
): boolean {
  const hasAttributes =
    Object.keys(buildVariantAttributeRecord(variant.attributes)).length > 0;
  const priceCustomized = defaults
    ? variant.price !== defaults.price ||
      variant.cost_price !== defaults.costPrice
    : false;

  return (
    !hasAttributes &&
    !variant.condition &&
    variant.sku.trim() === '' &&
    variant.stock_quantity === 0 &&
    !priceCustomized
  );
}

/**
 * Merge freshly generated variants into the existing set: drop untouched
 * placeholder rows, then append only the generated variants whose identity is
 * not already present. `defaults` protects a hand-priced blank row from being
 * dropped as a placeholder.
 */
export function mergeGeneratedVariants(
  existing: EditableProductVariant[],
  generated: EditableProductVariant[],
  defaults?: { costPrice: number; price: number }
): EditableProductVariant[] {
  const kept = existing.filter(
    (variant) => !isPlaceholderVariant(variant, defaults)
  );
  const seen = new Set(kept.map(getVariantSignature));

  const additions: EditableProductVariant[] = [];
  for (const variant of generated) {
    const signature = getVariantSignature(variant);
    if (seen.has(signature)) {
      continue;
    }
    seen.add(signature);
    additions.push(variant);
  }

  return [...kept, ...additions];
}
