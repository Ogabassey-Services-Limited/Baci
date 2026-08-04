import { normalizeVariantDiscriminatorTokens } from './normalize-variant-discriminator-tokens';

const CONNECTIVITY_TOKENS = new Set(['4g', '5g', 'cellular', 'lte', 'wifi']);
const SIM_MODE_TOKENS = new Set(['esim', 'physical', 'sim']);
const STORAGE_TOKEN_PATTERN = /^\d+(?:gb|tb|mb)$/u;

function matchesOrderedTokenSequence(tokens: string[], expected: string[]) {
  let expectedIndex = 0;
  for (const token of tokens) {
    if (token === expected[expectedIndex]) {
      expectedIndex += 1;
      if (expectedIndex === expected.length) {
        return true;
      }
    }
  }
  return expected.length === 0;
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
  allowPartialGroups = false
) {
  const normalizedOccurrence =
    normalizeVariantDiscriminatorTokens(occurrenceTokens);
  if (!allowPartialGroups) {
    return matchesOrderedTokenSequence(
      normalizedOccurrence,
      discriminatorTokens
    );
  }

  const expectedGroups = groupExpectedTokens(discriminatorTokens);
  let matchedGroup = false;
  for (const [group, expected] of expectedGroups) {
    const occurrenceMentionsGroup = normalizedOccurrence.some(
      (token) => getTokenGroup(token) === group
    );
    if (!occurrenceMentionsGroup) {
      continue;
    }
    if (!matchesOrderedTokenSequence(normalizedOccurrence, expected)) {
      return false;
    }
    matchedGroup = true;
  }
  return matchedGroup;
}
