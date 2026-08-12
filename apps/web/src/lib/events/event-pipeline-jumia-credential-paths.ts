const envPath = 'apps/web/src/env.ts';
const callbackRoot = 'apps/web/src/app/api/marketplace/jumia/callback';
const callbackFlow = `${callbackRoot}/callback-flow.ts`;
const callbackHandler = `${callbackRoot}/handler.ts`;
const callbackRuntime = `${callbackRoot}/runtime.ts`;
const callbackRuntimeImpl = `${callbackRoot}/runtime-impl.ts`;
const jumiaHelpers = 'apps/web/src/lib/jumia/helpers.ts';

export const eventPipelineJumiaCredentialPaths = [
  [callbackFlow, callbackRuntime, callbackRuntimeImpl, envPath],
  [callbackFlow, callbackRuntime, callbackRuntimeImpl, jumiaHelpers, envPath],
  [
    callbackHandler,
    callbackFlow,
    callbackRuntime,
    callbackRuntimeImpl,
    envPath,
  ],
  [
    callbackHandler,
    callbackFlow,
    callbackRuntime,
    callbackRuntimeImpl,
    jumiaHelpers,
    envPath,
  ],
  [`${callbackRoot}/oauth-diagnostic.ts`, jumiaHelpers, envPath],
  [`${callbackRoot}/oauth-exchange.ts`, jumiaHelpers, envPath],
  [
    `${callbackRoot}/route.ts`,
    callbackHandler,
    callbackFlow,
    callbackRuntime,
    callbackRuntimeImpl,
    envPath,
  ],
  [
    `${callbackRoot}/route.ts`,
    callbackHandler,
    callbackFlow,
    callbackRuntime,
    callbackRuntimeImpl,
    jumiaHelpers,
    envPath,
  ],
  [callbackRuntimeImpl, envPath],
  [callbackRuntimeImpl, jumiaHelpers, envPath],
  [callbackRuntime, callbackRuntimeImpl, envPath],
  [callbackRuntime, callbackRuntimeImpl, jumiaHelpers, envPath],
  [
    'apps/web/src/app/api/marketplace/jumia/connect/oauth-diagnostic.ts',
    jumiaHelpers,
    envPath,
  ],
] as const;
