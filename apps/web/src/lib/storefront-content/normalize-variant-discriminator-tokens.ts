const SPLIT_VARIANT_UNIT_TOKENS = new Set(['gb', 'tb', 'mb', 'mm', 'inch']);

/** Normalizes tokenized capacity and connectivity variants for guide matching. */
export function normalizeVariantDiscriminatorTokens(tokens: string[]) {
  const normalizedTokens: string[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index] ?? '';
    const nextToken = tokens[index + 1] ?? '';
    if (/^\d+$/u.test(token) && SPLIT_VARIANT_UNIT_TOKENS.has(nextToken)) {
      normalizedTokens.push(`${token}${nextToken}`);
      index += 1;
      continue;
    }
    if (token === 'wi' && nextToken === 'fi') {
      normalizedTokens.push('wifi');
      index += 1;
      continue;
    }
    if (token === 'e' && nextToken === 'sim') {
      normalizedTokens.push('esim');
      index += 1;
      continue;
    }
    if (token === 'bt') {
      normalizedTokens.push('bluetooth');
      continue;
    }
    normalizedTokens.push(token);
  }
  return normalizedTokens;
}
