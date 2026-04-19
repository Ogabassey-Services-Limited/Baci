import {
  normalizeVariantAttributes,
  type VariantAttributeSource,
} from './variant-attributes';
import { stripHtmlTags } from '@/lib/sanitize-core';
import type {
  ProductSpecItem,
  ProductSpecSection,
} from './types';

interface ComparableProductKeySpecs {
  [key: string]: unknown;
  android_version?: string;
  battery_removable?: boolean;
  card_slot_type?: string;
  has_card_slot?: boolean;
  has_dual_camera?: boolean;
  has_quad_camera?: boolean;
  has_reverse_charging?: boolean;
  has_triple_camera?: boolean;
  has_usb_otg?: boolean;
  has_wireless_charging?: boolean;
  wireless_charging_watt?: number;
}

interface SpecDataSource {
  brand?: string | null;
  categories?:
    | { name?: string | null }
    | Array<{ name?: string | null }>
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

interface SpecField {
  key: string;
  label: string;
  dynamicLabel?: (specs: ComparableProductKeySpecs) => string;
  transform?: (value: unknown, allSpecs: ComparableProductKeySpecs) => string;
  condition?: (specs: ComparableProductKeySpecs) => boolean;
}

interface SpecCategory {
  category: string;
  fields: SpecField[];
}

const KEY_SPEC_CATEGORIES: SpecCategory[] = [
  {
    category: 'Network',
    fields: [
      { key: 'network_technology', label: 'Technology' },
      { key: 'has_5g', label: '5G Support', transform: (v: unknown) => (v ? 'Yes' : 'No') },
    ],
  },
  {
    category: 'Body',
    fields: [
      { key: 'dimensions_mm', label: 'Dimensions' },
      { key: 'weight_g', label: 'Weight', transform: (v: unknown) => `${v}g` },
      { key: 'build_materials', label: 'Build' },
      { key: 'sim_type', label: 'SIM' },
      { key: 'ip_rating', label: 'Protection' },
    ],
  },
  {
    category: 'Display',
    fields: [
      { key: 'display_type', label: 'Type' },
      { key: 'screen_size_inches', label: 'Size', transform: (v: unknown) => `${v} inches` },
      { key: 'display_resolution', label: 'Resolution' },
      { key: 'refresh_rate_hz', label: 'Refresh Rate', transform: (v: unknown) => `${v}Hz` },
      { key: 'display_ppi', label: 'Pixel Density', transform: (v: unknown) => `${v} ppi` },
      { key: 'display_peak_brightness', label: 'Peak Brightness', transform: (v: unknown) => `${v} nits` },
      { key: 'display_protection', label: 'Protection' },
    ],
  },
  {
    category: 'Platform',
    fields: [
      { key: 'android_version', label: 'OS', transform: (v: unknown) => `Android ${v}` },
      { key: 'chipset', label: 'Chipset' },
      { key: 'cpu_cores', label: 'CPU' },
      { key: 'gpu', label: 'GPU' },
    ],
  },
  {
    category: 'Memory',
    fields: [
      {
        key: 'has_card_slot',
        label: 'Card Slot',
        transform: (_v: unknown, allSpecs: ComparableProductKeySpecs) =>
          allSpecs.has_card_slot ? allSpecs.card_slot_type || 'Yes' : 'No',
      },
      { key: 'storage_gb', label: 'Internal Storage', transform: (v: unknown) => `${v}GB` },
      { key: 'ram_gb', label: 'RAM', transform: (v: unknown) => `${v}GB` },
    ],
  },
  {
    category: 'Main Camera',
    fields: [
      {
        key: 'main_camera_mp',
        label: 'Camera',
        dynamicLabel: (allSpecs: ComparableProductKeySpecs) =>
          allSpecs.has_quad_camera
            ? 'Quad Camera'
            : allSpecs.has_triple_camera
              ? 'Triple Camera'
              : allSpecs.has_dual_camera
                ? 'Dual Camera'
                : 'Single Camera',
        transform: (v: unknown) => `${v}MP`,
      },
      { key: 'rear_camera_features', label: 'Features' },
      { key: 'rear_camera_video', label: 'Video' },
    ],
  },
  {
    category: 'Selfie Camera',
    fields: [
      { key: 'front_camera_mp', label: 'Resolution', transform: (v: unknown) => `${v}MP` },
      { key: 'front_camera_features', label: 'Features' },
      { key: 'front_camera_video', label: 'Video' },
    ],
  },
  {
    category: 'Sound',
    fields: [
      {
        key: 'has_stereo_speakers',
        label: 'Loudspeaker',
        transform: (v: unknown) => (v ? 'Yes, with stereo speakers' : 'Yes (mono)'),
      },
      {
        key: 'has_headphone_jack',
        label: '3.5mm Jack',
        transform: (v: unknown) => (v ? 'Yes' : 'No'),
      },
    ],
  },
  {
    category: 'Connectivity',
    fields: [
      { key: 'wifi_bands', label: 'WLAN' },
      { key: 'bluetooth_version', label: 'Bluetooth' },
      { key: 'positioning', label: 'Positioning' },
      { key: 'has_nfc', label: 'NFC', transform: (v: unknown) => (v ? 'Yes' : 'No') },
      { key: 'has_fm_radio', label: 'Radio', transform: (v: unknown) => (v ? 'FM Radio' : 'No') },
      {
        key: 'usb_type',
        label: 'USB',
        transform: (v: unknown, allSpecs: ComparableProductKeySpecs) =>
          `${String(v)}${allSpecs.has_usb_otg ? ', OTG' : ''}`,
      },
    ],
  },
  {
    category: 'Features',
    fields: [
      { key: 'fingerprint_type', label: 'Fingerprint' },
      { key: 'sensors', label: 'Sensors' },
    ],
  },
  {
    category: 'Battery',
    fields: [
      {
        key: 'battery_mah',
        label: 'Capacity',
        transform: (v: unknown, allSpecs: ComparableProductKeySpecs) =>
          `${v}mAh${allSpecs.battery_removable ? ' (removable)' : ''}`,
      },
      { key: 'charging_watt', label: 'Wired Charging', transform: (v: unknown) => `${v}W` },
      {
        key: 'wireless_charging_watt',
        label: 'Wireless Charging',
        transform: (v: unknown) => `${v}W`,
        condition: (allSpecs: ComparableProductKeySpecs) =>
          Boolean(allSpecs.has_wireless_charging),
      },
      {
        key: 'has_reverse_charging',
        label: 'Reverse Charging',
        transform: () => 'Yes',
        condition: (allSpecs: ComparableProductKeySpecs) =>
          Boolean(allSpecs.has_reverse_charging),
      },
    ],
  },
  {
    category: 'Misc',
    fields: [
      { key: 'available_colors', label: 'Colors' },
      { key: 'model_numbers', label: 'Models' },
    ],
  },
];

const SUMMARY_SPEC_PRIORITIES = [
  {
    label: 'Display',
    candidates: [
      ['Key Specs', 'Display'],
      ['Key Specs', 'Screen'],
      ['Display', 'Size'],
      ['Display', 'Screen Size'],
      ['General', 'Display'],
    ],
  },
  {
    label: 'Processor',
    candidates: [['Key Specs', 'Processor'], ['Key Specs', 'Chipset'], ['Platform', 'Chipset']],
  },
  { label: 'RAM', candidates: [['Memory', 'RAM'], ['General', 'RAM']] },
  { label: 'Storage', candidates: [['Memory', 'Internal Storage'], ['General', 'Storage']] },
  {
    label: 'Camera',
    candidates: [
      ['Key Specs', 'Camera'],
      ['Main Camera', 'Quad Camera'],
      ['Main Camera', 'Triple Camera'],
      ['Main Camera', 'Dual Camera'],
      ['Main Camera', 'Single Camera'],
      ['General', 'Camera'],
    ],
  },
  { label: 'Battery', candidates: [['Key Specs', 'Battery'], ['Battery', 'Capacity'], ['General', 'Battery']] },
  { label: 'SIM', candidates: [['Body', 'SIM'], ['General', 'SIM']] },
  {
    label: 'OS',
    candidates: [['Key Specs', 'OS'], ['Key Specs', 'Operating System'], ['Platform', 'OS']],
  },
] as const;

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
  return decodeHtmlEntities(stripHtmlTags(value))
    .replace(/\s+/g, ' ')
    .trim();
}

function buildDescriptionKeySpecs(
  description: SpecDataSource['description']
): ProductSpecSection[] {
  if (!description || !description.includes('<table')) {
    return [];
  }

  const keySpecsHeadingIndex = description.search(
    /<h[1-6][^>]*>\s*Key Specs(?: at a Glance)?\s*<\/h[1-6]>/i
  );
  const tableSource =
    keySpecsHeadingIndex >= 0 ? description.slice(keySpecsHeadingIndex) : description;
  const tableMatch = tableSource.match(/<table[\s\S]*?<\/table>/i);

  if (!tableMatch) {
    return [];
  }

  const items = [...tableMatch[0].matchAll(/<tr[\s\S]*?>([\s\S]*?)<\/tr>/gi)]
    .map((rowMatch) => {
      const cells = [...rowMatch[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
        .map((cellMatch) => normalizeSpecText(cellMatch[1]))
        .filter(Boolean);

      if (cells.length < 2) {
        return null;
      }

      const [label, value] = cells;
      if (
        !label ||
        !value ||
        /^(feature|what you get)$/i.test(label)
      ) {
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
      const existingSection = merged.find((entry) => entry.category === section.category);

      if (!existingSection) {
        merged.push({
          category: section.category,
          items: [...section.items],
        });
        continue;
      }

      for (const item of section.items) {
        if (!existingSection.items.some((entry) => entry.label === item.label)) {
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
  keySpecs: ComparableProductKeySpecs
): ProductSpecSection[] {
  return KEY_SPEC_CATEGORIES.map(({ category, fields }) => ({
    category,
    items: fields
      .filter(({ key, condition }) => {
        const value = keySpecs[key];
        return (
          value !== null &&
          value !== undefined &&
          (!condition || condition(keySpecs))
        );
      })
      .map((field) => {
        const value = keySpecs[field.key];
        return {
          label: field.dynamicLabel ? field.dynamicLabel(keySpecs) : field.label,
          value: field.transform ? field.transform(value, keySpecs) : String(value),
        };
      }),
  })).filter((section) => section.items.length > 0);
}

function buildGeneralFallbackSpecs(source: SpecDataSource): ProductSpecSection[] {
  const storageValue = Array.isArray(source.storage)
    ? source.storage[0]
    : source.storage || getFirstVariantValue(source.variant_attributes, 'storage');
  const ramValue = source.ram || getFirstVariantValue(source.variant_attributes, 'ram');
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
      const section = detailedSpecs.find((entry) => entry.category === categoryName);
      const item = section?.items.find((entry) => entry.label === itemLabel);
      if (item?.value) {
        items.push({ label, value: item.value });
        break;
      }
    }
  }

  return items.slice(0, 8);
}

export function buildOgabasseyProductSpecData(source: SpecDataSource) {
  const descriptionKeySpecs = buildDescriptionKeySpecs(source.description);

  const structuredSpecs =
    source.detailedSpecs && source.detailedSpecs.length > 0
      ? source.detailedSpecs
      : isComparableProductKeySpecs(source.product_key_specs)
        ? buildDetailedSpecsFromKeySpecs(source.product_key_specs)
        : source.specifications && source.specifications.length > 0
          ? source.specifications
          : buildGeneralFallbackSpecs(source);

  const detailedSpecs = mergeSpecSections(
    descriptionKeySpecs,
    structuredSpecs
  );

  const specs =
    Array.isArray(source.specs) && source.specs.length > 0
      ? source.specs
      : buildSummarySpecsFromSections(detailedSpecs);

  return {
    detailedSpecs,
    specs,
  };
}
