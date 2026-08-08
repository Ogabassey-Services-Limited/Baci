const ORDINAL_PATTERN = /^(\d+)(?:st|nd|rd|th)$/u;

function stripOptionalOrdinalGenerationConnectorSuffix(tokens: string[]) {
  const generationIndex = tokens.findIndex(
    (token, index) =>
      ORDINAL_PATTERN.test(token) &&
      ['gen', 'generation'].includes(tokens[index + 1] ?? '') &&
      tokens[index + 2] === 'type' &&
      tokens[index + 3] === 'c' &&
      index + 4 === tokens.length
  );
  if (generationIndex < 0) {
    return tokens;
  }

  const generation = tokens[generationIndex]?.match(ORDINAL_PATTERN)?.[1];
  return generation
    ? [...tokens.slice(0, generationIndex), generation]
    : tokens;
}

function stripSplitCapacitySuffix(tokens: string[]) {
  const normalizedTokens: string[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index] ?? '';
    if (
      /^\d+$/u.test(token) &&
      ['gb', 'tb', 'mb'].includes(tokens[index + 1] ?? '')
    ) {
      index += 1;
      continue;
    }
    normalizedTokens.push(token);
  }
  return normalizedTokens;
}

export function stripModelMetadataSuffixes(tokens: string[]) {
  return stripSplitCapacitySuffix(
    stripOptionalOrdinalGenerationConnectorSuffix(tokens)
  );
}
