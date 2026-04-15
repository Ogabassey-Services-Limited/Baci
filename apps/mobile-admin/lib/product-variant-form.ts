import {
  type EditableProductCondition,
  isEditableProductCondition,
} from '@/lib/product-condition';
import type { AdminProductVariant } from '@/lib/product-picker-variant-rows';

export interface VariantAttributeFormValue {
  id?: string;
  key: string;
  value: string;
}

export interface EditableProductVariant {
  attributes: VariantAttributeFormValue[];
  client_id: string;
  condition?: EditableProductCondition;
  cost_price: number;
  id?: string;
  images: string[];
  price: number;
  primary_image: string | null;
  sku: string;
  stock_quantity: number;
}

function collectAttributeValues(value: unknown): string[] {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? [String(value)] : [];
  }

  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectAttributeValues(item));
  }

  if (typeof value !== 'object') {
    return [];
  }

  return [];
}

function normalizeFiniteNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function normalizeVariantCondition(
  condition: unknown
): EditableProductCondition | undefined {
  const normalizedCondition =
    typeof condition === 'string' ? condition.trim() : '';
  return isEditableProductCondition(normalizedCondition)
    ? normalizedCondition
    : undefined;
}

let nextProductVariantFormToken = 0;

function createProductVariantFormToken(prefix: string): string {
  nextProductVariantFormToken += 1;
  return `${prefix}-${nextProductVariantFormToken}`;
}

export function createEmptyVariantAttribute(
  key: string = '',
  value: string = ''
): VariantAttributeFormValue {
  return {
    id: createProductVariantFormToken('attribute'),
    key,
    value,
  };
}

export function buildVariantAttributeRecord(
  attributes: VariantAttributeFormValue[]
): Record<string, string> {
  return attributes.reduce<Record<string, string>>((record, attribute) => {
    const key = attribute.key.trim();
    const value = attribute.value.trim();

    if (key && value) {
      record[key] = value;
    }

    return record;
  }, {});
}

export function buildParentVariantAttributes(
  variants: Array<{ attributes: VariantAttributeFormValue[] }>
): Record<string, string[]> {
  const valuesByKey = new Map<string, Set<string>>();

  for (const variant of variants) {
    const record = buildVariantAttributeRecord(variant.attributes);

    for (const [key, value] of Object.entries(record)) {
      const existing = valuesByKey.get(key) ?? new Set<string>();
      existing.add(value);
      valuesByKey.set(key, existing);
    }
  }

  return Object.fromEntries(
    Array.from(valuesByKey.entries()).map(([key, values]) => [
      key,
      Array.from(values),
    ])
  );
}

export function buildVariantFormValues(
  variants: AdminProductVariant[],
  defaults?: {
    costPrice?: number;
    price?: number;
  }
): EditableProductVariant[] {
  return variants.map((variant) => ({
    condition: normalizeVariantCondition(variant.condition),
    attributes: toVariantAttributeFormValues(variant.variant_attributes),
    client_id: variant.id ?? createProductVariantFormToken('variant'),
    cost_price: normalizeFiniteNumber(
      variant.cost_price,
      defaults?.costPrice ?? 0
    ),
    id: variant.id,
    images: variant.images ?? [],
    price: normalizeFiniteNumber(variant.price, defaults?.price ?? 0),
    primary_image:
      'primary_image' in variant &&
      typeof variant.primary_image === 'string' &&
      variant.primary_image
        ? variant.primary_image
        : (variant.images?.[0] ?? null),
    sku: variant.sku ?? '',
    stock_quantity: variant.stock_quantity ?? 0,
  }));
}

export function createEmptyEditableVariant(defaults?: {
  attributeKeys?: string[];
  condition?: EditableProductCondition;
  costPrice?: number;
  images?: string[];
  price?: number;
}): EditableProductVariant {
  return {
    attributes:
      defaults?.attributeKeys?.map((key) => createEmptyVariantAttribute(key)) ??
      [],
    client_id: createProductVariantFormToken('variant'),
    condition: defaults?.condition,
    cost_price: defaults?.costPrice ?? 0,
    images: defaults?.images ?? [],
    price: defaults?.price ?? 0,
    primary_image: defaults?.images?.[0] ?? null,
    sku: '',
    stock_quantity: 0,
  };
}

export function getLowestVariantPrice(
  variants: Array<{ price: number }>,
  fallback: number
): number {
  const prices = variants
    .map((variant) => normalizeFiniteNumber(variant.price, fallback))
    .filter((price) => price >= 0);

  return prices.length > 0 ? Math.min(...prices) : fallback;
}

export function getTotalVariantStock(
  variants: Array<{ stock_quantity: number }>
): number {
  return variants.reduce(
    (total, variant) => total + Math.max(0, variant.stock_quantity || 0),
    0
  );
}

export function toVariantAttributeFormValues(
  attributes: unknown
): VariantAttributeFormValue[] {
  if (
    !attributes ||
    typeof attributes !== 'object' ||
    Array.isArray(attributes)
  ) {
    return [];
  }

  return Object.entries(attributes as Record<string, unknown>).flatMap(
    ([key, value]) =>
      collectAttributeValues(value).map((normalizedValue) => ({
        ...createEmptyVariantAttribute(key, normalizedValue),
      }))
  );
}
