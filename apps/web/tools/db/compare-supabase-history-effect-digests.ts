import type { SupabaseHistoryEffectComparisonMode } from './supabase-history-replay-types';

type EffectDigest = {
  category: string;
  identity: string;
  sha256: string;
};

function identityKey(value: Pick<EffectDigest, 'category' | 'identity'>) {
  return `${value.category}\0${value.identity}`;
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function digestMap(values: readonly EffectDigest[]): Map<string, EffectDigest> {
  const result = new Map<string, EffectDigest>();
  for (const value of values) {
    const key = identityKey(value);
    if (result.has(key)) throw new Error('duplicate effect digest identity');
    result.set(key, value);
  }
  return result;
}

export function compareSupabaseHistoryEffectDigests(options: {
  localDigestVector: readonly EffectDigest[];
  mode: SupabaseHistoryEffectComparisonMode;
  productionDigestVector: readonly EffectDigest[];
  productionEffectSha256: string;
}) {
  const local = digestMap(options.localDigestVector);
  const production = digestMap(options.productionDigestVector);
  const keys = [...new Set([...local.keys(), ...production.keys()])].sort(
    compareText
  );
  const changedComponents = keys.flatMap((key) => {
    const localDigest = local.get(key);
    const productionDigest = production.get(key);
    if (localDigest?.sha256 === productionDigest?.sha256) return [];
    const identity = localDigest ?? productionDigest;
    if (!identity) return [];
    return [
      {
        category: identity.category,
        identity: identity.identity,
        localSha256: localDigest?.sha256 ?? null,
        productionSha256: productionDigest?.sha256 ?? null,
      },
    ];
  });
  if (options.mode === 'enforce' && changedComponents.length > 0) {
    throw new Error('production effect receipt mismatch');
  }
  return {
    changedComponents,
    converged: options.mode === 'enforce' && changedComponents.length === 0,
    mode: options.mode,
    productionEffectSha256: options.productionEffectSha256,
  };
}
