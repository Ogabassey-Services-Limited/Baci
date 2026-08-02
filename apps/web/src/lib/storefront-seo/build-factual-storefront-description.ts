import { sanitizeText } from '@/lib/sanitize-core';

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? sanitizeText(trimmed) || null : null;
}

const SUPPORTED_COUNTRY_CODES = new Set([
  'NG',
  'GH',
  'KE',
  'ZA',
  'UG',
  'TZ',
  'RW',
  'CI',
  'SN',
  'US',
  'GB',
  'CA',
]);

export function buildFactualStorefrontDescription({
  businessName,
  siteDescription,
  siteTagline,
  categoryName,
  country,
}: {
  businessName: string | null | undefined;
  siteDescription: string | null | undefined;
  siteTagline: string | null | undefined;
  categoryName: string | null | undefined;
  country: string | null | undefined;
}): string {
  const authoredDescription = clean(siteDescription);
  const authoredTagline = clean(siteTagline);
  if (authoredDescription || authoredTagline) {
    return authoredDescription || authoredTagline || '';
  }

  const storeName = clean(businessName) || 'Store';
  const category = clean(categoryName);
  const normalizedCountry = clean(country)?.toUpperCase();
  const location = SUPPORTED_COUNTRY_CODES.has(normalizedCountry ?? '')
    ? ` in ${normalizedCountry}`
    : '';

  return category
    ? `${storeName} offers ${category}${location}.`
    : `${storeName} storefront${location}.`;
}
