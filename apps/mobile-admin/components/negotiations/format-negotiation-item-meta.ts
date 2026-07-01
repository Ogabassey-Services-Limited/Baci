import type { NegotiationItemInfo } from '@baci/shared';

const ATTRIBUTE_ORDER = [
  'ram',
  'storage',
  'capacity',
  'color',
  'colour',
  'display_type',
  'screen_size',
  'processor',
  'os',
];

const ATTRIBUTE_LABELS: Record<string, string> = {
  color: 'Color',
  colour: 'Color',
  display_type: 'Display type',
  os: 'OS',
  ram: 'RAM',
  screen_size: 'Screen size',
};

const IGNORED_ATTRIBUTE_KEYS = new Set([
  'id',
  'sku',
  'slug',
  'image',
  'images',
  'condition',
  'price',
  'product_id',
  'variant_id',
  'variant_name',
]);

function cleanString(value: unknown): string | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : null;
  }
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeAttributeKey(key: string): string {
  return key
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase();
}

function formatAttributeLabel(key: string): string {
  const normalized = normalizeAttributeKey(key);
  const explicitLabel = ATTRIBUTE_LABELS[normalized];
  if (explicitLabel) return explicitLabel;
  return normalized
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function shouldShowAttribute(key: string, value: unknown): boolean {
  const normalized = normalizeAttributeKey(key);
  if (!cleanString(value)) return false;
  if (IGNORED_ATTRIBUTE_KEYS.has(normalized)) return false;
  return !normalized.endsWith('_hex') && normalized !== 'hex';
}

function compareAttributeKeys(left: string, right: string): number {
  const leftIndex = ATTRIBUTE_ORDER.indexOf(normalizeAttributeKey(left));
  const rightIndex = ATTRIBUTE_ORDER.indexOf(normalizeAttributeKey(right));
  if (leftIndex !== -1 || rightIndex !== -1) {
    return (
      (leftIndex === -1 ? ATTRIBUTE_ORDER.length : leftIndex) -
      (rightIndex === -1 ? ATTRIBUTE_ORDER.length : rightIndex)
    );
  }
  return left.localeCompare(right);
}

function formatVariantAttributes(attributes: unknown): string | null {
  if (!isRecord(attributes)) return null;

  const parts = Object.entries(attributes)
    .filter(([key, value]) => shouldShowAttribute(key, value))
    .sort(([left], [right]) => compareAttributeKeys(left, right))
    .map(
      ([key, value]) => `${formatAttributeLabel(key)}: ${cleanString(value)}`
    );

  return parts.length > 0 ? parts.join(' · ') : null;
}

function appendUnique(parts: string[], value: string | null): void {
  if (!value) return;
  const normalizedValue = normalizeComparableText(value);
  const normalizedBareValue = normalizeConditionValue(normalizedValue);
  if (
    parts.some((part) => {
      const normalizedPart = normalizeComparableText(part);
      if (normalizedPart === normalizedValue) return true;
      return tokenizeComparableText(normalizedPart).some((token) => {
        const bareToken = normalizeConditionValue(token);
        return (
          token === normalizedValue ||
          token === normalizedBareValue ||
          bareToken === normalizedBareValue
        );
      });
    })
  ) {
    return;
  }
  parts.push(value);
}

function normalizeComparableText(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizeConditionValue(value: string): string {
  return value.replace(/^condition:\s*/, '').trim();
}

function tokenizeComparableText(value: string): string[] {
  return value
    .split(/[·/]/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function formatCondition(value: unknown): string | null {
  const condition = cleanString(value);
  return condition ? `Condition: ${condition.replace(/_/g, ' ')}` : null;
}

export function formatNegotiationItemMeta(
  itemInfo: NegotiationItemInfo | null
): string | null {
  if (!itemInfo) return null;

  const parts: string[] = [];
  const variantName = cleanString(itemInfo.variant_name);
  appendUnique(parts, variantName);
  appendUnique(
    parts,
    variantName ? null : formatVariantAttributes(itemInfo.variant_attributes)
  );
  appendUnique(parts, formatCondition(itemInfo.condition));

  return parts.length > 0 ? parts.join(' · ') : null;
}
