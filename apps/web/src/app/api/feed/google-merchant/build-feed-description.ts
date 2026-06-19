import type { ProductKeySpecs } from '@/lib/products';
import { stripHtmlTags } from '@/lib/sanitize-core';

interface FeedDescriptionInput {
  color?: string | null;
  description?: string | null;
  name: string;
  product_key_specs?: ProductKeySpecs | null;
  variant_attributes?: Record<string, unknown> | null;
  weight_unit?: 'kg' | 'lb' | 'g' | 'oz' | null;
  weight_value?: number | null;
}

const MAX_FEED_DESCRIPTION_LENGTH = 4500;

function normalizeText(value: unknown) {
  return stripHtmlTags(typeof value === 'string' ? value : '')
    .replace(/\s+/g, ' ')
    .trim();
}

function removeFeedOnlyBoilerplate(value: string) {
  return (
    value
      .replace(
        /\bCurrent listed price is\s+[A-Z]{3}\s*[\d,]+(?:\.\d+)?\.\s*/gi,
        ''
      )
      .replace(
        /\bConfirm selected variant price,\s*colou?r,\s*storage,\s*device condition,\s*and live availability before checkout\.\s*/gi,
        ''
      )
      // Removing full sentences can leave fresh doubled or trailing spaces.
      .replace(/\s+/g, ' ')
      .trim()
  );
}

function buildWeightLabel(input: FeedDescriptionInput) {
  const keySpecWeight = input.product_key_specs?.weight_g;
  if (typeof keySpecWeight === 'number' && Number.isFinite(keySpecWeight)) {
    return `${keySpecWeight}g`;
  }

  if (
    typeof input.weight_value === 'number' &&
    Number.isFinite(input.weight_value) &&
    input.weight_unit
  ) {
    return `${input.weight_value}${input.weight_unit}`;
  }

  return undefined;
}

function getVariantAttribute(
  attributes: FeedDescriptionInput['variant_attributes'],
  aliases: string[]
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

    const normalizedValue = normalizeText(value);
    if (normalizedValue) {
      return normalizedValue;
    }
  }

  return undefined;
}

function buildSpecDetails(input: FeedDescriptionInput) {
  const specs = input.product_key_specs ?? {};
  const color =
    getVariantAttribute(input.variant_attributes, ['color', 'colour']) ||
    normalizeText(input.color) ||
    (typeof specs.available_colors === 'string'
      ? normalizeText(specs.available_colors)
      : undefined);
  const screenSize =
    typeof specs.screen_size_inches === 'number'
      ? `${specs.screen_size_inches} inches`
      : undefined;
  const screenResolution =
    typeof specs.display_resolution === 'string'
      ? normalizeText(specs.display_resolution)
      : undefined;
  const ram =
    getVariantAttribute(input.variant_attributes, ['ram', 'memory']) ||
    (typeof specs.ram_gb === 'number' ? `${specs.ram_gb}GB` : undefined);
  const storage =
    getVariantAttribute(input.variant_attributes, [
      'storage',
      'storage_capacity',
      'rom',
    ]) ||
    (typeof specs.storage_gb === 'number'
      ? `${specs.storage_gb}GB`
      : undefined);
  const rearCamera =
    typeof specs.main_camera_mp === 'number'
      ? `${specs.main_camera_mp}MP`
      : undefined;
  const frontCamera =
    typeof specs.front_camera_mp === 'number'
      ? `${specs.front_camera_mp}MP`
      : undefined;
  const weight = buildWeightLabel(input);

  return [
    color ? `Colour: ${color}` : null,
    screenSize ? `Screen size: ${screenSize}` : null,
    screenResolution ? `Screen resolution: ${screenResolution}` : null,
    ram ? `RAM: ${ram}` : null,
    storage ? `Storage capacity: ${storage}` : null,
    rearCamera ? `Rear camera resolution: ${rearCamera}` : null,
    frontCamera ? `Front camera resolution: ${frontCamera}` : null,
    weight ? `Weight: ${weight}` : null,
  ].filter((value): value is string => Boolean(value));
}

function trimDescription(value: string) {
  if (value.length <= MAX_FEED_DESCRIPTION_LENGTH) {
    return value;
  }

  return value.slice(0, MAX_FEED_DESCRIPTION_LENGTH).trimEnd();
}

export function buildFeedDescription(input: FeedDescriptionInput) {
  const baseDescription = removeFeedOnlyBoilerplate(
    normalizeText(input.description)
  );
  const specDetails = buildSpecDetails(input);

  if (specDetails.length === 0) {
    return trimDescription(baseDescription || normalizeText(input.name));
  }

  const normalizedBase = baseDescription.toLowerCase();
  const missingDetails = specDetails.filter(
    (detail) => !normalizedBase.includes(detail.toLowerCase())
  );

  if (missingDetails.length === 0) {
    return trimDescription(baseDescription || normalizeText(input.name));
  }

  const specSentence = `Key details: ${missingDetails.join('; ')}.`;
  if (!baseDescription) {
    const nameNormalized = normalizeText(input.name);
    return trimDescription(
      nameNormalized ? `${nameNormalized}. ${specSentence}` : specSentence
    );
  }

  return trimDescription(`${specSentence} ${baseDescription}`);
}
