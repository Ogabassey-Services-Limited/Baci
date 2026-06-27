import type { NormalizedImportedShippingAddress } from '@/lib/imports/bumpa/bumpa-types';
import { sanitizeText } from '@/lib/sanitize-core';

function optionalText(value: string | null | undefined) {
  const text = sanitizeText(value || '');
  return text || null;
}

function firstOptionalText(...values: (string | null | undefined)[]) {
  for (const value of values) {
    const text = optionalText(value);
    if (text) return text;
  }

  return null;
}

export function buildBumpaShippingAddress(
  rawRow: Partial<Record<string, string>>
): NormalizedImportedShippingAddress | null {
  const fullAddress = firstOptionalText(
    rawRow.best_address_full,
    rawRow.bumpa_shipping_full_address,
    rawRow.shipping_full_address,
    rawRow.bumpa_customer_full_address,
    rawRow.customer_full_address
  );
  const address = firstOptionalText(
    rawRow.best_address_street,
    rawRow.bumpa_shipping_street,
    rawRow.shipping_street,
    rawRow.bumpa_customer_street,
    rawRow.customer_street
  );
  const city = firstOptionalText(
    rawRow.best_address_city,
    rawRow.bumpa_shipping_city,
    rawRow.shipping_city,
    rawRow.bumpa_customer_city,
    rawRow.customer_city
  );
  const state = firstOptionalText(
    rawRow.best_address_state,
    rawRow.bumpa_shipping_state,
    rawRow.shipping_state,
    rawRow.bumpa_customer_state,
    rawRow.customer_state
  );
  const country = firstOptionalText(
    rawRow.best_address_country,
    rawRow.bumpa_shipping_country,
    rawRow.shipping_country,
    rawRow.bumpa_customer_country,
    rawRow.customer_country
  );
  const postalCode = firstOptionalText(
    rawRow.best_address_zip,
    rawRow.bumpa_shipping_zip,
    rawRow.shipping_zip,
    rawRow.bumpa_customer_zip,
    rawRow.customer_zip
  );

  if (!fullAddress && !address && !city && !state && !country && !postalCode) {
    return null;
  }

  return {
    fullAddress,
    address,
    city,
    state,
    country,
    postalCode,
    source: optionalText(rawRow.address_source) || 'bumpa_import',
  };
}
