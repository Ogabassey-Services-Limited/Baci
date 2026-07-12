export async function settleWithConcurrency<T>(
  items: readonly T[],
  concurrency: number,
  operation: (item: T) => Promise<void>
): Promise<PromiseSettledResult<void>[]> {
  const limit = Math.max(1, Math.floor(concurrency));
  const outcomes: PromiseSettledResult<void>[] = [];

  for (let offset = 0; offset < items.length; offset += limit) {
    const chunk = items.slice(offset, offset + limit);
    outcomes.push(
      ...(await Promise.allSettled(
        chunk.map((item) => Promise.resolve().then(() => operation(item)))
      ))
    );
  }

  return outcomes;
}
