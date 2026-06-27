import {
  type CanonicalProductCondition,
  formatCanonicalProductConditionLabel,
  normalizeCanonicalProductCondition,
} from '@baci/shared/lib';
import { sanitizeText } from '@/lib/sanitize-core';
import { createBumpaProductProfile } from './bumpa-product-normalization';
import type { ExistingImportedProduct } from './bumpa-types';

const RECEIPT_CONDITION_GROUP_PATTERN =
  /\s*(?:\(|\[)\s*(?:premium\s*used|uk\s*used|open\s*box|brand\s*new|brandnew|refurbished|new|used)\s*(?:\)|\])\s*/gi;
const RECEIPT_CONDITION_SUFFIX_PATTERN =
  /[\s|,:/-]+(premium\s*used|uk\s*used|open\s*box|brand\s*new|brandnew|refurbished|new|used)\s*$/i;

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readBumpaMetadata(importMetadata: Record<string, unknown>) {
  const bumpaMetadata = importMetadata.bumpa;
  if (
    !bumpaMetadata ||
    typeof bumpaMetadata !== 'object' ||
    Array.isArray(bumpaMetadata)
  ) {
    return null;
  }

  return bumpaMetadata as Record<string, unknown>;
}

function hasExplicitReceiptConditionMarker(value: string) {
  RECEIPT_CONDITION_GROUP_PATTERN.lastIndex = 0;
  return (
    RECEIPT_CONDITION_GROUP_PATTERN.test(value) ||
    RECEIPT_CONDITION_SUFFIX_PATTERN.test(value)
  );
}

function getTrustedImportedCondition({
  importMetadata,
  importedProductName,
  profileCondition,
  profileConditionSource,
}: {
  importMetadata: Record<string, unknown>;
  importedProductName: string;
  profileCondition: string | null;
  profileConditionSource: string | null;
}) {
  const bumpaMetadata = readBumpaMetadata(importMetadata);
  const metadataCondition = readString(bumpaMetadata?.condition);
  const metadataConditionSource = readString(bumpaMetadata?.condition_source);
  const hasExplicitMarker =
    hasExplicitReceiptConditionMarker(importedProductName);

  if (
    metadataCondition &&
    (metadataConditionSource === 'bracketed' || hasExplicitMarker)
  ) {
    return metadataCondition;
  }

  if (
    profileCondition &&
    (profileConditionSource === 'bracketed' || hasExplicitMarker)
  ) {
    return profileCondition;
  }

  return null;
}

export function normalizeBumpaConditionForCatalog(
  value: unknown
): CanonicalProductCondition | null {
  const normalized = readString(value)
    ?.toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_');

  if (!normalized) return null;
  if (normalized === 'premium_used' || normalized === 'uk_used') {
    return 'used';
  }
  if (normalized === 'brand_new' || normalized === 'brandnew') return 'new';

  return normalizeCanonicalProductCondition(normalized) || null;
}

export function formatBumpaReceiptCondition(
  condition: CanonicalProductCondition | null
) {
  return formatCanonicalProductConditionLabel(condition) ?? null;
}

export function stripBumpaReceiptConditionFromName(value: string) {
  return sanitizeText(
    value
      .replace(RECEIPT_CONDITION_GROUP_PATTERN, ' ')
      .replace(RECEIPT_CONDITION_SUFFIX_PATTERN, ' ')
  );
}

function firstProductImage(product: ExistingImportedProduct | null) {
  return (
    product?.images
      ?.find((image) => typeof image === 'string' && image.trim())
      ?.trim() ?? null
  );
}

export function buildBumpaOrderItemSnapshot({
  importedProductName,
  importMetadata,
  matchedProduct,
}: {
  importedProductName: string;
  importMetadata: Record<string, unknown>;
  matchedProduct: ExistingImportedProduct | null;
}) {
  const importedProfile = createBumpaProductProfile(importedProductName);
  const trustedImportedCondition = getTrustedImportedCondition({
    importMetadata,
    importedProductName,
    profileCondition: importedProfile.condition,
    profileConditionSource: importedProfile.conditionSource,
  });
  const matchedProductCondition =
    normalizeBumpaConditionForCatalog(matchedProduct?.condition) ??
    (matchedProduct
      ? normalizeBumpaConditionForCatalog(
          createBumpaProductProfile(matchedProduct.name).condition
        )
      : null);
  const condition =
    normalizeBumpaConditionForCatalog(trustedImportedCondition) ??
    matchedProductCondition;
  const variantName = formatBumpaReceiptCondition(condition);
  const preferredName = matchedProduct?.name || importedProductName;
  const productName =
    (variantName
      ? stripBumpaReceiptConditionFromName(preferredName)
      : sanitizeText(preferredName)) || sanitizeText(importedProductName);

  return {
    productName,
    condition,
    variantName,
    imageUrl: firstProductImage(matchedProduct),
  };
}
