import { createBumpaProductProfile } from '@/lib/imports/bumpa/bumpa-product-normalization';
import type { ExistingImportedProduct } from '@/lib/imports/bumpa/bumpa-types';
import { sanitizeText } from '@/lib/sanitize-core';
import { normalizeBumpaConditionForCatalog } from './bumpa-order-item-snapshot';

interface IndexedProduct {
  condition: string | null;
  product: ExistingImportedProduct;
  tokens: Set<string>;
}

const CONDITION_TEXT_PATTERN =
  /\b(premium\s*used|uk\s*used|open\s*box|brand\s*new|brandnew|refurbished|new|used)\b/gi;

const MODEL_QUALIFIER_TOKENS = new Set([
  'air',
  'edge',
  'fe',
  'flip',
  'fold',
  'lite',
  'max',
  'mini',
  'plus',
  'pro',
  'se',
  'ultra',
]);

const ACCESSORY_TOKENS = new Set([
  'adapter',
  'case',
  'cable',
  'charger',
  'guard',
  'pouch',
  'protector',
  'screen',
]);
const STORAGE_TOKEN_PATTERN = /^\d+(?:gb|tb)$/;
const DISTINCTIVE_MODEL_TOKEN_PATTERN =
  /^(?:[a-z]+\d+[a-z0-9]*|\d+[a-z]+|\d{1,4})$/;

function normalizeSamsungFoldAlias(value: string) {
  return value.replace(
    /\bsamsung\s+galaxy\s+fold\b/gi,
    'Samsung Galaxy Z Fold'
  );
}

function removeConditionText(value: string) {
  return value
    .replace(/\(([^)]*)\)|\[([^\]]*)\]/g, (group, paren, bracket) => {
      const content = String(paren ?? bracket ?? '');
      CONDITION_TEXT_PATTERN.lastIndex = 0;
      return CONDITION_TEXT_PATTERN.test(content) ? ' ' : group;
    })
    .replace(CONDITION_TEXT_PATTERN, ' ');
}

function normalizeMatchName(value: string) {
  const profile = createBumpaProductProfile(value);
  return sanitizeText(
    normalizeSamsungFoldAlias(
      removeConditionText(profile.normalizedProductName)
    )
  ).toLowerCase();
}

function tokenizeMatchName(value: string) {
  return new Set(normalizeMatchName(value).match(/[a-z0-9]+(?:gb|tb)?/g) ?? []);
}

function readNameCondition(value: string) {
  return normalizeBumpaConditionForCatalog(
    createBumpaProductProfile(value).condition
  );
}

function readProductCondition(product: ExistingImportedProduct) {
  return (
    normalizeBumpaConditionForCatalog(product.condition) ??
    readNameCondition(product.name)
  );
}

function buildConditionedNameKey(name: string, condition: string | null) {
  return `${name}::${condition ?? ''}`;
}

function activeStatusWeight(product: ExistingImportedProduct) {
  return product.status === 'active' ? 1.5 : 0;
}

function hasDifferentModelQualifiers(
  queryTokens: Set<string>,
  candidateTokens: Set<string>
) {
  for (const token of MODEL_QUALIFIER_TOKENS) {
    if (queryTokens.has(token) !== candidateTokens.has(token)) {
      return true;
    }
  }

  return false;
}

function hasDifferentConditions(
  queryCondition: string | null,
  candidateCondition: string | null
) {
  return Boolean(
    queryCondition &&
      candidateCondition &&
      queryCondition !== candidateCondition
  );
}

function pickBestIndexedProduct(candidates: IndexedProduct[]) {
  return candidates.reduce<IndexedProduct | null>(
    (bestCandidate, candidate) => {
      if (
        !bestCandidate ||
        activeStatusWeight(candidate.product) >
          activeStatusWeight(bestCandidate.product)
      ) {
        return candidate;
      }

      return bestCandidate;
    },
    null
  );
}

function pickUnambiguousProduct(
  candidates: IndexedProduct[],
  queryCondition: string | null
) {
  if (candidates.length === 0) {
    return null;
  }

  if (!queryCondition) {
    const unconditionedCandidates = candidates.filter(
      (candidate) => !candidate.condition
    );
    if (unconditionedCandidates.length > 0) {
      return pickBestIndexedProduct(unconditionedCandidates)?.product ?? null;
    }

    const conditionCount = new Set(
      candidates
        .map((candidate) => candidate.condition)
        .filter((condition): condition is string => Boolean(condition))
    ).size;
    if (conditionCount > 1) {
      return null;
    }
  }

  return pickBestIndexedProduct(candidates)?.product ?? null;
}

function hasAccessoryOnlyCandidateTokens(
  queryTokens: Set<string>,
  candidateTokens: Set<string>
) {
  for (const token of ACCESSORY_TOKENS) {
    if (candidateTokens.has(token) && !queryTokens.has(token)) {
      return true;
    }
  }

  return false;
}

function getDistinctiveModelTokens(tokens: Set<string>) {
  return new Set(
    [...tokens].filter(
      (token) =>
        DISTINCTIVE_MODEL_TOKEN_PATTERN.test(token) &&
        !STORAGE_TOKEN_PATTERN.test(token)
    )
  );
}

function hasDifferentModelIdentifiers(
  queryTokens: Set<string>,
  candidateTokens: Set<string>
) {
  const queryModelTokens = getDistinctiveModelTokens(queryTokens);
  const candidateModelTokens = getDistinctiveModelTokens(candidateTokens);

  for (const token of queryModelTokens) {
    if (!candidateModelTokens.has(token)) {
      return true;
    }
  }

  for (const token of candidateModelTokens) {
    if (!queryModelTokens.has(token)) {
      return true;
    }
  }

  return false;
}

function scoreTokenMatch(queryTokens: Set<string>, candidate: IndexedProduct) {
  if (queryTokens.size === 0 || candidate.tokens.size === 0) {
    return 0;
  }

  if (hasDifferentModelQualifiers(queryTokens, candidate.tokens)) {
    return 0;
  }

  if (hasAccessoryOnlyCandidateTokens(queryTokens, candidate.tokens)) {
    return 0;
  }

  if (hasDifferentModelIdentifiers(queryTokens, candidate.tokens)) {
    return 0;
  }

  let overlap = 0;
  for (const token of queryTokens) {
    if (candidate.tokens.has(token)) {
      overlap += 1;
    }
  }

  const queryCoverage = overlap / queryTokens.size;
  const candidateCoverage = overlap / candidate.tokens.size;
  if (queryCoverage <= 0.8 || candidateCoverage < 0.8) {
    return 0;
  }

  return (
    overlap +
    Math.min(queryCoverage, candidateCoverage) +
    activeStatusWeight(candidate.product)
  );
}

export function createBumpaProductNameMatcher(
  products: ExistingImportedProduct[]
) {
  const productsByConditionedName = new Map<string, ExistingImportedProduct>();
  const productsByName = new Map<string, IndexedProduct[]>();
  const indexedProducts = products.map((product) => {
    const normalizedName = normalizeMatchName(product.name);
    const condition = readProductCondition(product);
    const indexedProduct = {
      condition,
      product,
      tokens: tokenizeMatchName(product.name),
    } satisfies IndexedProduct;

    const conditionedKey = buildConditionedNameKey(normalizedName, condition);
    const existingConditionedProduct =
      productsByConditionedName.get(conditionedKey);
    if (
      !existingConditionedProduct ||
      activeStatusWeight(product) >
        activeStatusWeight(existingConditionedProduct)
    ) {
      productsByConditionedName.set(conditionedKey, product);
    }

    const exactProducts = productsByName.get(normalizedName);
    if (exactProducts) {
      exactProducts.push(indexedProduct);
    } else {
      productsByName.set(normalizedName, [indexedProduct]);
    }

    return indexedProduct;
  });

  return (productName: string, conditionOverride?: unknown) => {
    const normalizedName = normalizeMatchName(productName);
    const queryCondition =
      normalizeBumpaConditionForCatalog(conditionOverride) ??
      readNameCondition(productName);
    const conditionedProduct = queryCondition
      ? productsByConditionedName.get(
          buildConditionedNameKey(normalizedName, queryCondition)
        )
      : null;
    if (conditionedProduct) {
      return conditionedProduct;
    }

    const exactProduct = pickUnambiguousProduct(
      (productsByName.get(normalizedName) ?? []).filter(
        (candidate) =>
          !hasDifferentConditions(queryCondition, candidate.condition)
      ),
      queryCondition
    );
    if (exactProduct) {
      return exactProduct;
    }

    const queryTokens = tokenizeMatchName(productName);
    let bestScore = 0;
    let bestMatches: IndexedProduct[] = [];

    for (const candidate of indexedProducts) {
      if (hasDifferentConditions(queryCondition, candidate.condition)) {
        continue;
      }

      const score = scoreTokenMatch(queryTokens, candidate);
      if (score <= 0) {
        continue;
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatches = [candidate];
      } else if (score === bestScore) {
        bestMatches.push(candidate);
      }
    }

    return pickUnambiguousProduct(bestMatches, queryCondition);
  };
}
