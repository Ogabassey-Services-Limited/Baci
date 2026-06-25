const MAX_SLUG_DISAMBIGUATOR_TOKENS = 3;
// Keep this set in sync with appendCurrencyCodeToSymbolAmounts below.
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
const SEO_HTML_TAG_PATTERN = /<[^>]{0,1000}>/g;

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
        // Handle mid-word plus models before trailing plus models.
        .replace(/\b([a-z]*\d+[a-z]*)\+([a-z0-9]+)\b/gi, '$1 Plus $2')
        .replace(/\b([a-z0-9]+)\+(?=[\s.,!?;:]|$)/gi, '$1 Plus')
    : value;

  return normalized.replace(/\s{2,}/g, ' ').trim();
}

function appendCurrencyCodeToSymbolAmounts(
  value: string,
  slugTokens: readonly string[]
): string {
  let normalized = value;

  if (slugTokens.includes('gbp')) {
    normalized = appendCurrencyCode(
      normalized,
      /£\s?\d[\d,]*(?:\.\d+)?/gi,
      'GBP'
    );
  }

  if (slugTokens.includes('eur')) {
    normalized = appendCurrencyCode(
      normalized,
      /€\s?\d[\d,]*(?:\.\d+)?/gi,
      'EUR'
    );
  }

  if (slugTokens.includes('usd')) {
    normalized = appendCurrencyCode(
      normalized,
      /\$\s?\d[\d,]*(?:\.\d+)?/gi,
      'USD'
    );
  }

  if (slugTokens.includes('ngn')) {
    normalized = appendCurrencyCode(
      normalized,
      /₦\s?\d[\d,]*(?:\.\d+)?/gi,
      'NGN'
    );
  }

  return normalized.replace(/\s{2,}/g, ' ').trim();
}

function appendCurrencyCode(
  value: string,
  amountPattern: RegExp,
  currencyCode: string
): string {
  return value.replace(
    amountPattern,
    (amount, offset: number, full: string) => {
      const followingText = full.slice(offset + amount.length);
      const nextText = followingText.trimStart();
      const hasExistingCurrencyCode =
        nextText.slice(0, currencyCode.length).toUpperCase() === currencyCode &&
        !/[a-z0-9]/i.test(nextText.charAt(currencyCode.length));

      return hasExistingCurrencyCode ? amount : `${amount} ${currencyCode}`;
    }
  );
}

function stripSeoHtmlTags(value: string): string {
  return value.includes('<') ? value.replace(SEO_HTML_TAG_PATTERN, ' ') : value;
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
  const productName = normalizeSeoProductText(product.name, product);
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

export function normalizeSeoProductText(
  value: string | null | undefined,
  product: {
    slug?: string | null;
  }
): string {
  const slugTokens = getSlugTokens(product.slug);
  const normalizedText = normalizeSeoProductDisplayName(
    stripSeoHtmlTags(value || ''),
    slugTokens
  );
  return appendCurrencyCodeToSymbolAmounts(normalizedText, slugTokens);
}
