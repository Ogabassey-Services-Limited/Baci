import type { ProductKeySpecs } from '@/lib/products';
import { stripHtmlTags } from '@/lib/sanitize-core';
import { escapeXml } from '@/lib/xml-utils';

interface ProductDetailInput {
  color?: string | null;
  product_key_specs?: ProductKeySpecs | null;
  variant_attributes?: Record<string, unknown> | null;
  weight_unit?: 'kg' | 'lb' | 'g' | 'oz' | null;
  weight_value?: number | null;
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
    if (normalizedValue) {
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
  const keySpecWeight = input.product_key_specs?.weight_g;
  if (isPositiveFiniteNumber(keySpecWeight)) {
    return `${keySpecWeight}g`;
  }

  if (isPositiveFiniteNumber(input.weight_value) && input.weight_unit) {
    return `${input.weight_value}${input.weight_unit}`;
  }

  return undefined;
}

export function buildGoogleColorXml(input: ProductDetailInput) {
  const color =
    getVariantAttribute(input.variant_attributes, ['color', 'colour']) ||
    normalizeText(input.color);

  return color ? `        <g:color>${escapeXml(color)}</g:color>` : '';
}

export function buildGoogleProductDetailXml(input: ProductDetailInput) {
  const specs = input.product_key_specs ?? {};
  const screenSize = isPositiveFiniteNumber(specs.screen_size_inches)
    ? `${specs.screen_size_inches} inches`
    : undefined;
  const screenResolution =
    typeof specs.display_resolution === 'string'
      ? normalizeText(specs.display_resolution)
      : undefined;
  const ram =
    getVariantAttribute(input.variant_attributes, ['ram', 'memory'], {
      formatNumber: formatPositiveGb,
    }) ||
    (isPositiveFiniteNumber(specs.ram_gb) ? formatGb(specs.ram_gb) : undefined);
  const storage =
    getVariantAttribute(
      input.variant_attributes,
      ['storage', 'storage_capacity', 'rom'],
      {
        formatNumber: formatPositiveGb,
      }
    ) ||
    (isPositiveFiniteNumber(specs.storage_gb)
      ? formatGb(specs.storage_gb)
      : undefined);
  const rearCamera = isPositiveFiniteNumber(specs.main_camera_mp)
    ? `${specs.main_camera_mp}MP`
    : undefined;
  const frontCamera = isPositiveFiniteNumber(specs.front_camera_mp)
    ? `${specs.front_camera_mp}MP`
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
