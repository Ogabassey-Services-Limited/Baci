const GENERIC_MODEL_MARKER_TOKENS = new Set([
  'edition',
  'model',
  'new',
  'series',
  'version',
]);
const YEAR_TOKEN_PATTERN = /^(?:19|20)\d{2}$/u;
const COMPACT_GAME_CODE_PATTERN = /^([a-z]{2,})(\d{1,4})$/u;

function expandCompactGameCodeTokens(
  tokens: string[],
  preserveGameTitleTokens: boolean
) {
  return preserveGameTitleTokens
    ? tokens.flatMap(
        (token) => token.match(COMPACT_GAME_CODE_PATTERN)?.slice(1) ?? [token]
      )
    : tokens;
}

function isConvertibleInConnector(tokens: string[], index: number) {
  return (
    tokens[index] === 'in' &&
    /^\d+$/u.test(tokens[index - 1] ?? '') &&
    /^\d+$/u.test(tokens[index + 1] ?? '')
  );
}

function isMeaningfulModelToken(
  token: string,
  preserveGameTitleTokens = false
) {
  return (
    !/^\d+$/u.test(token) &&
    (token.length > 1 || (preserveGameTitleTokens && /^[a-z]$/u.test(token))) &&
    (!GENERIC_MODEL_MARKER_TOKENS.has(token) ||
      (preserveGameTitleTokens && token === 'new'))
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

function isGenerationYearToken(tokens: string[], index: number) {
  return (
    YEAR_TOKEN_PATTERN.test(tokens[index] ?? '') &&
    ['gen', 'generation'].includes(tokens[index - 1] ?? '') &&
    tokens
      .slice(index + 1)
      .some((token) => /[a-z]/u.test(token) && /\d/u.test(token))
  );
}

function reorderGenerationModelTokens(tokens: string[]) {
  const generationIndex = tokens.findIndex(
    (token, index) =>
      ['gen', 'generation'].includes(token) &&
      /^\d+$/u.test(tokens[index + 1] ?? '') &&
      /^x\d+$/u.test(tokens[index + 2] ?? '')
  );
  if (generationIndex < 0) {
    return tokens;
  }

  const modelToken = tokens[generationIndex + 2];
  return [
    ...tokens.slice(0, generationIndex),
    modelToken,
    tokens[generationIndex],
    tokens[generationIndex + 1],
    ...tokens.slice(generationIndex + 3),
  ];
}

/** Selects a compact phrase from already-normalized model tokens. */
export function selectProductModelIdentifier(
  inputTokens: string[],
  preserveYearTokens = false
) {
  const tokens = reorderGenerationModelTokens(
    expandCompactGameCodeTokens(inputTokens, preserveYearTokens)
  );
  const hasNonYearAlphanumericModel = tokens.some(
    (token) =>
      !YEAR_TOKEN_PATTERN.test(token) &&
      /[a-z]/u.test(token) &&
      /\d/u.test(token)
  );
  const numericIndex = tokens.findLastIndex(
    (token, index) =>
      /^\d+$/u.test(token) &&
      (preserveYearTokens ||
        !YEAR_TOKEN_PATTERN.test(token) ||
        !hasNonYearAlphanumericModel ||
        isGenerationYearToken(tokens, index))
  );
  if (numericIndex >= 0) {
    const hasConvertibleModel = tokens.some((_, index) =>
      isConvertibleInConnector(tokens, index)
    );
    const phraseTokens = tokens.filter(
      (token, index) =>
        ((hasConvertibleModel || preserveYearTokens) && /^\d+$/u.test(token)) ||
        index === numericIndex ||
        isMeaningfulModelToken(token, preserveYearTokens) ||
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
      .filter((token) => isMeaningfulModelToken(token, preserveYearTokens));
    const suffixTokens = tokens
      .slice(alphanumericIndex + 1)
      .filter((token) => isMeaningfulModelToken(token, preserveYearTokens));
    const phraseTokens = [...prefixTokens, alphanumericToken, ...suffixTokens];
    return phraseTokens.join(' ');
  }

  const phraseTokens = tokens.filter((token, index) => {
    return (
      isMeaningfulModelToken(token, preserveYearTokens) ||
      isSeriesPhraseToken(tokens, index)
    );
  });
  return phraseTokens.join(' ') || tokens[0] || null;
}
