const MAX_SLUG_DISAMBIGUATOR_TOKENS = 3;
const CURRENCY_SLUG_DISAMBIGUATOR_TOKENS = new Set([
  'eur',
  'gbp',
  'ngn',
  'usd',
]);
const NON_IDENTIFYING_SLUG_DISAMBIGUATOR_TOKENS = new Set([
  'a',
  'an',
  'and',
  'for',
  'new',
  'old',
  'or',
  'preowned',
  'refurbished',
  'the',
  'used',
  'with',
]);

function tokenizeProductIdentity(value: string): Set<string> {
  const normalized = value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\+/g, ' plus ')
    .replace(/£/g, ' gbp ')
    .replace(/€/g, ' eur ')
    .replace(/\$/g, ' usd ')
    .replace(/₦/g, ' ngn ')
    .replace(/\b(\d+)\s+(gb|tb|mb|mah|mp|hz|w)\b/g, '$1$2');

  const tokens = new Set<string>();

  for (const token of normalized.match(/[a-z0-9]+/g) ?? []) {
    tokens.add(token);

    const compactAlphaNumericMatch = token.match(
      /^([a-z]{2,})(\d+)([a-z]{2,})$/
    );
    if (compactAlphaNumericMatch) {
      tokens.add(compactAlphaNumericMatch[1]);
      tokens.add(compactAlphaNumericMatch[2]);
      tokens.add(compactAlphaNumericMatch[3]);
      continue;
    }

    const compactModelMatch = token.match(/^([a-z]{2,})(\d+[a-z0-9]*)$/);
    if (compactModelMatch) {
      tokens.add(compactModelMatch[1]);
      tokens.add(compactModelMatch[2]);
    }
  }

  return tokens;
}

function normalizeSeoProductDisplayName(
  value: string,
  slugTokens: readonly string[]
): string {
  const normalized = slugTokens.includes('plus')
    ? value
        .replace(/\b([a-z]*\d+[a-z]*)\+([a-z0-9]+)\b/gi, '$1 Plus $2')
        .replace(/\b([a-z0-9]+)\+(?=\s|$)/gi, '$1 Plus')
    : value;

  return normalized.replace(/\s{2,}/g, ' ').trim();
}

function getSlugTokens(slug: string | null | undefined): string[] {
  return (slug || '')
    .toLowerCase()
    .split(/[-_]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function formatSlugDisambiguatorToken(token: string): string {
  if (/^\d+gb$/.test(token)) {
    return token.toUpperCase();
  }

  if (/^[a-z]+\d[a-z0-9]*$/.test(token) || /^\d+[a-z]+$/.test(token)) {
    return token.toUpperCase();
  }

  if (token.length <= 3 && /^[a-z]+$/.test(token)) {
    return token.toUpperCase();
  }

  return token.charAt(0).toUpperCase() + token.slice(1);
}

export function getSeoProductName(product: {
  name: string;
  slug?: string | null;
}): string {
  const slugTokens = getSlugTokens(product.slug);
  const productName = normalizeSeoProductDisplayName(product.name, slugTokens);
  if (!productName) {
    return '';
  }

  const nameTokens = tokenizeProductIdentity(productName);
  const representedSlugTokenIndexes = slugTokens
    .map((token, index) =>
      nameTokens.has(token) &&
      !NON_IDENTIFYING_SLUG_DISAMBIGUATOR_TOKENS.has(token)
        ? index
        : -1
    )
    .filter((index) => index >= 0);
  const lastRepresentedSlugTokenIndex =
    representedSlugTokenIndexes.at(-1) ?? -1;
  const hasRepresentedSlugTokens = lastRepresentedSlugTokenIndex >= 0;

  const disambiguators: string[] = [];
  const seenDisambiguators = new Set<string>();

  for (const [index, token] of slugTokens.entries()) {
    if (nameTokens.has(token)) {
      continue;
    }

    if (NON_IDENTIFYING_SLUG_DISAMBIGUATOR_TOKENS.has(token)) {
      continue;
    }

    const isMismatchedCurrencyToken =
      CURRENCY_SLUG_DISAMBIGUATOR_TOKENS.has(token) &&
      representedSlugTokenIndexes.some((tokenIndex) => tokenIndex < index);

    if (
      hasRepresentedSlugTokens &&
      index <= lastRepresentedSlugTokenIndex &&
      !isMismatchedCurrencyToken
    ) {
      continue;
    }

    if (!seenDisambiguators.has(token)) {
      disambiguators.push(token);
      seenDisambiguators.add(token);
    }
  }

  const suffix = disambiguators
    .slice(-MAX_SLUG_DISAMBIGUATOR_TOKENS)
    .map(formatSlugDisambiguatorToken)
    .join(' ');

  return suffix ? `${productName} ${suffix}` : productName;
}
