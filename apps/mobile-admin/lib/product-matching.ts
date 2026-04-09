import {
  buildProductSearchQuery,
  normalizeProductSearchText,
} from '@baci/shared';

export interface ProductMatchCandidate {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  category: string | null;
}

export interface RankedProductMatch<T extends ProductMatchCandidate> {
  product: T;
  score: number;
  isExact: boolean;
}

export function normalizeComparableProductName(value: string): string {
  return normalizeProductSearchText(value);
}

export function buildProductSuggestionTerms(value: string): string[] {
  const normalized = normalizeComparableProductName(value);

  if (!normalized) {
    return [];
  }

  const tokens = normalized.split(' ').filter(Boolean);
  const terms = new Set<string>([normalized]);

  if (tokens.length > 1) {
    terms.add(tokens.slice(0, 2).join(' '));
  }

  for (const token of tokens.slice(0, 4)) {
    if (token.length >= 3) {
      terms.add(token);
    }
  }

  return [...terms];
}

function createBigrams(value: string): Set<string> {
  const compact = value.replace(/\s+/g, '');

  if (!compact) {
    return new Set();
  }

  if (compact.length === 1) {
    return new Set([compact]);
  }

  const bigrams = new Set<string>();

  for (let index = 0; index < compact.length - 1; index += 1) {
    bigrams.add(compact.slice(index, index + 2));
  }

  return bigrams;
}

function getDiceCoefficient(left: string, right: string): number {
  const leftBigrams = createBigrams(left);
  const rightBigrams = createBigrams(right);

  if (leftBigrams.size === 0 || rightBigrams.size === 0) {
    return 0;
  }

  let overlap = 0;

  for (const bigram of leftBigrams) {
    if (rightBigrams.has(bigram)) {
      overlap += 1;
    }
  }

  return (2 * overlap) / (leftBigrams.size + rightBigrams.size);
}

function getTokenOverlap(left: string, right: string): number {
  const leftTokens = new Set(left.split(' ').filter(Boolean));
  const rightTokens = new Set(right.split(' ').filter(Boolean));

  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  let overlap = 0;

  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      overlap += 1;
    }
  }

  return overlap / Math.max(leftTokens.size, rightTokens.size);
}

export function rankProductMatches<T extends ProductMatchCandidate>(
  productName: string,
  products: T[],
  options?: {
    excludeProductId?: string;
    limit?: number;
    minScore?: number;
  }
): RankedProductMatch<T>[] {
  const query = buildProductSearchQuery(productName);
  const normalizedQuery = query.normalized;

  if (!normalizedQuery) {
    return [];
  }

  const seenMatchIds = new Set<string>();

  const matches = products
    .filter((product) => product.id !== options?.excludeProductId)
    .map((product) => {
      const candidate = buildProductSearchQuery(product.name);
      const normalizedCandidate = candidate.normalized;
      const isExact = normalizedCandidate === normalizedQuery;
      const hasCompactTerms =
        Boolean(query.compact) && Boolean(candidate.compact);
      const containsMatch =
        normalizedCandidate.includes(normalizedQuery) ||
        normalizedQuery.includes(normalizedCandidate) ||
        (hasCompactTerms &&
          (candidate.compact.includes(query.compact) ||
            query.compact.includes(candidate.compact)));
      const tokenOverlap = getTokenOverlap(
        normalizedQuery,
        normalizedCandidate
      );
      const diceCoefficient = getDiceCoefficient(
        normalizedQuery,
        normalizedCandidate
      );
      const prefixBonus = normalizedCandidate.startsWith(normalizedQuery)
        ? 0.08
        : 0;
      const containsBonus = containsMatch ? 0.15 : 0;
      const score = isExact
        ? 1
        : Math.min(
            0.99,
            diceCoefficient * 0.55 +
              tokenOverlap * 0.35 +
              prefixBonus +
              containsBonus
          );

      return {
        product,
        score,
        isExact,
      };
    })
    .filter((match) => {
      if (match.isExact) return true;
      if (match.score < (options?.minScore ?? 0.45)) return false;
      if (seenMatchIds.has(match.product.id)) return false;
      seenMatchIds.add(match.product.id);
      return true;
    })
    .sort((left, right) => {
      if (left.isExact !== right.isExact) {
        return left.isExact ? -1 : 1;
      }

      if (left.score !== right.score) {
        return right.score - left.score;
      }

      return left.product.name.localeCompare(right.product.name);
    });

  return matches.slice(0, options?.limit ?? 4);
}
