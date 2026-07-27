let storefrontBuildReadTail = Promise.resolve();

/** Serializes public Supabase reads across clients in one build worker. */
export function createStorefrontBuildReadFetch(fetcher: typeof fetch) {
  return (async (...args: Parameters<typeof fetch>) => {
    const predecessor = storefrontBuildReadTail;
    let release: (() => void) | undefined;
    storefrontBuildReadTail = new Promise<void>((resolve) => {
      release = resolve;
    });

    await predecessor;
    try {
      return await fetcher(...args);
    } finally {
      release?.();
    }
  }) satisfies typeof fetch;
}
