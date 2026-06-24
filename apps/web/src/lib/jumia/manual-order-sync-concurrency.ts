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
