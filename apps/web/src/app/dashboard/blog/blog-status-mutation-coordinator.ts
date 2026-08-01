interface CoordinatedMutation<TResult, TBaseline> {
  clear: () => void;
  confirm: (baseline: TBaseline) => void;
  confirmed: () => TBaseline;
  isLatest: () => boolean;
  result: Promise<TResult>;
}

export function createBlogStatusMutationCoordinator<TBaseline>() {
  const baselines = new Map<string, TBaseline>();
  const generations = new Map<string, number>();
  const queues = new Map<string, Promise<unknown>>();

  return {
    enqueue<TResult>(
      key: string,
      initialBaseline: TBaseline,
      operation: () => Promise<TResult>
    ): CoordinatedMutation<TResult, TBaseline> {
      if (!baselines.has(key)) baselines.set(key, initialBaseline);
      const generation = (generations.get(key) ?? 0) + 1;
      generations.set(key, generation);
      const previous = queues.get(key) ?? Promise.resolve();
      const result = previous.catch(() => undefined).then(operation);
      queues.set(key, result);

      return {
        clear: () => {
          if (queues.get(key) === result) {
            baselines.delete(key);
            queues.delete(key);
          }
        },
        confirm: (baseline) => baselines.set(key, baseline),
        confirmed: () => baselines.get(key) ?? initialBaseline,
        isLatest: () => generations.get(key) === generation,
        result,
      };
    },
  };
}
