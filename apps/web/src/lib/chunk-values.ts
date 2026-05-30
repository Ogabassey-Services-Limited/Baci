export function chunkValues<T>(items: readonly T[], size: number): T[][] {
  const chunkSize = Number.isFinite(size) ? Math.trunc(size) : 0;
  if (chunkSize <= 0) return items.length === 0 ? [] : [Array.from(items)];

  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }

  return chunks;
}
