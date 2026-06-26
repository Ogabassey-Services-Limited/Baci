import { replaceBumpaContactText } from '@/lib/imports/bumpa/bumpa-contact-redaction';
import { createBumpaProductProfile } from '@/lib/imports/bumpa/bumpa-product-normalization';

interface BumpaItemImportMetadata {
  raw_product_name: string;
  normalized_product_name: string;
  analytics_product_key: string;
  product_kind: string;
  brand: string | null;
  product_family: string | null;
  condition: string | null;
  condition_source: string | null;
  fulfillment_identifiers: {
    imeis: string[];
    serialNumbers: string[];
    unlabeledIdentifiers: string[];
  };
}

function redactContactText(value: string) {
  return replaceBumpaContactText(value, {
    email: '[redacted-email]',
    phone: '[redacted-phone]',
  });
}

export function buildBumpaItemImportMetadata(
  itemName: string
): BumpaItemImportMetadata {
  const profile = createBumpaProductProfile(itemName);
  const rawProductName = redactContactText(profile.rawProductName);

  return {
    raw_product_name: rawProductName,
    normalized_product_name: profile.normalizedProductName,
    analytics_product_key: profile.analyticsProductKey,
    product_kind: profile.productKind,
    brand: profile.brand,
    product_family: profile.family,
    condition: profile.condition,
    condition_source: profile.conditionSource,
    fulfillment_identifiers: profile.identifiers,
  };
}
