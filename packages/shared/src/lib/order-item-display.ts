import { formatCanonicalProductConditionLabel } from './product-condition';

export interface OrderItemOptionInput {
  condition?: string | null;
  variantName?: string | null;
}

export interface OrderItemDisplayNameInput extends OrderItemOptionInput {
  baseName?: string | null;
}

function normalizeOptionToken(value: string) {
  return value.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
}

function titleCaseOption(value: string) {
  return normalizeOptionToken(value).replace(/\b[a-z]/g, (letter) =>
    letter.toUpperCase()
  );
}

function getConditionDisplayLabel(condition: string | null | undefined) {
  const canonicalLabel = formatCanonicalProductConditionLabel(condition);
  if (canonicalLabel) {
    return canonicalLabel;
  }

  if (typeof condition !== 'string') {
    return null;
  }

  const fallbackLabel = titleCaseOption(condition);
  return fallbackLabel ? fallbackLabel : null;
}

function splitVariantName(variantName: string | null | undefined) {
  if (typeof variantName !== 'string') {
    return [];
  }

  return variantName
    .split(/[\/,]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export function formatOrderItemOptionLabel({
  condition,
  variantName,
}: OrderItemOptionInput) {
  const conditionLabel = getConditionDisplayLabel(condition);
  const conditionKey = conditionLabel
    ? normalizeOptionToken(conditionLabel)
    : null;
  const variantParts = splitVariantName(variantName).filter((part) => {
    if (!conditionKey) {
      return true;
    }

    return normalizeOptionToken(part) !== conditionKey;
  });

  return [conditionLabel, ...variantParts].filter(Boolean).join(' / ');
}

export function formatOrderItemDisplayName({
  baseName,
  condition,
  variantName,
}: OrderItemDisplayNameInput) {
  const displayName =
    typeof baseName === 'string' && baseName.trim().length > 0
      ? baseName.trim()
      : 'Product';
  const optionLabel = formatOrderItemOptionLabel({ condition, variantName });

  return optionLabel ? `${displayName} (${optionLabel})` : displayName;
}
