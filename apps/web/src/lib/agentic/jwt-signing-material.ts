import { createPrivateKey, type KeyObject, type webcrypto } from 'node:crypto';

// `webcrypto.JsonWebKey` matches the param type expected by createPrivateKey
// (`JsonWebKeyInput.key`) in @types/node 25.x. The global `JsonWebKey` from
// lib.dom.d.ts is structurally similar but TypeScript treats them as distinct
// in some toolchains, breaking CI typechecks.
type JsonWebKey = webcrypto.JsonWebKey;
import 'server-only';
import { getSupabaseAgenticJwtPrivateJwk, getSupabaseJwtSecret } from '@/env';
import { logger } from '@/lib/logger';
import { sanitizeForLog } from '@/lib/sanitize-core';
import { supabaseAgenticJwtPrivateJwkSchema } from '@/schemas/supabase-agentic-jwt-private-jwk';

export type AgenticJwtSigningMaterial =
  | { secret: string; type: 'legacy-secret' }
  | {
      jwk: SupabaseAgenticPrivateJwk;
      keyObject: KeyObject;
      type: 'private-jwk';
    };

export type SupabaseAgenticPrivateJwk = JsonWebKey & {
  alg?: string;
  kid?: string;
};

let cachedPrivateJwkRaw: string | null = null;
const INVALID_PRIVATE_JWK_MATERIAL = Symbol('invalid-private-jwk-material');

type CachedPrivateJwkMaterial =
  | Extract<AgenticJwtSigningMaterial, { type: 'private-jwk' }>
  | typeof INVALID_PRIVATE_JWK_MATERIAL
  | null;

let cachedPrivateJwkMaterial: CachedPrivateJwkMaterial = null;

export function getAgenticJwtSigningMaterial(): AgenticJwtSigningMaterial {
  const privateJwk = getSupabaseAgenticJwtPrivateJwk();
  if (privateJwk) {
    if (cachedPrivateJwkRaw === privateJwk) {
      if (cachedPrivateJwkMaterial === INVALID_PRIVATE_JWK_MATERIAL) {
        return { secret: getSupabaseJwtSecret(), type: 'legacy-secret' };
      }

      if (cachedPrivateJwkMaterial) {
        return cachedPrivateJwkMaterial;
      }
    }

    try {
      // Process-scoped cache. Key rotation is picked up when the raw env value changes
      // via redeploy or runtime env refresh.
      const jwk = parseSupabaseAgenticPrivateJwk(privateJwk);
      cachedPrivateJwkMaterial = {
        jwk,
        keyObject: createPrivateKey({ format: 'jwk', key: jwk }),
        type: 'private-jwk',
      };
      cachedPrivateJwkRaw = privateJwk;

      return cachedPrivateJwkMaterial;
    } catch (error) {
      cachedPrivateJwkMaterial = INVALID_PRIVATE_JWK_MATERIAL;
      cachedPrivateJwkRaw = privateJwk;
      logger.warn({
        error: sanitizeForLog(
          error instanceof Error
            ? { message: error.message, name: error.name }
            : error
        ),
        message:
          'Agentic JWT private JWK is invalid; falling back to legacy JWT secret',
      });
    }
  }

  return { secret: getSupabaseJwtSecret(), type: 'legacy-secret' };
}

export function hasUsableAgenticJwtSigningMaterial(): boolean {
  try {
    getAgenticJwtSigningMaterial();
    return true;
  } catch (error) {
    logger.warn({
      error: sanitizeForLog(
        error instanceof Error
          ? { message: error.message, name: error.name }
          : error
      ),
      message: 'Agentic JWT signing material is unavailable',
    });
    return false;
  }
}

function parseSupabaseAgenticPrivateJwk(
  rawPrivateJwk: string
): SupabaseAgenticPrivateJwk {
  return supabaseAgenticJwtPrivateJwkSchema.parse(rawPrivateJwk);
}
