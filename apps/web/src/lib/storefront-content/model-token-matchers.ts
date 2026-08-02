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

export const modelTokenMatchers = {
  isConvertibleInConnector,
  isDimensionToken,
};
