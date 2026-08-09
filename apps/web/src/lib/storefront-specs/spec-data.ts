import { shouldIncludeProductSchemaSpec } from '@/lib/product-schema-specs';
import { resolveStorefrontProductCategoryName } from '@/lib/storefront-product-category-precedence';
import { buildDescriptionKeySpecs } from './build-description-key-specs';
import { normalizeSpecItems } from './normalize-spec-items';
import { normalizeSpecSections } from './normalize-spec-sections';
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
      value: categoryName,
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

  const structuredSpecs =
    detailedSpecifications.length > 0
      ? detailedSpecifications
      : specFamily === 'camera' && legacySpecifications.length > 0
        ? mergeSpecSections(legacySpecifications, keySpecSections)
        : keySpecSections.length > 0
          ? keySpecSections
          : legacySpecifications.length > 0
            ? legacySpecifications
            : buildGeneralFallbackSpecs(source, sourceCategoryName);

  const detailedSpecs = mergeSpecSections(
    descriptionSpecifications,
    structuredSpecs
  );
  const normalizedSummarySpecs = normalizeSpecItems(source.specs);
  const summarySpecifications =
    specFamily === 'camera' || specFamily === 'general'
      ? filterNonDeviceSpecItems(normalizedSummarySpecs, sourceCategoryName)
      : normalizedSummarySpecs;

  const specs =
    summarySpecifications.length > 0
      ? summarySpecifications
      : buildSummarySpecsFromSections(detailedSpecs);

  return {
    detailedSpecs,
    specs,
  };
}
