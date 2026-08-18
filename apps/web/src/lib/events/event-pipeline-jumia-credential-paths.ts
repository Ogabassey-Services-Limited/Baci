const envPath = 'apps/web/src/env.ts';
const adminPath = 'apps/web/src/lib/supabase/admin.ts';
const client = 'apps/web/src/lib/jumia/client.ts';
const clientConfig = 'apps/web/src/lib/jumia/jumia-client-config.ts';
const tokenPersistence =
  'apps/web/src/lib/jumia/jumia-client-token-persistence.ts';
const purgeDiscoveries =
  'apps/web/src/lib/jumia/purge-expired-jumia-self-authorization-discoveries.ts';
const jumiaHelpers = 'apps/web/src/lib/jumia/helpers.ts';
const callbackRoot = 'apps/web/src/app/api/marketplace/jumia/callback';
const callbackFlow = `${callbackRoot}/callback-flow.ts`;
const callbackHandler = `${callbackRoot}/handler.ts`;
const callbackRuntime = `${callbackRoot}/runtime.ts`;
const callbackRuntimeImpl = `${callbackRoot}/runtime-impl.ts`;

const clientCredentialSuffixes = [
  [client, envPath],
  [client, clientConfig, envPath],
  [client, tokenPersistence, envPath],
  [client, tokenPersistence, jumiaHelpers, envPath],
] as const;

const jumiaApiRoutesUsingClient = [
  'apps/web/src/app/api/marketplace/jumia/actions/route.ts',
  'apps/web/src/app/api/marketplace/jumia/brands/route.ts',
  'apps/web/src/app/api/marketplace/jumia/categories/route.ts',
  'apps/web/src/app/api/marketplace/jumia/connect/exchange/route.ts',
  'apps/web/src/app/api/marketplace/jumia/consignment/route.ts',
  'apps/web/src/app/api/marketplace/jumia/orders/[id]/items/route.ts',
  'apps/web/src/app/api/marketplace/jumia/orders/route.ts',
  'apps/web/src/app/api/marketplace/jumia/products/export/route.ts',
  'apps/web/src/app/api/marketplace/jumia/products/feed-status/route.ts',
  'apps/web/src/app/api/marketplace/jumia/products/import/route.ts',
  'apps/web/src/app/api/marketplace/jumia/products/route.ts',
  'apps/web/src/app/api/marketplace/jumia/products/stock/route.ts',
  'apps/web/src/app/api/marketplace/jumia/products/update/route.ts',
] as const;

function withPrefix(
  prefix: readonly string[],
  suffixes: readonly (readonly string[])[]
): readonly (readonly string[])[] {
  return suffixes.map((suffix) => [...prefix, ...suffix]);
}

const callbackRuntimeImplPaths = withPrefix(
  [callbackRuntimeImpl],
  [[envPath], [jumiaHelpers, envPath], ...clientCredentialSuffixes]
);

const callbackRuntimePaths = withPrefix(
  [callbackRuntime, callbackRuntimeImpl],
  [[envPath], [jumiaHelpers, envPath], ...clientCredentialSuffixes]
);

const callbackFlowPaths = withPrefix(
  [callbackFlow, callbackRuntime, callbackRuntimeImpl],
  [[envPath], [jumiaHelpers, envPath], ...clientCredentialSuffixes]
);

const callbackHandlerPaths = withPrefix(
  [callbackHandler, callbackFlow, callbackRuntime, callbackRuntimeImpl],
  [[envPath], [jumiaHelpers, envPath], ...clientCredentialSuffixes]
);

const callbackRoutePaths = withPrefix(
  [
    `${callbackRoot}/route.ts`,
    callbackHandler,
    callbackFlow,
    callbackRuntime,
    callbackRuntimeImpl,
  ],
  [[envPath], [jumiaHelpers, envPath], ...clientCredentialSuffixes]
);

export { clientCredentialSuffixes, jumiaApiRoutesUsingClient };

export const eventPipelineJumiaCredentialPaths = [
  ...callbackRuntimeImplPaths,
  ...callbackRuntimePaths,
  ...callbackFlowPaths,
  ...callbackHandlerPaths,
  ...callbackRoutePaths,
  [`${callbackRoot}/oauth-diagnostic.ts`, jumiaHelpers, envPath],
  [`${callbackRoot}/oauth-exchange.ts`, jumiaHelpers, envPath],
  [
    'apps/web/src/app/api/marketplace/jumia/connect/oauth-diagnostic.ts',
    jumiaHelpers,
    envPath,
  ],
  ...jumiaApiRoutesUsingClient.flatMap((route) =>
    withPrefix(
      [route],
      [...clientCredentialSuffixes, [client, jumiaHelpers, envPath]]
    )
  ),
  [
    'apps/web/src/app/api/marketplace/jumia/products/route.ts',
    jumiaHelpers,
    envPath,
  ],
  [
    'apps/web/src/app/api/marketplace/jumia/products/feed-status/route.ts',
    jumiaHelpers,
    envPath,
  ],
  [client, envPath],
  [client, clientConfig, envPath],
  [client, tokenPersistence, envPath],
  [client, tokenPersistence, jumiaHelpers, envPath],
  [clientConfig, envPath],
  [tokenPersistence, envPath],
  [tokenPersistence, jumiaHelpers, envPath],
  ...withPrefix(
    ['apps/web/src/lib/jumia/order-sync.ts'],
    clientCredentialSuffixes
  ),
  ['apps/web/src/lib/jumia/self-authorization.ts', jumiaHelpers, envPath],
  [
    'apps/web/src/app/api/cron/purge-jumia-self-authorization-discoveries/route.ts',
    purgeDiscoveries,
    adminPath,
  ],
  [
    'apps/web/src/app/api/cron/purge-jumia-self-authorization-discoveries/route.ts',
    purgeDiscoveries,
    adminPath,
    envPath,
  ],
] as const;
