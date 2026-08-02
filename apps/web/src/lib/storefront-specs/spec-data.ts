import {
  buildDescriptionKeySpecs,
  normalizeSpecItems,
  normalizeSpecSections,
} from './spec-data-normalization';
import { buildDetailedSpecsFromKeySpecs } from './spec-key-specs';
import {
  type ComparableProductKeySpecs,
  getProductSpecFamily,
  SUMMARY_SPEC_PRIORITIES,
} from './spec-taxonomy';
import type { VariantAttributeSource } from './variant-attributes';
import { normalizeVariantAttributes } from './variant-attributes';

export const MAX_SUMMARY_SPECS = 8;
export interface ProductSpecItem {
  label: string;
  value: string;
}

export interface ProductSpecSection {
  category: string;
  items: ProductSpecItem[];
}

interface SpecDataSource {
  brand?: string | null;
  categories?:
    | { name?: string | null; slug?: string | null }
    | Array<{ name?: string | null; slug?: string | null }>
    | null;
  category?: string | null;
  condition?: string | null;
  description?: string | null;
  detailedSpecs?: ProductSpecSection[] | null;
  displaySize?: string | null;
  product_key_specs?: ComparableProductKeySpecs | null;
  ram?: string | null;
  specs?: ProductSpecItem[] | string | null;
  specifications?: ProductSpecSection[] | null;
  storage?: string | string[] | null;
  variant_attributes?: VariantAttributeSource;
}

function getSourceCategoryName(source: SpecDataSource) {
  if (Array.isArray(source.categories)) {
    return source.categories[0]?.name || source.category || 'General';
  }

  return source.categories?.name || source.category || 'General';
}

function hasSourceCategory(source: SpecDataSource) {
  if (source.category?.trim()) {
    return true;
  }

  if (Array.isArray(source.categories)) {
    return Boolean(source.categories[0]?.name?.trim());
  }

  return Boolean(source.categories?.name?.trim());
}

function getFirstVariantValue(
  variantAttributes: SpecDataSource['variant_attributes'],
  key: string
) {
  const rawValue = normalizeVariantAttributes(variantAttributes)[key];
  if (Array.isArray(rawValue)) {
    return rawValue[0];
  }

  return rawValue || undefined;
}

function mergeSpecSections(...sections: ProductSpecSection[][]) {
  const merged: ProductSpecSection[] = [];

  for (const sectionGroup of sections) {
    for (const section of sectionGroup) {
      const existingSection = merged.find(
        (entry) => entry.category === section.category
      );

      if (!existingSection) {
        merged.push({
          category: section.category,
          items: [...section.items],
        });
        continue;
      }

      for (const item of section.items) {
        if (
          !existingSection.items.some((entry) => entry.label === item.label)
        ) {
          existingSection.items.push(item);
        }
      }
    }
  }

  return merged.filter((section) => section.items.length > 0);
}

function buildGeneralFallbackSpecs(
  source: SpecDataSource
): ProductSpecSection[] {
  const storageValue = Array.isArray(source.storage)
    ? source.storage[0]
    : source.storage ||
      getFirstVariantValue(source.variant_attributes, 'storage');
  const ramValue =
    source.ram || getFirstVariantValue(source.variant_attributes, 'ram');
  const simValue = getFirstVariantValue(source.variant_attributes, 'sim_type');
  const displayValue = source.displaySize;
  const items: ProductSpecItem[] = [
    { label: 'Brand', value: source.brand || 'Generic' },
    { label: 'Condition', value: source.condition || 'New' },
    {
      label: 'Category',
      value: getSourceCategoryName(source),
    },
  ];

  if (displayValue) {
    items.push({ label: 'Display', value: displayValue });
  }

  if (ramValue) {
    items.push({ label: 'RAM', value: ramValue });
  }

  if (storageValue) {
    items.push({ label: 'Storage', value: storageValue });
  }

  if (simValue) {
    items.push({ label: 'SIM', value: simValue });
  }

  return [{ category: 'General', items }];
}

function buildSummarySpecsFromSections(
  detailedSpecs: ProductSpecSection[]
): ProductSpecItem[] {
  const items: ProductSpecItem[] = [];

  for (const { label, candidates } of SUMMARY_SPEC_PRIORITIES) {
    for (const [categoryName, itemLabel] of candidates) {
      const section = detailedSpecs.find(
        (entry) => entry.category === categoryName
      );
      const item = section?.items.find((entry) => entry.label === itemLabel);
      if (item?.value) {
        items.push({ label, value: item.value });
        break;
      }
    }
  }

  return items.slice(0, MAX_SUMMARY_SPECS);
}

export function buildProductSpecData(source: SpecDataSource) {
  const descriptionKeySpecs = buildDescriptionKeySpecs(source.description);
  const normalizedDetailedSpecs = normalizeSpecSections(source.detailedSpecs);
  const normalizedLegacySpecifications = normalizeSpecSections(
    source.specifications
  );
  const sourceCategoryName = getSourceCategoryName(source);
  // Unknown categories fail closed instead of inheriting the phone taxonomy.
  // This prevents a missing category join from turning camera or accessory
  // rows into phone-shaped PDP content.
  const specFamily = hasSourceCategory(source)
    ? getProductSpecFamily(sourceCategoryName)
    : 'general';
  const keySpecSections =
    source.product_key_specs &&
    typeof source.product_key_specs === 'object' &&
    !Array.isArray(source.product_key_specs)
      ? buildDetailedSpecsFromKeySpecs(source.product_key_specs, specFamily)
      : [];

  const structuredSpecs =
    normalizedDetailedSpecs.length > 0
      ? normalizedDetailedSpecs
      : specFamily === 'camera' && normalizedLegacySpecifications.length > 0
        ? mergeSpecSections(normalizedLegacySpecifications, keySpecSections)
        : keySpecSections.length > 0
          ? keySpecSections
          : normalizedLegacySpecifications.length > 0
            ? normalizedLegacySpecifications
            : buildGeneralFallbackSpecs(source);

  const detailedSpecs = mergeSpecSections(descriptionKeySpecs, structuredSpecs);
  const normalizedSummarySpecs = normalizeSpecItems(source.specs);

  const specs =
    normalizedSummarySpecs.length > 0
      ? normalizedSummarySpecs
      : buildSummarySpecsFromSections(detailedSpecs);

  return {
    detailedSpecs,
    specs,
  };
}
