function normalizeSqlIdentifiers(source: string): string {
  return source
    .replace(/"((?:""|[^"])*)"/g, (_match, identifier: string) =>
      identifier.replace(/""/g, '"')
    )
    .replace(/\s+/g, ' ');
}

export function sqlWritesProductDescription(source: string): boolean {
  const normalizedSource = normalizeSqlIdentifiers(source);
  const productTable = '(?:(?:public\\s*\\.\\s*)?products)';
  return new RegExp(
    `INSERT\\s+INTO\\s+${productTable}\\s*(?:AS\\s+\\w+\\s*)?\\([\\s\\S]*?\\bdescription\\b[\\s\\S]*?\\)\\s*VALUES|UPDATE\\s+${productTable}\\b[\\s\\S]*?\\bSET\\b[\\s\\S]*?\\b(?:\\w+\\.)?description\\s*=`,
    'i'
  ).test(normalizedSource);
}
