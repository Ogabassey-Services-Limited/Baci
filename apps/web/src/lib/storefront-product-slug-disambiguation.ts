const MAX_SLUG_DISAMBIGUATOR_TOKENS = 3;
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

  return new Set(normalized.match(/[a-z0-9]+/g) ?? []);
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
  const productName = product.name.trim();
  if (!productName) {
    return '';
  }

  const nameTokens = tokenizeProductIdentity(productName);
  const trailingDisambiguators: string[] = [];

  for (const token of [...getSlugTokens(product.slug)].reverse()) {
    if (nameTokens.has(token)) {
      break;
    }

    if (NON_IDENTIFYING_SLUG_DISAMBIGUATOR_TOKENS.has(token)) {
      continue;
    }

    trailingDisambiguators.unshift(token);
  }

  const suffix = trailingDisambiguators
    .slice(-MAX_SLUG_DISAMBIGUATOR_TOKENS)
    .map(formatSlugDisambiguatorToken)
    .join(' ');

  return suffix ? `${productName} ${suffix}` : productName;
}
