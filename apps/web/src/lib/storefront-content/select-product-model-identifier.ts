const GENERIC_MODEL_MARKER_TOKENS = new Set([
  'edition',
  'model',
  'new',
  'series',
  'version',
]);

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

/** Selects a compact phrase from already-normalized model tokens. */
export function selectProductModelIdentifier(tokens: string[]) {
  const numericIndex = tokens.findLastIndex((token) => /^\d+$/u.test(token));
  if (numericIndex >= 0) {
    const hasConvertibleModel = tokens.some((_, index) =>
      isConvertibleInConnector(tokens, index)
    );
    const phraseTokens = tokens.filter(
      (token, index) =>
        (hasConvertibleModel && /^\d+$/u.test(token)) ||
        index === numericIndex ||
        isMeaningfulModelToken(token)
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
    const isSeriesMarker =
      token === 'series' && /^[a-z]$/u.test(tokens[index + 1] ?? '');
    const followsSeriesMarker =
      index > 0 && tokens[index - 1] === 'series' && /^[a-z]$/u.test(token);
    return (
      isMeaningfulModelToken(token) || isSeriesMarker || followsSeriesMarker
    );
  });
  return phraseTokens.join(' ') || tokens[0] || null;
}
