import { isProductVariantColorToken } from './is-product-variant-color-token';
import { normalizeVariantDiscriminatorTokens } from './normalize-variant-discriminator-tokens';

const CONNECTIVITY_TOKENS = new Set([
  '4g',
  '5g',
  'bluetooth',
  'cellular',
  'gps',
  'lte',
  'wifi',
]);
const SIM_MODE_TOKENS = new Set([
  'dual',
  'esim',
  'nano',
  'physical',
  'sim',
  'single',
]);
const STORAGE_TOKEN_PATTERN = /^\d+(?:gb|tb|mb)$/u;
const DIMENSION_TOKEN_PATTERN = /^\d+(?:mm|inch)$/u;

function matchesTokenMultiset(tokens: string[], expected: string[]) {
  const sortedTokens = [...tokens].sort();
  const sortedExpected = [...expected].sort();
  return (
    sortedTokens.length === sortedExpected.length &&
    sortedTokens.every((token, index) => token === sortedExpected[index])
  );
}

function matchesExpectedGroup(
  group: string,
  occurrenceTokens: string[],
  expectedTokens: string[]
) {
  if (['connectivity', 'sim', 'color'].includes(group)) {
    return matchesTokenMultiset(occurrenceTokens, expectedTokens);
  }
  return expectedTokens.every((token) => occurrenceTokens.includes(token));
}

function getTokenGroup(token: string) {
  if (CONNECTIVITY_TOKENS.has(token)) {
    return 'connectivity';
  }
  if (SIM_MODE_TOKENS.has(token)) {
    return 'sim';
  }
  if (STORAGE_TOKEN_PATTERN.test(token)) {
    return 'storage';
  }
  if (DIMENSION_TOKEN_PATTERN.test(token)) {
    return 'dimension';
  }
  if (isProductVariantColorToken(token)) {
    return 'color';
  }
  return 'other';
}

function groupExpectedTokens(discriminatorTokens: string[]) {
  const groups = new Map<string, string[]>();
  for (const token of discriminatorTokens) {
    const group = getTokenGroup(token);
    groups.set(group, [...(groups.get(group) ?? []), token]);
  }
  return groups;
}

/** Matches strict compare variants or the variant groups explicitly named by a PDP guide. */
export function matchesVariantDiscriminatorTokens(
  occurrenceTokens: string[],
  discriminatorTokens: string[],
  allowPartialGroups = false,
  allowMissingGroups = false
) {
  const normalizedOccurrence =
    normalizeVariantDiscriminatorTokens(occurrenceTokens);
  const normalizedDiscriminators =
    normalizeVariantDiscriminatorTokens(discriminatorTokens);
  if (!allowPartialGroups) {
    return Array.from(groupExpectedTokens(normalizedDiscriminators)).every(
      ([group, expected]) =>
        matchesExpectedGroup(
          group,
          normalizedOccurrence.filter(
            (token) => getTokenGroup(token) === group
          ),
          expected
        )
    );
  }

  const expectedGroups = groupExpectedTokens(normalizedDiscriminators);
  let matchedGroup = false;
  for (const [group, expected] of expectedGroups) {
    const occurrenceMentionsGroup = normalizedOccurrence.some(
      (token) => getTokenGroup(token) === group
    );
    if (!occurrenceMentionsGroup) {
      continue;
    }
    const occurrenceGroupTokens = normalizedOccurrence.filter(
      (token) => getTokenGroup(token) === group
    );
    if (!matchesExpectedGroup(group, occurrenceGroupTokens, expected)) {
      return false;
    }
    matchedGroup = true;
  }
  return matchedGroup || allowMissingGroups;
}
