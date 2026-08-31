import type { StorefrontReadResult } from '../storefront-read-result';
import {
  type AbortableQuery,
  runStorefrontPdpSemanticRpc,
  type StorefrontPdpSemanticRpcOptions,
} from './storefront-pdp-semantic-rpc';

export const STOREFRONT_PDP_SEMANTIC_FAILURE_COOLDOWN_MS = 30_000;

const DEFAULT_MAX_ENTRIES = 128;

export interface StorefrontPdpSemanticReadCooldown {
  clear(scope: string): void;
  isCoolingDown(scope: string, now?: number): boolean;
  markFailure(scope: string, now?: number): void;
  reset(): void;
}

/**
 * Keeps a transient semantic-read failure from amplifying across PDP
 * requests. This is deliberately process-local: it is a load backstop for an
 * optional section, not a correctness or availability decision.
 */
export function createStorefrontPdpSemanticReadCooldown(options?: {
  cooldownMs?: number;
  maxEntries?: number;
}): StorefrontPdpSemanticReadCooldown {
  const cooldownMs =
    options?.cooldownMs ?? STOREFRONT_PDP_SEMANTIC_FAILURE_COOLDOWN_MS;
  const maxEntries = options?.maxEntries ?? DEFAULT_MAX_ENTRIES;
  const expiresAtByScope = new Map<string, number>();

  const pruneExpired = (now: number) => {
    for (const [scope, expiresAt] of expiresAtByScope) {
      if (expiresAt <= now) expiresAtByScope.delete(scope);
    }
  };

  return {
    clear(scope) {
      expiresAtByScope.delete(scope);
    },
    isCoolingDown(scope, now = Date.now()) {
      const expiresAt = expiresAtByScope.get(scope);
      if (expiresAt === undefined) return false;
      if (expiresAt <= now) {
        expiresAtByScope.delete(scope);
        return false;
      }
      return true;
    },
    markFailure(scope, now = Date.now()) {
      pruneExpired(now);
      if (expiresAtByScope.size >= maxEntries && !expiresAtByScope.has(scope)) {
        const oldestScope = expiresAtByScope.keys().next().value;
        if (oldestScope !== undefined) expiresAtByScope.delete(oldestScope);
      }
      expiresAtByScope.set(scope, now + cooldownMs);
    },
    reset() {
      expiresAtByScope.clear();
    },
  };
}

export const storefrontPdpSemanticReadCooldown =
  createStorefrontPdpSemanticReadCooldown();

/** Runs the optional RPC and parks only native timeout failures for this scope. */
export async function runStorefrontPdpSemanticRpcWithCooldown<T>(
  query: AbortableQuery<T>,
  options: StorefrontPdpSemanticRpcOptions,
  scope: string
) {
  try {
    return await runStorefrontPdpSemanticRpc(query, options);
  } catch (error) {
    if (isStorefrontPdpSemanticTimeout(error)) {
      storefrontPdpSemanticReadCooldown.markFailure(scope);
    }
    throw error;
  }
}

export function createStorefrontPdpSemanticCooldownResult(): StorefrontReadResult<never> {
  return {
    status: 'unavailable',
    error: {
      kind: 'timeout',
      operation: 'pdp_semantic_enrichment',
      retryable: true,
    },
  };
}

export function isStorefrontPdpSemanticTimeout(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const name = Reflect.get(error, 'name');
  if (name === 'TimeoutError') return true;
  const message = Reflect.get(error, 'message');
  return (
    typeof message === 'string' &&
    /(?:timed out|timeout|aborted due to timeout)/i.test(message)
  );
}
