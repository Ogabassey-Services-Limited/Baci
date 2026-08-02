function isConvertibleInConnector(tokens: string[], index: number) {
  return (
    tokens[index] === 'in' &&
    /^\d+$/u.test(tokens[index - 1] ?? '') &&
    /^\d+$/u.test(tokens[index + 1] ?? '')
  );
}

function isDimensionToken(tokens: string[], index: number) {
  const token = tokens[index] ?? '';
  if (!/^\d+$/u.test(token)) {
    return false;
  }
  const previousToken = tokens[index - 1] ?? '';
  const nextToken = tokens[index + 1] ?? '';
  const hasConvertibleNeighbor =
    (previousToken === 'in' && isConvertibleInConnector(tokens, index - 1)) ||
    (nextToken === 'in' && isConvertibleInConnector(tokens, index + 1));
  if (hasConvertibleNeighbor) {
    return false;
  }
  return (
    ['in', 'inch'].includes(previousToken) || ['in', 'inch'].includes(nextToken)
  );
}

const LAPTOP_CATEGORY_SLUGS = new Set(['gaming-laptops', 'laptops']);
const NUMERIC_PROCESSOR_SUFFIX_PATTERN = /^\d{4,}[uhtpkgfy]$/u;

function isNumericLaptopProcessorSuffix(tokens: string[], index: number) {
  return NUMERIC_PROCESSOR_SUFFIX_PATTERN.test(tokens[index] ?? '');
}

function stripTrailingLaptopProcessorTier(
  tokens: string[],
  categorySlug: string
) {
  if (!LAPTOP_CATEGORY_SLUGS.has(categorySlug)) {
    return tokens;
  }
  const processorIndex = tokens.findIndex(
    (token, index) =>
      ((token === 'ultra' || token === 'rtx') &&
        /^\d+$/u.test(tokens[index + 1] ?? '')) ||
      (token === 'core' && /^i[3579]$/u.test(tokens[index + 1] ?? '')) ||
      /^i[3579]$/u.test(token) ||
      isNumericLaptopProcessorSuffix(tokens, index)
  );
  if (processorIndex < 1) {
    return tokens;
  }
  const processorStartIndex =
    isNumericLaptopProcessorSuffix(tokens, processorIndex) &&
    /^\d{1,2}$/u.test(tokens[processorIndex - 1] ?? '')
      ? processorIndex - 1
      : processorIndex;
  return tokens.slice(0, processorStartIndex);
}

export const modelTokenMatchers = {
  isConvertibleInConnector,
  isDimensionToken,
  stripTrailingLaptopProcessorTier,
};
