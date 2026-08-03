export type ReadTokenRevocationReadbackFactory = (
  input: Readonly<{ runId: string; stateDir: string }>
) => unknown | Promise<unknown>;

const factoryNames = [
  'createRevocationReadbackClient',
  'createReadTokenRevocationReadback',
  'createRevocationReadbackDependencies',
] as const;

/** Reads the one reviewed read-token-revocation factory accepted by recovery. */
export function getReadTokenRevocationReadbackFactory(
  loaded: unknown
): ReadTokenRevocationReadbackFactory {
  if (!loaded || typeof loaded !== 'object')
    throw new Error('authenticated read-token revocation module is invalid');
  for (const name of factoryNames) {
    const factory = (loaded as Record<string, unknown>)[name];
    if (typeof factory === 'function')
      return factory as ReadTokenRevocationReadbackFactory;
  }
  throw new Error('authenticated read-token revocation module is invalid');
}
