// Namespace import as a value (not type-only) so `crypto.webcrypto.JsonWebKey`
// resolves to the exact type `createPrivateKey({ format: 'jwk' })` expects
// via `JsonWebKeyInput.key` under @types/node 25.x. The global `JsonWebKey`
// from lib.dom.d.ts is structurally similar but nominally distinct on some
// CI toolchains, breaking the typecheck.
// biome-ignore lint/style/useImportType: needs to be a value import — see comment above
import * as crypto from 'node:crypto';
import 'server-only';
import { getSupabaseAgenticJwtPrivateJwk, getSupabaseJwtSecret } from '@/env';
import { logger } from '@/lib/logger';
import { sanitizeForLog } from '@/lib/sanitize-core';
import { supabaseAgenticJwtPrivateJwkSchema } from '@/schemas/supabase-agentic-jwt-private-jwk';

export type AgenticJwtSigningMaterial =
  | { secret: string; type: 'legacy-secret' }
  | {
      jwk: SupabaseAgenticPrivateJwk;
      keyObject: crypto.KeyObject;
      type: 'private-jwk';
    };

export type SupabaseAgenticPrivateJwk = crypto.webcrypto.JsonWebKey & {
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
        // Explicit cast: TypeScript 5.9.x (used on CI) treats
        // `crypto.webcrypto.JsonWebKey & { alg?; kid? }` as nominally
        // distinct from the base `crypto.webcrypto.JsonWebKey` parameter
        // even though they're structurally identical. TS 6.x (local) is
        // happy without the cast. Casting via `as crypto.webcrypto.JsonWebKey`
        // is safe because `SupabaseAgenticPrivateJwk` literally IS that type
        // plus optional fields.
        keyObject: crypto.createPrivateKey({
          format: 'jwk',
          key: jwk as crypto.webcrypto.JsonWebKey,
        }),
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
