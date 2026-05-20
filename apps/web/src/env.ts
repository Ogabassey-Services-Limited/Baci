// src/env.ts
import z from 'zod';
import { buildLlmBearerAuthHeader } from '@/lib/llm-auth';
import { supabaseAgenticJwtPrivateJwkStringSchema } from '@/schemas/supabase-agentic-jwt-private-jwk';

/**
 * A type-safe and validated way to access environment variables.
 * This is the single source of truth for all environment variables in the app.
 *
 * 2026 Best Practice: Schema-based validation using Zod.
 */

const booleanStringSchema = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true');

const defaultFalseBooleanStringSchema = z.preprocess(
  (value) => (value === undefined ? 'false' : value),
  booleanStringSchema
);

const optionalTrimmedStringSchema = z.preprocess((value) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed || undefined;
}, z.string().optional());

const DEFAULT_CAC_API_URL =
  'https://authapp.cac.gov.ng/name_similarity_app/api/public_search/search';
const DEFAULT_CAC_TIN_API_BASE_URL =
  'https://icrp.cac.gov.ng/tin_service/api/v1/public/tin';
const DEFAULT_TERMINAL_IDEMPOTENCY_RECORD_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Strict 127.0.0.0/8 hostname matcher. Anchored regex on the URL `hostname`
 * (already brackets-stripped by the `URL` parser) so only true IPv4 loopback
 * literals match — `127.example.com`, `127malicious`, `127.0.0.1.evil.com`
 * are all rejected. Each octet is 0–255; the first is fixed at 127.
 */
const IPV4_LOOPBACK_REGEX =
  /^127\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

/**
 * Returns true for URLs that are safe to reach from this server:
 *   - `https://...` for any host
 *   - `http://...` for loopback only (localhost, 127.0.0.0/8, ::1)
 *
 * The loopback exception is restricted to the `http:` scheme so callers
 * cannot smuggle `ftp://localhost` or `file://127.0.0.1` past the check.
 * Invalid URLs return false rather than throwing so the surrounding Zod
 * refine produces a clean validation error.
 *
 * Exported for direct unit testing — the schema below wraps it for reuse.
 */
export function isAllowedLlmServerUrl(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }

  const protocol = parsed.protocol;
  // `new URL('http://[::1]:11500').hostname` returns the unbracketed form
  // '::1' in spec-compliant runtimes (Node ≥18, modern browsers). Older
  // runtimes returned '[::1]'; accept both defensively. Lowercase to make
  // 'LOCALHOST' / 'Localhost' equivalent to 'localhost'.
  const host = parsed.hostname.toLowerCase();
  const isLoopback =
    host === 'localhost' ||
    host === '::1' ||
    host === '[::1]' ||
    IPV4_LOOPBACK_REGEX.test(host);

  if (isLoopback) {
    // HTTPS on loopback is also fine — it's strictly tighter than HTTP.
    return protocol === 'http:' || protocol === 'https:';
  }

  return protocol === 'https:';
}

/**
 * URL schema that allows HTTP only when pointed at a loopback host.
 * Reused by every "self-hosted backend on a known host" env var (Ollama,
 * llama-server, etc.) so the policy is enforced consistently and a future
 * tweak (e.g. allow `.localhost` TLD or unix sockets) lands in one place.
 */
function httpsOrLocalhostUrl(name: string) {
  return z
    .string()
    .url()
    .refine(isAllowedLlmServerUrl, {
      message: `${name} must use HTTPS (except for http:// on loopback)`,
    });
}

const serverSchema = z
  .object({
    // Supabase (Server Admin)
    SUPABASE_SERVICE_ROLE_KEY: z
      .string()
      .min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
    SUPABASE_JWT_SECRET: optionalTrimmedStringSchema,
    SUPABASE_AGENTIC_JWT_PRIVATE_JWK: supabaseAgenticJwtPrivateJwkStringSchema,

    // Blog
    BLOG_PREVIEW_SECRET: z.string().default('dev-preview-secret'), // Fallback for dev

    // Payments (Server keys)
    KORAPAY_SECRET_KEY: z.string().optional(),
    JUICYWAY_SECRET_KEY: z.string().optional(),
    PAYSTACK_SECRET_KEY: z.string().optional(),
    SICKW_API_KEY: optionalTrimmedStringSchema,
    IMEI_HASH_SALT: optionalTrimmedStringSchema,
    OPENAI_AGENTIC_API_KEY: z.string().optional(),
    OPENAI_AGENTIC_CONFIRMATION_KEY: z.string().optional(),
    OPENAI_AGENTIC_CONFIRMATION_KEY_PREVIOUS: z.string().optional(),
    OPENAI_AGENTIC_MERCHANT_SLUG: z.string().optional(),
    OPENAI_AGENTIC_SIGNING_KEY: z.string().optional(),
    OPENAI_AGENTIC_SIGNING_KEY_PREVIOUS: z.string().optional(),

    // Debug
    KUDA_BILL_DEBUG: z.string().optional(),

    // Email
    ZEPTOMAIL_TOKEN: z.string().optional(),
    ZEPTOMAIL_FROM_DOMAIN: z.string().optional(),

    // AI
    GOOGLE_GENAI_API_KEY: z.string().optional(),
    GEMINI_API_KEY: z.string().optional(),
    AI_CHAT_MODEL: z.string().default('gemma4:e4b'),

    // BNPL
    CREDIT_DIRECT_PRIVATE_KEY: z.string().optional(),

    // Node Env
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),

    // Internal
    JUICYWAY_BASE_URL: z.string().default('https://api.spendjuice.com'),
    MYCOVER_WEBHOOK_SECRET: z.string().optional(),
    CRON_SECRET: z.string().optional(),
    INTERNAL_API_SECRET: z.string().optional(),
    IMPORT_JOB_WORKER_BATCH_SIZE: z.coerce.number().int().positive().default(3),
    IMPORT_JOB_DIRECT_UPLOAD_ENABLED: booleanStringSchema.optional(),
    TERMINAL_IDEMPOTENCY_RECORD_WINDOW_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(DEFAULT_TERMINAL_IDEMPOTENCY_RECORD_WINDOW_MS),

    // Push Notifications
    EXPO_ACCESS_TOKEN: z.string().optional(),

    // Monnify (Identity verification)
    MONNIFY_API_KEY: z.string().optional(),
    MONNIFY_SECRET_KEY: z.string().optional(),
    MONNIFY_BASE_URL: z.string().url().default('https://api.monnify.com'),
    CAC_API_URL: z.string().url().default(DEFAULT_CAC_API_URL),
    CAC_TIN_API_BASE_URL: z
      .string()
      .url()
      .default(DEFAULT_CAC_TIN_API_BASE_URL),
    // Ollama (CAC certificate OCR — Gemma 4 on VPS)
    OLLAMA_BASE_URL: httpsOrLocalhostUrl('OLLAMA_BASE_URL').optional(),
    OLLAMA_CAC_MODEL: z.string().default('gemma4:e4b'),
    OLLAMA_BASIC_AUTH: z.string().optional(),
    OLLAMA_STOREFRONT_BASE_URL: httpsOrLocalhostUrl(
      'OLLAMA_STOREFRONT_BASE_URL'
    ).optional(),
    OLLAMA_STOREFRONT_BASIC_AUTH: z.string().optional(),
    OLLAMA_STOREFRONT_MODEL: z.string().default('gemma4:e4b'),
    OLLAMA_STOREFRONT_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(90_000),
    AI_STOREFRONT_GENERATION_ENABLED: defaultFalseBooleanStringSchema,

    // LLM server (llama.cpp / OpenAI-compatible — Gemma 4 + MTP drafter on VPS)
    LLM_SERVER_URL: httpsOrLocalhostUrl('LLM_SERVER_URL').optional(),
    // Blank placeholders are treated as unset; the superRefine below requires
    // a real bearer only when LLM_SERVER_URL is configured.
    LLM_SERVER_BEARER: optionalTrimmedStringSchema.refine(
      (value) =>
        value === undefined || buildLlmBearerAuthHeader(value) !== null,
      {
        message:
          'LLM_SERVER_BEARER must be a valid bearer token (no control chars, ≤2048 chars, not "BearerXyz")',
      }
    ),
    LLM_CHAT_MODEL: z.string().default('gemma-4-e4b'),

    // Jumia Marketplace
    JUMIA_ENVIRONMENT: z.enum(['staging', 'production']).default('staging'),
    JUMIA_CLIENT_ID: z.string().optional(),
    JUMIA_CLIENT_SECRET: z.string().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const isGitHubActionsBuild =
      process.env.GITHUB_ACTIONS === 'true' &&
      Boolean(process.env.GITHUB_RUN_ID) &&
      Boolean(process.env.GITHUB_REPOSITORY);

    if (
      value.NODE_ENV !== 'production' ||
      isGitHubActionsBuild ||
      value.SUPABASE_AGENTIC_JWT_PRIVATE_JWK ||
      value.SUPABASE_JWT_SECRET
    ) {
      return;
    }

    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        'SUPABASE_AGENTIC_JWT_PRIVATE_JWK or SUPABASE_JWT_SECRET is required in production',
      path: ['SUPABASE_AGENTIC_JWT_PRIVATE_JWK'],
    });
  })
  .superRefine((value, ctx) => {
    if (value.LLM_SERVER_URL && !value.LLM_SERVER_BEARER) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'LLM_SERVER_BEARER is required when LLM_SERVER_URL is set',
        path: ['LLM_SERVER_BEARER'],
      });
    }
  });

const clientSchema = z.object({
  // Supabase (Public)
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .min(1, 'NEXT_PUBLIC_SUPABASE_URL is required'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required'),

  // App
  NEXT_PUBLIC_ROOT_DOMAIN: z.string().default('usebaci.com'),
  NEXT_PUBLIC_APP_URL: z.string().default('http://localhost:3000'),
  NEXT_PUBLIC_BLOG_MEDIA_CDN_ORIGIN: z
    .string()
    .url()
    .refine((value) => new URL(value).protocol === 'https:', {
      message: 'CDN origin must use HTTPS',
    })
    .optional(),

  // Payments (Public keys)
  NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY: z.string().optional(),
  KORAPAY_PUBLIC_KEY: z.string().optional(), // Ideally should be NEXT_PUBLIC_ but keeping legacy name for compatibility
  CREDIT_DIRECT_PUBLIC_KEY: z.string().optional(),
});

// Helper to format validation errors
const formatErrors = (
  errors: z.ZodFormattedError<Map<string, string>, string>
) =>
  Object.entries(errors)
    .map(([name, value]) => {
      if (value && '_errors' in value)
        return `${name}: ${value._errors.join(', ')}`;
      return null;
    })
    .filter(Boolean);

const MODEL_NAME_LINE_BREAK_PATTERN = /\\n|\r?\n|\r/g;

const validateSanitizedModel = (
  value: string | undefined,
  name: string
): string => {
  const model = value?.replace(MODEL_NAME_LINE_BREAK_PATTERN, '').trim() ?? '';

  if (!model) {
    throw new Error(`${name} must resolve to a non-empty model name`);
  }

  return model;
};

/**
 * Validates and returns the environment variables.
 * Throws an error in non-production environments if validation fails.
 * In production, it logs errors but might allow the app to crash downstream if critical keys are missing.
 */
const getEnv = () => {
  const isServer = typeof window === 'undefined';

  // Explicitly map client variables to ensure they are available on the client
  // Next.js requires the full process.env.NEXT_PUBLIC_* string for bundling
  const clientEnv = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_ROOT_DOMAIN: process.env.NEXT_PUBLIC_ROOT_DOMAIN,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_BLOG_MEDIA_CDN_ORIGIN:
      process.env.NEXT_PUBLIC_BLOG_MEDIA_CDN_ORIGIN,
    NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY:
      process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
    KORAPAY_PUBLIC_KEY: process.env.KORAPAY_PUBLIC_KEY,
    CREDIT_DIRECT_PUBLIC_KEY: process.env.CREDIT_DIRECT_PUBLIC_KEY,
  };

  const serverEnv = isServer
    ? {
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
        SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET,
        SUPABASE_AGENTIC_JWT_PRIVATE_JWK:
          process.env.SUPABASE_AGENTIC_JWT_PRIVATE_JWK,
        BLOG_PREVIEW_SECRET: process.env.BLOG_PREVIEW_SECRET,
        KORAPAY_SECRET_KEY: process.env.KORAPAY_SECRET_KEY,
        JUICYWAY_SECRET_KEY: process.env.JUICYWAY_SECRET_KEY,
        PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY,
        SICKW_API_KEY: process.env.SICKW_API_KEY,
        IMEI_HASH_SALT: process.env.IMEI_HASH_SALT,
        KUDA_BILL_DEBUG: process.env.KUDA_BILL_DEBUG,
        OPENAI_AGENTIC_API_KEY: process.env.OPENAI_AGENTIC_API_KEY,
        OPENAI_AGENTIC_CONFIRMATION_KEY:
          process.env.OPENAI_AGENTIC_CONFIRMATION_KEY,
        OPENAI_AGENTIC_CONFIRMATION_KEY_PREVIOUS:
          process.env.OPENAI_AGENTIC_CONFIRMATION_KEY_PREVIOUS,
        OPENAI_AGENTIC_MERCHANT_SLUG: process.env.OPENAI_AGENTIC_MERCHANT_SLUG,
        OPENAI_AGENTIC_SIGNING_KEY: process.env.OPENAI_AGENTIC_SIGNING_KEY,
        OPENAI_AGENTIC_SIGNING_KEY_PREVIOUS:
          process.env.OPENAI_AGENTIC_SIGNING_KEY_PREVIOUS,
        ZEPTOMAIL_TOKEN: process.env.ZEPTOMAIL_TOKEN,
        ZEPTOMAIL_FROM_DOMAIN: process.env.ZEPTOMAIL_FROM_DOMAIN,
        GOOGLE_GENAI_API_KEY: process.env.GOOGLE_GENAI_API_KEY,
        GEMINI_API_KEY: process.env.GEMINI_API_KEY,
        AI_CHAT_MODEL: process.env.AI_CHAT_MODEL,
        CREDIT_DIRECT_PRIVATE_KEY: process.env.CREDIT_DIRECT_PRIVATE_KEY,
        NODE_ENV: process.env.NODE_ENV,
        JUICYWAY_BASE_URL: process.env.JUICYWAY_BASE_URL,
        MYCOVER_WEBHOOK_SECRET: process.env.MYCOVER_WEBHOOK_SECRET,
        CRON_SECRET: process.env.CRON_SECRET,
        IMPORT_JOB_WORKER_BATCH_SIZE: process.env.IMPORT_JOB_WORKER_BATCH_SIZE,
        TERMINAL_IDEMPOTENCY_RECORD_WINDOW_MS:
          process.env.TERMINAL_IDEMPOTENCY_RECORD_WINDOW_MS,
        JUMIA_ENVIRONMENT: process.env.JUMIA_ENVIRONMENT,
        JUMIA_CLIENT_ID: process.env.JUMIA_CLIENT_ID,
        JUMIA_CLIENT_SECRET: process.env.JUMIA_CLIENT_SECRET,
        INTERNAL_API_SECRET: process.env.INTERNAL_API_SECRET,
        IMPORT_JOB_DIRECT_UPLOAD_ENABLED:
          process.env.IMPORT_JOB_DIRECT_UPLOAD_ENABLED,
        EXPO_ACCESS_TOKEN: process.env.EXPO_ACCESS_TOKEN,
        MONNIFY_API_KEY: process.env.MONNIFY_API_KEY,
        MONNIFY_SECRET_KEY: process.env.MONNIFY_SECRET_KEY,
        MONNIFY_BASE_URL: process.env.MONNIFY_BASE_URL,
        CAC_API_URL: process.env.CAC_API_URL,
        CAC_TIN_API_BASE_URL: process.env.CAC_TIN_API_BASE_URL,
        OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL,
        OLLAMA_CAC_MODEL: process.env.OLLAMA_CAC_MODEL,
        OLLAMA_BASIC_AUTH: process.env.OLLAMA_BASIC_AUTH,
        OLLAMA_STOREFRONT_BASE_URL: process.env.OLLAMA_STOREFRONT_BASE_URL,
        OLLAMA_STOREFRONT_BASIC_AUTH: process.env.OLLAMA_STOREFRONT_BASIC_AUTH,
        OLLAMA_STOREFRONT_MODEL: process.env.OLLAMA_STOREFRONT_MODEL,
        OLLAMA_STOREFRONT_TIMEOUT_MS: process.env.OLLAMA_STOREFRONT_TIMEOUT_MS,
        AI_STOREFRONT_GENERATION_ENABLED:
          process.env.AI_STOREFRONT_GENERATION_ENABLED,
        LLM_SERVER_URL: process.env.LLM_SERVER_URL,
        LLM_SERVER_BEARER: process.env.LLM_SERVER_BEARER,
        LLM_CHAT_MODEL: process.env.LLM_CHAT_MODEL,
      }
    : {};

  // Validate client side
  const parsedClient = clientSchema.safeParse(clientEnv);

  // Validate server side ONLY on the server
  let parsedServer = serverSchema.safeParse(serverEnv);

  if (!isServer) {
    // On client, we relax server validation (or just mock it)
    // We already know they are missing, so we just use empty defaults
    parsedServer = { success: true, data: {} as z.infer<typeof serverSchema> };
  }

  if (!parsedClient.success || (isServer && !parsedServer.success)) {
    const clientErrors = parsedClient.success
      ? []
      : formatErrors(parsedClient.error.format());
    const serverErrors =
      isServer && !parsedServer.success
        ? formatErrors(parsedServer.error.format())
        : [];

    const allErrors = [...clientErrors, ...serverErrors];

    if (allErrors.length > 0) {
      console.error('❌ Invalid environment variables:', allErrors.join('\n'));

      // In production, we strictly throw.
      if (process.env.NODE_ENV === 'production') {
        throw new Error(
          `❌ Invalid environment variables: ${allErrors.join(', ')}`
        );
      }
    }
  }

  return {
    ...(parsedServer.success ? parsedServer.data : {}),
    ...(parsedClient.success ? parsedClient.data : {}),
  } as z.infer<typeof serverSchema> & z.infer<typeof clientSchema>;
};

// Singleton env object
// Note: We use a lazy getter pattern or just executed immediately.
// For Next.js/Edge, immediate execution is usually fine, but safeParse handles the "build time" vs "runtime" nuance better.
export const env = getEnv();

/**
 * Legacy Getters (Refactored to use the validated `env` object)
 * Keeping these signatures ensures backward compatibility with the rest of the app.
 */

export const getSupabaseUrl = (): string => {
  if (!env?.NEXT_PUBLIC_SUPABASE_URL)
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not defined');
  return env.NEXT_PUBLIC_SUPABASE_URL;
};

export const getSupabaseAnonKey = (): string => {
  if (!env?.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not defined');
  return env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
};

export const getSupabaseServiceRoleKey = (): string => {
  if (typeof window !== 'undefined')
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY cannot be accessed on the client'
    );
  if (!env?.SUPABASE_SERVICE_ROLE_KEY)
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not defined');
  return env.SUPABASE_SERVICE_ROLE_KEY;
};

const isBrowserRuntime = () =>
  // Server-route tests run in jsdom, so agentic server-only getters use this
  // helper to avoid treating Vitest's window shim as a real browser runtime.
  typeof window !== 'undefined' && process.env.NODE_ENV !== 'test';
const trimSecret = (value: string | undefined): string => value?.trim() ?? '';

export const getSupabaseJwtSecret = (): string => {
  if (isBrowserRuntime())
    throw new Error('SUPABASE_JWT_SECRET cannot be accessed on the client');
  const jwtSecret = trimSecret(
    process.env.SUPABASE_JWT_SECRET ?? env?.SUPABASE_JWT_SECRET
  );
  if (!jwtSecret) throw new Error('SUPABASE_JWT_SECRET is not defined');
  return jwtSecret;
};

export const getSupabaseAgenticJwtPrivateJwk = (): string | undefined => {
  if (isBrowserRuntime())
    throw new Error(
      'SUPABASE_AGENTIC_JWT_PRIVATE_JWK cannot be accessed on the client'
    );
  const privateJwk = trimSecret(
    process.env.SUPABASE_AGENTIC_JWT_PRIVATE_JWK ??
      env?.SUPABASE_AGENTIC_JWT_PRIVATE_JWK
  );
  return privateJwk || undefined;
};

// Optional Getters
export const getKorapaySecretKey = () => env?.KORAPAY_SECRET_KEY;
export const getKorapayPublicKey = () => env?.KORAPAY_PUBLIC_KEY;
export const getJuicywaySecretKey = () => env?.JUICYWAY_SECRET_KEY;
export const getJuicywayBaseUrl = () => env?.JUICYWAY_BASE_URL;

// Agentic runtime secrets are read at call time so serverless env rotations and
// tests that stub process.env after module load use the current secret values.
export const getAgenticApiKey = () => {
  if (isBrowserRuntime()) return undefined;
  const apiKey = trimSecret(
    process.env.OPENAI_AGENTIC_API_KEY ?? env?.OPENAI_AGENTIC_API_KEY
  );
  return apiKey || undefined;
};
export const getAgenticConfirmationKeys = () => {
  if (isBrowserRuntime()) return [];
  return [
    process.env.OPENAI_AGENTIC_CONFIRMATION_KEY ??
      env?.OPENAI_AGENTIC_CONFIRMATION_KEY,
    process.env.OPENAI_AGENTIC_CONFIRMATION_KEY_PREVIOUS ??
      env?.OPENAI_AGENTIC_CONFIRMATION_KEY_PREVIOUS,
  ]
    .map(trimSecret)
    .filter((value) => value.length > 0);
};
export const getAgenticMerchantSlug = () => {
  if (isBrowserRuntime()) return undefined;
  const slug = trimSecret(
    process.env.OPENAI_AGENTIC_MERCHANT_SLUG ??
      env?.OPENAI_AGENTIC_MERCHANT_SLUG
  );
  return slug || undefined;
};
export const getAgenticSigningKeys = () => {
  if (isBrowserRuntime()) return [];
  return [
    process.env.OPENAI_AGENTIC_SIGNING_KEY ?? env?.OPENAI_AGENTIC_SIGNING_KEY,
    process.env.OPENAI_AGENTIC_SIGNING_KEY_PREVIOUS ??
      env?.OPENAI_AGENTIC_SIGNING_KEY_PREVIOUS,
  ]
    .map(trimSecret)
    .filter((value) => value.length > 0);
};
export const getPaystackSecretKey = () => {
  if (isBrowserRuntime()) return undefined;
  const secret = trimSecret(
    process.env.PAYSTACK_SECRET_KEY ?? env?.PAYSTACK_SECRET_KEY
  );
  return secret || undefined;
};
export const getSickwApiKey = () => {
  if (isBrowserRuntime()) return undefined;
  const secret = trimSecret(process.env.SICKW_API_KEY ?? env?.SICKW_API_KEY);
  return secret || undefined;
};
export const getImeiHashSalt = () => {
  if (isBrowserRuntime()) return undefined;
  const salt = trimSecret(process.env.IMEI_HASH_SALT ?? env?.IMEI_HASH_SALT);
  return salt || undefined;
};
export const getKudaBillDebug = () => {
  if (isBrowserRuntime()) return undefined;
  const debug = trimSecret(process.env.KUDA_BILL_DEBUG ?? env?.KUDA_BILL_DEBUG);
  return debug || undefined;
};
export const getZeptoMailToken = () =>
  env?.ZEPTOMAIL_TOKEN?.trim() || undefined;
export const getZeptoMailFromDomain = () =>
  env?.ZEPTOMAIL_FROM_DOMAIN?.trim() || 'usebaci.com';
export const getGeminiApiKey = () =>
  env?.GOOGLE_GENAI_API_KEY || env?.GEMINI_API_KEY;
export const getAiChatModel = () => {
  if (typeof window !== 'undefined')
    throw new Error('AI_CHAT_MODEL cannot be accessed on the client');
  return validateSanitizedModel(env.AI_CHAT_MODEL, 'AI_CHAT_MODEL');
};
export const getCreditDirectPublicKey = () => env?.CREDIT_DIRECT_PUBLIC_KEY;
export const getCreditDirectPrivateKey = () => env?.CREDIT_DIRECT_PRIVATE_KEY;

// Blog - The Fix for "Invalid Token"
// Now guaranteed to have a value (defaulting to dev-preview-secret if missing)
export const getBlogPreviewSecret = (): string => {
  return env?.BLOG_PREVIEW_SECRET || 'dev-preview-secret';
};

export const getRootDomain = () => env?.NEXT_PUBLIC_ROOT_DOMAIN;
export const getAppUrl = () =>
  env?.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
// OAuth routes need to know whether NEXT_PUBLIC_APP_URL was explicitly configured.
// Reading process.env directly avoids the Zod fallback so missing config does not
// silently degrade to localhost in callback URLs.
export const getConfiguredAppUrl = (): string | null => {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (!appUrl) {
    return null;
  }

  try {
    // OAuth callbacks must use a publicly reachable origin, not a local dev URL.
    const parsedUrl = new URL(appUrl);
    const hostname = parsedUrl.hostname.toLowerCase();

    if (
      hostname === 'localhost' ||
      hostname === '0.0.0.0' ||
      hostname === '::1' ||
      hostname.startsWith('127.') ||
      hostname.endsWith('.localhost')
    ) {
      return null;
    }

    return appUrl;
  } catch {
    return null;
  }
};

export const getMyCoverWebhookSecret = (): string => {
  if (typeof window !== 'undefined')
    throw new Error('MYCOVER_WEBHOOK_SECRET cannot be accessed on the client');
  const webhookSecret =
    env?.MYCOVER_WEBHOOK_SECRET || process.env.MYCOVER_SECRET_KEY?.trim();
  if (!webhookSecret)
    throw new Error(
      'MYCOVER_WEBHOOK_SECRET or MYCOVER_SECRET_KEY is not defined'
    );
  return webhookSecret;
};

export const getCronSecret = () => env?.CRON_SECRET;

export const getInternalApiSecret = () => {
  if (typeof window !== 'undefined')
    throw new Error('INTERNAL_API_SECRET cannot be accessed on the client');
  return env?.INTERNAL_API_SECRET;
};

export const getImportJobWorkerBatchSize = () =>
  env?.IMPORT_JOB_WORKER_BATCH_SIZE || 3;

export const getTerminalIdempotencyRecordWindowMs = () => {
  if (isBrowserRuntime())
    throw new Error(
      'TERMINAL_IDEMPOTENCY_RECORD_WINDOW_MS cannot be accessed on the client'
    );
  return (
    env?.TERMINAL_IDEMPOTENCY_RECORD_WINDOW_MS ??
    DEFAULT_TERMINAL_IDEMPOTENCY_RECORD_WINDOW_MS
  );
};

export const isImportJobDirectUploadEnabled = () => {
  if (typeof window !== 'undefined') {
    return false;
  }

  return env?.IMPORT_JOB_DIRECT_UPLOAD_ENABLED ?? true;
};

export const isProduction = () => env?.NODE_ENV === 'production';

// Jumia
export const getJumiaEnvironment = () => env?.JUMIA_ENVIRONMENT;
export const getJumiaClientId = () => env?.JUMIA_CLIENT_ID;
export const getJumiaClientSecret = () => {
  if (typeof window !== 'undefined')
    throw new Error('JUMIA_CLIENT_SECRET cannot be accessed on the client');
  return env?.JUMIA_CLIENT_SECRET;
};

// Push Notifications
export const getExpoAccessToken = () => {
  if (typeof window !== 'undefined')
    throw new Error('EXPO_ACCESS_TOKEN cannot be accessed on the client');
  return env?.EXPO_ACCESS_TOKEN;
};

// Monnify / Ollama (Identity verification)
export const getMonnifyApiKey = () => {
  if (typeof window !== 'undefined')
    throw new Error('MONNIFY_API_KEY cannot be accessed on the client');
  return env?.MONNIFY_API_KEY;
};
export const getMonnifySecretKey = () => {
  if (typeof window !== 'undefined')
    throw new Error('MONNIFY_SECRET_KEY cannot be accessed on the client');
  return env?.MONNIFY_SECRET_KEY;
};
export const getMonnifyBaseUrl = () =>
  env?.MONNIFY_BASE_URL ?? 'https://api.monnify.com';
export const getCacApiUrl = () => env?.CAC_API_URL ?? DEFAULT_CAC_API_URL;
export const getCacTinApiBaseUrl = () =>
  env?.CAC_TIN_API_BASE_URL ?? DEFAULT_CAC_TIN_API_BASE_URL;
export const getOllamaBaseUrl = () => {
  if (typeof window !== 'undefined')
    throw new Error('OLLAMA_BASE_URL cannot be accessed on the client');
  return env?.OLLAMA_BASE_URL;
};
export const getOllamaCacModel = () => {
  if (typeof window !== 'undefined')
    throw new Error('OLLAMA_CAC_MODEL cannot be accessed on the client');
  return validateSanitizedModel(env.OLLAMA_CAC_MODEL, 'OLLAMA_CAC_MODEL');
};
export const getOllamaBasicAuth = () => {
  if (typeof window !== 'undefined')
    throw new Error('OLLAMA_BASIC_AUTH cannot be accessed on the client');
  return env?.OLLAMA_BASIC_AUTH;
};
export const getOllamaStorefrontBaseUrl = () => {
  if (isBrowserRuntime())
    throw new Error(
      'OLLAMA_STOREFRONT_BASE_URL cannot be accessed on the client'
    );
  return env?.OLLAMA_STOREFRONT_BASE_URL;
};
export const getOllamaStorefrontBasicAuth = () => {
  if (isBrowserRuntime())
    throw new Error(
      'OLLAMA_STOREFRONT_BASIC_AUTH cannot be accessed on the client'
    );
  return env?.OLLAMA_STOREFRONT_BASIC_AUTH;
};
export const getOllamaStorefrontModel = () => {
  if (isBrowserRuntime())
    throw new Error('OLLAMA_STOREFRONT_MODEL cannot be accessed on the client');
  return validateSanitizedModel(
    env.OLLAMA_STOREFRONT_MODEL,
    'OLLAMA_STOREFRONT_MODEL'
  );
};
export const getOllamaStorefrontTimeoutMs = () => {
  if (isBrowserRuntime())
    throw new Error(
      'OLLAMA_STOREFRONT_TIMEOUT_MS cannot be accessed on the client'
    );
  return env.OLLAMA_STOREFRONT_TIMEOUT_MS;
};
export const isAiStorefrontGenerationEnabled = () => {
  if (isBrowserRuntime())
    throw new Error(
      'AI_STOREFRONT_GENERATION_ENABLED cannot be accessed on the client'
    );
  return env.AI_STOREFRONT_GENERATION_ENABLED;
};
export const getLlmServerUrl = () => {
  if (isBrowserRuntime())
    throw new Error('LLM_SERVER_URL cannot be accessed on the client');
  return env?.LLM_SERVER_URL;
};
export const getLlmServerBearer = () => {
  if (isBrowserRuntime())
    throw new Error('LLM_SERVER_BEARER cannot be accessed on the client');
  return env?.LLM_SERVER_BEARER;
};
export const getLlmChatModel = () => {
  if (isBrowserRuntime())
    throw new Error('LLM_CHAT_MODEL cannot be accessed on the client');
  return validateSanitizedModel(env.LLM_CHAT_MODEL, 'LLM_CHAT_MODEL');
};

// Deprecated: No longer needed as we validate on import.
export const validateEnvironment = () => ({ valid: true, warnings: [] });
