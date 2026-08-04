const BARE_CAPACITY_TOKEN_PATTERN = /^\d{3,4}$/u;
const LABELED_CAPACITY_TOKEN_PATTERN = /^\d+(?:gb|tb|mb)$/u;
const COMMON_CAPACITY_VALUES = new Set(['128', '256', '512', '1024', '2048']);

/** Identifies unitless storage values placed before a labeled memory value. */
export function isBareCapacityMetadataToken(tokens: string[], index: number) {
  const previousToken = tokens[index - 1] ?? '';
  return (
    BARE_CAPACITY_TOKEN_PATTERN.test(tokens[index] ?? '') &&
    /[a-z]/u.test(previousToken) &&
    /\d/u.test(previousToken) &&
    (tokens
      .slice(index + 1)
      .some((token) => LABELED_CAPACITY_TOKEN_PATTERN.test(token)) ||
      (index === tokens.length - 1 &&
        COMMON_CAPACITY_VALUES.has(tokens[index] ?? '')))
  );
}
