import { shouldIncludeProductSchemaSpec } from '@/lib/product-schema-specs';
import type { ProductKeySpecs } from '@/lib/products';
import { stripHtmlTags } from '@/lib/sanitize-core';
import { escapeXml } from '@/lib/xml-utils';

interface ProductDetailInput {
  categories?: { name?: string | null; slug?: string | null } | null;
  category?: string | null;
  color?: string | null;
  product_key_specs?: ProductKeySpecs | null;
  variant_attributes?: Record<string, unknown> | null;
  weight_unit?: 'kg' | 'lb' | 'g' | 'oz' | null;
  weight_value?: number | null;
}

const CATEGORY_AGNOSTIC_POSITIVE_MEASUREMENT_SPEC_KEYS = new Set([
  'front_camera_mp',
  'main_camera_mp',
]);

function isCategoryAgnosticPositiveMeasurement(
  input: ProductDetailInput,
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

function getFirstAcceptedSpecValue(
  input: ProductDetailInput,
  key: string,
  ...values: unknown[]
) {
  return values.find(
    (value) =>
      shouldIncludeProductSchemaSpec(input, { key, value }) ||
      isCategoryAgnosticPositiveMeasurement(input, key, value)
  );
}

interface ProductDetail {
  attributeName: string;
  attributeValue: string;
  sectionName: string;
}

interface NormalizeTextOptions {
  formatNumber?: (value: number) => string;
}

function normalizeText(value: unknown, options?: NormalizeTextOptions) {
  const text =
    typeof value === 'string'
      ? value
      : typeof value === 'number' && Number.isFinite(value)
        ? (options?.formatNumber?.(value) ?? String(value))
        : '';

  return stripHtmlTags(text).replace(/\s+/g, ' ').trim();
}

function getVariantAttribute(
  input: ProductDetailInput,
  specKey: string,
  attributes: ProductDetailInput['variant_attributes'],
  aliases: string[],
  options?: NormalizeTextOptions
) {
  if (!attributes) {
    return undefined;
  }

  const normalizedAliases = new Set(
    aliases.map((alias) => alias.toLowerCase())
  );

  for (const [key, value] of Object.entries(attributes)) {
    if (!normalizedAliases.has(key.toLowerCase())) {
      continue;
    }

    const normalizedValue = normalizeText(value, options);
    if (
      normalizedValue &&
      shouldIncludeProductSchemaSpec(input, {
        key: specKey,
        value: normalizedValue,
      })
    ) {
      return normalizedValue;
    }
  }

  return undefined;
}

function formatGb(value: number) {
  if (value >= 1024 && value % 1024 === 0) {
    return `${value / 1024}TB`;
  }

  return `${value}GB`;
}

function formatPositiveGb(value: number) {
  return value > 0 ? formatGb(value) : '';
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function buildWeightLabel(input: ProductDetailInput) {
  const keySpecWeight = getFirstAcceptedSpecValue(
    input,
    'weight_g',
    input.product_key_specs?.weight_g
  );
  if (isPositiveFiniteNumber(keySpecWeight)) {
    return `${keySpecWeight}g`;
  }

  const shippingWeight = getFirstAcceptedSpecValue(
    input,
    'weight_g',
    input.weight_value
  );
  if (isPositiveFiniteNumber(shippingWeight) && input.weight_unit) {
    return `${shippingWeight}${input.weight_unit}`;
  }

  return undefined;
}

export function buildGoogleColorXml(input: ProductDetailInput) {
  const color = normalizeText(
    getFirstAcceptedSpecValue(
      input,
      'available_colors',
      getVariantAttribute(input, 'available_colors', input.variant_attributes, [
        'color',
        'colour',
      ]),
      input.color
    )
  );

  return color ? `        <g:color>${escapeXml(color)}</g:color>` : '';
}

export function buildGoogleProductDetailXml(input: ProductDetailInput) {
  const specs = input.product_key_specs ?? {};
  const screenSizeValue = getFirstAcceptedSpecValue(
    input,
    'screen_size_inches',
    specs.screen_size_inches
  );
  const screenSize = isPositiveFiniteNumber(screenSizeValue)
    ? `${screenSizeValue} inches`
    : undefined;
  const screenResolutionValue = getFirstAcceptedSpecValue(
    input,
    'display_resolution',
    specs.display_resolution
  );
  const screenResolution = normalizeText(screenResolutionValue);
  const ramValue = getFirstAcceptedSpecValue(
    input,
    'ram_gb',
    getVariantAttribute(
      input,
      'ram_gb',
      input.variant_attributes,
      ['ram', 'memory'],
      {
        formatNumber: formatPositiveGb,
      }
    ),
    specs.ram_gb
  );
  const ram = isPositiveFiniteNumber(ramValue)
    ? formatGb(ramValue)
    : normalizeText(ramValue);
  const storageValue = getFirstAcceptedSpecValue(
    input,
    'storage_gb',
    getVariantAttribute(
      input,
      'storage_gb',
      input.variant_attributes,
      ['storage', 'storage_capacity', 'rom'],
      {
        formatNumber: formatPositiveGb,
      }
    ),
    specs.storage_gb
  );
  const storage = isPositiveFiniteNumber(storageValue)
    ? formatGb(storageValue)
    : normalizeText(storageValue);
  const rearCameraValue = getFirstAcceptedSpecValue(
    input,
    'main_camera_mp',
    specs.main_camera_mp
  );
  const rearCamera = isPositiveFiniteNumber(rearCameraValue)
    ? `${rearCameraValue}MP`
    : undefined;
  const frontCameraValue = getFirstAcceptedSpecValue(
    input,
    'front_camera_mp',
    specs.front_camera_mp
  );
  const frontCamera = isPositiveFiniteNumber(frontCameraValue)
    ? `${frontCameraValue}MP`
    : undefined;
  const weight = buildWeightLabel(input);

  const details: ProductDetail[] = [
    screenSize
      ? {
          sectionName: 'Display',
          attributeName: 'Screen size',
          attributeValue: screenSize,
        }
      : null,
    screenResolution
      ? {
          sectionName: 'Display',
          attributeName: 'Screen resolution',
          attributeValue: screenResolution,
        }
      : null,
    ram
      ? {
          sectionName: 'Memory',
          attributeName: 'RAM',
          attributeValue: ram,
        }
      : null,
    storage
      ? {
          sectionName: 'Memory',
          attributeName: 'Storage capacity',
          attributeValue: storage,
        }
      : null,
    rearCamera
      ? {
          sectionName: 'Camera',
          attributeName: 'Rear camera resolution',
          attributeValue: rearCamera,
        }
      : null,
    frontCamera
      ? {
          sectionName: 'Camera',
          attributeName: 'Front camera resolution',
          attributeValue: frontCamera,
        }
      : null,
    weight
      ? {
          sectionName: 'General',
          attributeName: 'Weight',
          attributeValue: weight,
        }
      : null,
  ].filter((detail): detail is ProductDetail => Boolean(detail));

  return details
    .map(
      (detail) => `        <g:product_detail>
          <g:section_name>${escapeXml(detail.sectionName)}</g:section_name>
          <g:attribute_name>${escapeXml(detail.attributeName)}</g:attribute_name>
          <g:attribute_value>${escapeXml(detail.attributeValue)}</g:attribute_value>
        </g:product_detail>`
    )
    .join('\n');
}
