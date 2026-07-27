const MAX_STOREFRONT_BUILD_READS = 3;
let activeStorefrontBuildReads = 0;
const storefrontBuildReadWaiters: Array<() => void> = [];

async function acquireStorefrontBuildReadSlot() {
  if (activeStorefrontBuildReads < MAX_STOREFRONT_BUILD_READS) {
    activeStorefrontBuildReads += 1;
    return;
  }
  await new Promise<void>((resolve) => {
    storefrontBuildReadWaiters.push(resolve);
  });
}

function releaseStorefrontBuildReadSlot() {
  const next = storefrontBuildReadWaiters.shift();
  if (next) next();
  else activeStorefrontBuildReads -= 1;
}

/** Bounds public Supabase reads across clients in one build worker. */
export function createStorefrontBuildReadFetch(fetcher: typeof fetch) {
  return (async (...args: Parameters<typeof fetch>) => {
    await acquireStorefrontBuildReadSlot();
    try {
      return await fetcher(...args);
    } finally {
      releaseStorefrontBuildReadSlot();
    }
  }) satisfies typeof fetch;
}
