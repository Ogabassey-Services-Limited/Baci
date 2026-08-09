import { shouldIncludeProductSchemaSpec } from '@/lib/product-schema-specs';
import { resolveStorefrontProductCategoryName } from '@/lib/storefront-product-category-precedence';
import { buildDescriptionKeySpecs } from './build-description-key-specs';
import { dedupeSpecItems } from './dedupe-spec-items';
import { normalizeSpecItems } from './normalize-spec-items';
import { normalizeSpecSections } from './normalize-spec-sections';
import { buildDetailedSpecsFromKeySpecs } from './spec-key-specs';
import {
  type ComparableProductKeySpecs,
  getProductSpecFamily,
  SUMMARY_SPEC_PRIORITIES,
} from './spec-taxonomy';
import { normalizeSpecValueText } from './spec-value-normalization';
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

function resolveSourceCategory(source: SpecDataSource) {
  const relation = Array.isArray(source.categories)
    ? source.categories.find(
        (category) => category.name?.trim() || category.slug?.trim()
      )
    : source.categories;
  const name = resolveStorefrontProductCategoryName({
    categories: relation,
    category: source.category,
  });

  return { hasCategory: Boolean(name), name: name || 'General' };
}

function getVariantValue(
  variantAttributes: SpecDataSource['variant_attributes'],
  key: string
) {
  return normalizeVariantAttributes(variantAttributes)[key];
}

function getFirstSupportedFallbackValue(...values: unknown[]) {
  const [item] = dedupeSpecItems(
    values
      .flatMap((value) => (Array.isArray(value) ? value : [value]))
      .map((value) => ({
        label: 'Fallback value',
        value: normalizeSpecValueText(value),
      })),
    { omitUnsupportedValues: true }
  );

  return item?.value;
}

function mergeSpecSections(...sections: ProductSpecSection[][]) {
  const merged: ProductSpecSection[] = [];
  const visibleItems: ProductSpecItem[] = [];

  for (const sectionGroup of sections) {
    for (const section of sectionGroup) {
      let existingSection = merged.find(
        (entry) => entry.category === section.category
      );

      if (!existingSection) {
        existingSection = {
          category: section.category,
          items: [],
        };
        merged.push(existingSection);
      }

      for (const item of dedupeSpecItems(section.items)) {
        if (
          dedupeSpecItems([...visibleItems, item]).length > visibleItems.length
        ) {
          visibleItems.push(item);
          existingSection.items.push(item);
        }
      }
    }
  }

  return merged.filter((section) => section.items.length > 0);
}

function filterNonDeviceSpecItems(
  items: ProductSpecItem[],
  categoryName: string
) {
  return items.filter((item) =>
    shouldIncludeProductSchemaSpec(
      { category: categoryName, categories: null },
      { label: item.label, value: item.value }
    )
  );
}

function filterNonDeviceLegacySpecifications(
  sections: ProductSpecSection[],
  categoryName: string
) {
  return sections.flatMap((section) => {
    const items = filterNonDeviceSpecItems(section.items, categoryName);

    return items.length > 0 ? [{ ...section, items }] : [];
  });
}

function buildGeneralFallbackSpecs(
  source: SpecDataSource,
  categoryName: string
): ProductSpecSection[] {
  const storageValue = getFirstSupportedFallbackValue(
    source.storage,
    getVariantValue(source.variant_attributes, 'storage')
  );
  const ramValue = getFirstSupportedFallbackValue(
    source.ram,
    getVariantValue(source.variant_attributes, 'ram')
  );
  const simValue = getFirstSupportedFallbackValue(
    getVariantValue(source.variant_attributes, 'sim_type')
  );
  const displayValue = getFirstSupportedFallbackValue(source.displaySize);
  const items = dedupeSpecItems(
    [
      {
        label: 'Brand',
        value:
          getFirstSupportedFallbackValue(source.brand, 'Generic') || 'Generic',
      },
      {
        label: 'Condition',
        value: getFirstSupportedFallbackValue(source.condition, 'New') || 'New',
      },
      {
        label: 'Category',
        value:
          getFirstSupportedFallbackValue(categoryName, 'General') || 'General',
      },
      ...(displayValue ? [{ label: 'Display', value: displayValue }] : []),
      ...(ramValue ? [{ label: 'RAM', value: ramValue }] : []),
      ...(storageValue ? [{ label: 'Storage', value: storageValue }] : []),
      ...(simValue ? [{ label: 'SIM', value: simValue }] : []),
    ],
    { omitUnsupportedValues: true }
  );

  return filterNonDeviceLegacySpecifications(
    [{ category: 'General', items }],
    categoryName
  );
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
  const { hasCategory: hasSourceCategory, name: sourceCategoryName } =
    resolveSourceCategory(source);
  // Unknown categories fail closed instead of inheriting the phone taxonomy.
  // This prevents a missing category join from turning camera or accessory
  // rows into phone-shaped PDP content.
  const specFamily = hasSourceCategory
    ? getProductSpecFamily(sourceCategoryName)
    : 'general';
  const keySpecSections =
    source.product_key_specs &&
    typeof source.product_key_specs === 'object' &&
    !Array.isArray(source.product_key_specs)
      ? buildDetailedSpecsFromKeySpecs(
          source.product_key_specs,
          specFamily,
          hasSourceCategory ? sourceCategoryName : undefined
        )
      : [];

  const detailedSpecifications =
    specFamily === 'camera' || specFamily === 'general'
      ? filterNonDeviceLegacySpecifications(
          normalizedDetailedSpecs,
          sourceCategoryName
        )
      : normalizedDetailedSpecs;
  const legacySpecifications =
    specFamily === 'camera' || specFamily === 'general'
      ? filterNonDeviceLegacySpecifications(
          normalizedLegacySpecifications,
          sourceCategoryName
        )
      : normalizedLegacySpecifications;
  const descriptionSpecifications =
    specFamily === 'camera' || specFamily === 'general'
      ? filterNonDeviceLegacySpecifications(
          descriptionKeySpecs,
          sourceCategoryName
        )
      : descriptionKeySpecs;

  const storedSpecifications = mergeSpecSections(
    detailedSpecifications,
    legacySpecifications
  );
  const usesGeneralFallback =
    storedSpecifications.length === 0 && keySpecSections.length === 0;
  const structuredSpecs =
    storedSpecifications.length > 0
      ? mergeSpecSections(storedSpecifications, keySpecSections)
      : keySpecSections.length > 0
        ? keySpecSections
        : buildGeneralFallbackSpecs(source, sourceCategoryName);

  const detailedSpecs = usesGeneralFallback
    ? mergeSpecSections(descriptionSpecifications, structuredSpecs)
    : mergeSpecSections(structuredSpecs, descriptionSpecifications);
  const normalizedSummarySpecs = normalizeSpecItems(source.specs);
  const summarySpecifications =
    specFamily === 'camera' || specFamily === 'general'
      ? filterNonDeviceSpecItems(normalizedSummarySpecs, sourceCategoryName)
      : normalizedSummarySpecs;

  const specs = dedupeSpecItems([
    ...summarySpecifications,
    ...buildSummarySpecsFromSections(detailedSpecs),
  ]);

  return {
    detailedSpecs,
    specs,
  };
}
