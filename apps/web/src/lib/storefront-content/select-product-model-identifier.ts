const GENERIC_MODEL_MARKER_TOKENS = new Set([
  'edition',
  'model',
  'new',
  'series',
  'version',
]);
const YEAR_TOKEN_PATTERN = /^(?:19|20)\d{2}$/u;

function isConvertibleInConnector(tokens: string[], index: number) {
  return (
    tokens[index] === 'in' &&
    /^\d+$/u.test(tokens[index - 1] ?? '') &&
    /^\d+$/u.test(tokens[index + 1] ?? '')
  );
}

function isMeaningfulModelToken(token: string) {
  return (
    !/^\d+$/u.test(token) &&
    token.length > 1 &&
    !GENERIC_MODEL_MARKER_TOKENS.has(token)
  );
}

function isSeriesPhraseToken(tokens: string[], index: number) {
  const token = tokens[index] ?? '';
  const nextToken = tokens[index + 1] ?? '';
  const isSeriesMarker =
    token === 'series' &&
    (/^[a-z]$/u.test(nextToken) ||
      /^\d+$/u.test(nextToken) ||
      nextToken === 'se');
  const followsSeriesMarker =
    index > 0 &&
    tokens[index - 1] === 'series' &&
    (/^[a-z]$/u.test(token) || /^\d+$/u.test(token) || token === 'se');
  return isSeriesMarker || followsSeriesMarker;
}

/** Selects a compact phrase from already-normalized model tokens. */
export function selectProductModelIdentifier(
  tokens: string[],
  preserveYearTokens = false
) {
  const hasNonYearAlphanumericModel = tokens.some(
    (token) =>
      !YEAR_TOKEN_PATTERN.test(token) &&
      /[a-z]/u.test(token) &&
      /\d/u.test(token)
  );
  const numericIndex = tokens.findLastIndex(
    (token) =>
      /^\d+$/u.test(token) &&
      (preserveYearTokens ||
        !YEAR_TOKEN_PATTERN.test(token) ||
        !hasNonYearAlphanumericModel)
  );
  if (numericIndex >= 0) {
    const hasConvertibleModel = tokens.some((_, index) =>
      isConvertibleInConnector(tokens, index)
    );
    const phraseTokens = tokens.filter(
      (token, index) =>
        (hasConvertibleModel && /^\d+$/u.test(token)) ||
        index === numericIndex ||
        isMeaningfulModelToken(token) ||
        isSeriesPhraseToken(tokens, index)
    );
    return phraseTokens.join(' ');
  }

  const alphanumericToken = tokens.find(
    (token) => /[a-z]/u.test(token) && /\d/u.test(token)
  );
  if (alphanumericToken) {
    const alphanumericIndex = tokens.indexOf(alphanumericToken);
    const prefixTokens = tokens
      .slice(0, alphanumericIndex)
      .filter(isMeaningfulModelToken);
    const suffixTokens = tokens
      .slice(alphanumericIndex + 1)
      .filter(isMeaningfulModelToken);
    const phraseTokens = [...prefixTokens, alphanumericToken, ...suffixTokens];
    return phraseTokens.join(' ');
  }

  const phraseTokens = tokens.filter((token, index) => {
    return isMeaningfulModelToken(token) || isSeriesPhraseToken(tokens, index);
  });
  return phraseTokens.join(' ') || tokens[0] || null;
}
