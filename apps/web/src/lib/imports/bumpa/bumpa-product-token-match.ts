import type { ExistingImportedProduct } from '@/lib/imports/bumpa/bumpa-types';

export interface BumpaTokenMatchCandidate {
  product: ExistingImportedProduct;
  tokens: Set<string>;
}

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

export function scoreBumpaProductTokenMatch(
  queryTokens: Set<string>,
  candidate: BumpaTokenMatchCandidate
) {
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
