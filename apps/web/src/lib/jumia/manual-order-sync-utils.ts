export function chunkRecords<T>(records: T[], batchSize: number): T[][] {
  if (!Number.isInteger(batchSize) || batchSize <= 0) {
    throw new RangeError('batchSize must be a positive integer');
  }

  const chunks: T[][] = [];
  for (let index = 0; index < records.length; index += batchSize) {
    chunks.push(records.slice(index, index + batchSize));
  }
  return chunks;
}

export async function mapWithBoundedConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>
): Promise<R[]> {
  if (!Number.isInteger(concurrency) || concurrency <= 0) {
    throw new RangeError('concurrency must be a positive integer');
  }

  const results: R[] = [];
  for (let index = 0; index < values.length; index += concurrency) {
    const batch = values.slice(index, index + concurrency);
    results.push(...(await Promise.all(batch.map(mapper))));
  }
  return results;
}
