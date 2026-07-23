import { isProviderCoolingDown } from './provider-cooldown';
import type { TextProvider } from './text-provider-chain';

/**
 * Picks which providers a chain walk should actually attempt.
 *
 * Drops opportunistic providers (contended free pools — only the builder
 * route's explicit deadline budgeting makes them worth consulting), then
 * skips any provider currently parked by a rate-limit cooldown so the walk
 * goes straight to a link that can serve.
 *
 * If EVERY remaining provider is cooling down, the full list is returned
 * rather than an empty one: cooldowns are a per-instance heuristic and may be
 * stale (a cold start forgets them, another instance's traffic set them), so a
 * doomed-looking attempt still beats failing the request without trying.
 */
export function selectAttemptableProviders(
  chain: TextProvider[]
): TextProvider[] {
  const eligible = chain.filter((provider) => !provider.opportunistic);
  const available = eligible.filter(
    (provider) => !isProviderCoolingDown(provider.name)
  );
  return available.length > 0 ? available : eligible;
}
