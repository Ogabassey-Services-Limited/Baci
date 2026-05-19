// Namespace import as a value (not type-only) because we use
// `crypto.createPrivateKey` at runtime and `crypto.KeyObject` as a type.
import * as crypto from 'node:crypto';
import 'server-only';
import type { z } from 'zod';
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

export type SupabaseAgenticPrivateJwk = z.infer<
  typeof supabaseAgenticJwtPrivateJwkSchema
>;

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
      // Cast the full input object so we don't have to name the inner `key`
      // type, which differs between hoisted @types/node versions.
      const keyInput = {
        format: 'jwk',
        key: jwk,
      } as unknown as Parameters<typeof crypto.createPrivateKey>[0];
      cachedPrivateJwkMaterial = {
        jwk,
        keyObject: crypto.createPrivateKey(keyInput),
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
