import { stripHtmlTags } from '@/lib/sanitize-core';
import { getKeySpecCategoriesForFamily } from './spec-category-families';
import {
  type ComparableProductKeySpecs,
  getProductSpecFamily,
  type ProductSpecFamily,
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

const HTML_ENTITY_REPLACEMENTS: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
};

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

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&#(\d+);/g, (_match, code) =>
      String.fromCodePoint(Number.parseInt(code, 10))
    )
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) =>
      String.fromCodePoint(Number.parseInt(code, 16))
    )
    .replace(
      /&(amp|lt|gt|quot|nbsp|#39);/g,
      (match) => HTML_ENTITY_REPLACEMENTS[match] || match
    );
}

function normalizeSpecText(value: string) {
  return decodeHtmlEntities(stripHtmlTags(value)).replace(/\s+/g, ' ').trim();
}

function normalizeSpecTextValue(value: unknown) {
  if (typeof value === 'string') {
    return normalizeSpecText(value);
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  return '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function normalizeSpecItems(value: unknown): ProductSpecItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }

    const label = normalizeSpecTextValue(item.label);
    const itemValue = normalizeSpecTextValue(item.value);

    return label && itemValue ? [{ label, value: itemValue }] : [];
  });
}

function normalizeSpecSections(value: unknown): ProductSpecSection[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((section) => {
    if (!isRecord(section)) {
      return [];
    }

    const items = normalizeSpecItems(section.items);
    if (items.length === 0) {
      return [];
    }

    return [
      {
        category: normalizeSpecTextValue(section.category) || 'General',
        items,
      },
    ];
  });
}

function buildDescriptionKeySpecs(
  description: SpecDataSource['description']
): ProductSpecSection[] {
  if (!description?.includes('<table')) {
    return [];
  }

  const keySpecsHeadingIndex = description.search(
    /<h[1-6][^>]*>\s*Key Specs(?: at a Glance)?\s*<\/h[1-6]>/i
  );
  const tableSource =
    keySpecsHeadingIndex >= 0
      ? description.slice(keySpecsHeadingIndex)
      : description;
  const tableMatch = tableSource.match(/<table[\s\S]*?<\/table>/i);

  if (!tableMatch) {
    return [];
  }

  const items = [...tableMatch[0].matchAll(/<tr[\s\S]*?>([\s\S]*?)<\/tr>/gi)]
    .map((rowMatch) => {
      const cells = [
        ...rowMatch[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi),
      ]
        .map((cellMatch) => normalizeSpecText(cellMatch[1]))
        .filter(Boolean);

      if (cells.length < 2) {
        return null;
      }

      const [label, value] = cells;
      if (!label || !value || /^(feature|what you get)$/i.test(label)) {
        return null;
      }

      return { label, value };
    })
    .filter((item): item is ProductSpecItem => Boolean(item));

  if (items.length === 0) {
    return [];
  }

  return [{ category: 'Key Specs', items }];
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

function isComparableProductKeySpecs(
  value: SpecDataSource['product_key_specs']
): value is ComparableProductKeySpecs {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function buildDetailedSpecsFromKeySpecs(
  keySpecs: ComparableProductKeySpecs,
  family: ProductSpecFamily
): ProductSpecSection[] {
  return getKeySpecCategoriesForFamily(family)
    .map(({ category, fields }) => ({
      category,
      items: fields
        .filter(({ key, condition }) => {
          const value = keySpecs[key];
          return (
            value !== null &&
            value !== undefined &&
            (typeof value !== 'string' || value.trim().length > 0) &&
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
  const keySpecSections = isComparableProductKeySpecs(source.product_key_specs)
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
