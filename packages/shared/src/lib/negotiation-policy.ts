export const MAX_AUTO_NEGOTIATION_DISCOUNT_RATE = 0.02;

export const COUNTER_NEGOTIATION_DISCOUNT_STEPS = [0.01, 0.015, 0.02] as const;

const MIN_SUBTOTAL_FOR_ROUNDED_COUNTER = 1000;

export function computeNegotiationCounterOffer(
  currentPrice: number,
  counterDiscount: number,
  vatRate = 0
): number {
  const rawCounterOffer = Math.floor(currentPrice * (1 - counterDiscount));

  if (counterDiscount < MAX_AUTO_NEGOTIATION_DISCOUNT_RATE) {
    return rawCounterOffer;
  }

  const rawDiscountAmount = currentPrice - rawCounterOffer;
  const vatAwareCart = vatRate > 0;
  const hasFractionalPrice = !Number.isInteger(currentPrice);
  let maxServerAcceptedDiscountAmount: number;

  if (vatAwareCart || hasFractionalPrice) {
    maxServerAcceptedDiscountAmount = Math.floor(
      currentPrice * MAX_AUTO_NEGOTIATION_DISCOUNT_RATE
    );
  } else if (currentPrice >= MIN_SUBTOTAL_FOR_ROUNDED_COUNTER) {
    maxServerAcceptedDiscountAmount = Math.ceil(
      currentPrice * MAX_AUTO_NEGOTIATION_DISCOUNT_RATE
    );
  } else {
    maxServerAcceptedDiscountAmount = Math.floor(
      currentPrice * MAX_AUTO_NEGOTIATION_DISCOUNT_RATE
    );
  }

  return (
    currentPrice - Math.min(rawDiscountAmount, maxServerAcceptedDiscountAmount)
  );
}

const NON_NEGOTIABLE_BRAND_KEYWORDS = [
  'infinix',
  'tecno',
  'vivo',
  'redmi',
  'xiaomi',
  'oppo',
  'itel',
  'honor',
] as const;

export interface ProductNegotiabilityInput {
  brand?: string | null;
  name?: string | null;
}

function normalizePolicyText(value: string | null | undefined): string {
  return (value ?? '')
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function hasBudgetBrandKeyword(normalizedText: string): boolean {
  // `normalizedText` is already lowercased with non-alphanumerics collapsed to
  // single spaces, so whole-word matching is exact token membership. Avoid
  // constructing a RegExp from a variable (Semgrep detect-non-literal-regexp /
  // ReDoS) — a Set lookup is both safer and faster.
  const tokens = new Set(normalizedText.split(' '));
  return NON_NEGOTIABLE_BRAND_KEYWORDS.some((keyword) => tokens.has(keyword));
}

function isSamsungASeriesProduct(
  normalizedBrand: string,
  normalizedName: string
): boolean {
  const normalizedText = `${normalizedBrand} ${normalizedName}`.trim();
  const mentionsSamsung = /\bsamsung\b|\bgalaxy\b/.test(normalizedText);
  const hasASeriesModel =
    /\bgalaxy\s+a\s?series\b/.test(normalizedText) ||
    /\bsamsung\s+galaxy\s+a\s?series\b/.test(normalizedText) ||
    /\bsamsung\s+a\s?series\b/.test(normalizedText) ||
    /\bgalaxy\s+a\s?\d{1,3}[a-z]*\b/.test(normalizedText) ||
    /\bsamsung\s+a\s?\d{1,3}[a-z]*\b/.test(normalizedText) ||
    (/\bsamsung\b/.test(normalizedText) &&
      /\ba\s?\d{1,3}[a-z]*\b/.test(normalizedName));

  return mentionsSamsung && hasASeriesModel;
}

export function isProductNegotiable(input: ProductNegotiabilityInput): boolean {
  const normalizedBrand = normalizePolicyText(input.brand);
  const normalizedName = normalizePolicyText(input.name);
  const normalizedText = `${normalizedBrand} ${normalizedName}`.trim();

  if (!normalizedText) {
    return true;
  }

  if (hasBudgetBrandKeyword(normalizedText)) {
    return false;
  }

  return !isSamsungASeriesProduct(normalizedBrand, normalizedName);
}
