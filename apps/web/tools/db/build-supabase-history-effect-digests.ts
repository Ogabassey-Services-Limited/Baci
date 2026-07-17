import { createHash } from 'node:crypto';
import { canonicalReplayEffectJson } from './canonical-replay-effect-json';

type SupabaseHistoryEffectComponent = {
  category: string;
  identity: string;
  value: unknown;
};

type SupabaseHistoryEffectDigest = {
  category: string;
  identity: string;
  sha256: string;
};

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function compareDigestIdentity(
  left: SupabaseHistoryEffectDigest,
  right: SupabaseHistoryEffectDigest
): number {
  return (
    compareText(left.category, right.category) ||
    compareText(left.identity, right.identity)
  );
}

export function buildSupabaseHistoryEffectDigests(
  components: readonly SupabaseHistoryEffectComponent[]
) {
  const identitiesByCategory = new Map<string, Set<string>>();
  for (const { category, identity } of components) {
    const identities = identitiesByCategory.get(category) ?? new Set<string>();
    if (identities.has(identity)) {
      throw new Error(
        `Duplicate Supabase history effect component: ${category} ${identity}`
      );
    }
    identities.add(identity);
    identitiesByCategory.set(category, identities);
  }

  const digestVector = components
    .map(({ category, identity, value }) => ({
      category,
      identity,
      sha256: sha256(canonicalReplayEffectJson(value)),
    }))
    .sort(compareDigestIdentity);

  return {
    digestVector,
    effectSha256: sha256(canonicalReplayEffectJson(digestVector)),
  };
}
