// src/env.ts
import z from 'zod';

/**
 * A type-safe and validated way to access environment variables.
 * This is the single source of truth for all environment variables in the app.
 *
 * 2026 Best Practice: Schema-based validation using Zod.
 */

const booleanStringSchema = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true');

const serverSchema = z
  .object({
    // Supabase (Server Admin)
    SUPABASE_SERVICE_ROLE_KEY: z
      .string()
      .min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
    SUPABASE_JWT_SECRET: z
      .string()
      .trim()
      .min(1, 'SUPABASE_JWT_SECRET cannot be empty')
      .optional(),

    // Blog
    BLOG_PREVIEW_SECRET: z.string().default('dev-preview-secret'), // Fallback for dev

    // Payments (Server keys)
    KORAPAY_SECRET_KEY: z.string().optional(),
    JUICYWAY_SECRET_KEY: z.string().optional(),
    PAYSTACK_SECRET_KEY: z.string().optional(),

    // Email
    ZEPTOMAIL_TOKEN: z.string().optional(),

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

    // Push Notifications
    EXPO_ACCESS_TOKEN: z.string().optional(),

    // Monnify (Identity verification)
    MONNIFY_API_KEY: z.string().optional(),
    MONNIFY_SECRET_KEY: z.string().optional(),
    MONNIFY_BASE_URL: z.string().url().default('https://api.monnify.com'),
    CAC_API_URL: z
      .string()
      .url()
      .default(
        'https://icrp.cac.gov.ng/name_similarity_app/api/public_search/search'
      ),
    // Ollama (CAC certificate OCR — Gemma 4 on VPS)
    OLLAMA_BASE_URL: z
      .string()
      .url()
      .refine(
        (u) => {
          const url = new URL(u);
          const isLocal =
            url.hostname === 'localhost' ||
            url.hostname.startsWith('127.') ||
            url.hostname === '::1';
          return u.startsWith('https://') || isLocal;
        },
        { message: 'OLLAMA_BASE_URL must use HTTPS (except for localhost)' }
      )
      .optional(),
    OLLAMA_CAC_MODEL: z.string().default('gemma4:e4b'),
    OLLAMA_BASIC_AUTH: z.string().optional(),

    // Jumia Marketplace
    JUMIA_ENVIRONMENT: z.enum(['staging', 'production']).default('staging'),
    JUMIA_CLIENT_ID: z.string().optional(),
    JUMIA_CLIENT_SECRET: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV !== 'production' || value.SUPABASE_JWT_SECRET) {
      return;
    }

    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'SUPABASE_JWT_SECRET is required in production',
      path: ['SUPABASE_JWT_SECRET'],
    });
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
    NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY:
      process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
    KORAPAY_PUBLIC_KEY: process.env.KORAPAY_PUBLIC_KEY,
    CREDIT_DIRECT_PUBLIC_KEY: process.env.CREDIT_DIRECT_PUBLIC_KEY,
  };

  const serverEnv = isServer
    ? {
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
        SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET,
        BLOG_PREVIEW_SECRET: process.env.BLOG_PREVIEW_SECRET,
        KORAPAY_SECRET_KEY: process.env.KORAPAY_SECRET_KEY,
        JUICYWAY_SECRET_KEY: process.env.JUICYWAY_SECRET_KEY,
        PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY,
        ZEPTOMAIL_TOKEN: process.env.ZEPTOMAIL_TOKEN,
        GOOGLE_GENAI_API_KEY: process.env.GOOGLE_GENAI_API_KEY,
        GEMINI_API_KEY: process.env.GEMINI_API_KEY,
        AI_CHAT_MODEL: process.env.AI_CHAT_MODEL,
        CREDIT_DIRECT_PRIVATE_KEY: process.env.CREDIT_DIRECT_PRIVATE_KEY,
        NODE_ENV: process.env.NODE_ENV,
        JUICYWAY_BASE_URL: process.env.JUICYWAY_BASE_URL,
        MYCOVER_WEBHOOK_SECRET: process.env.MYCOVER_WEBHOOK_SECRET,
        CRON_SECRET: process.env.CRON_SECRET,
        IMPORT_JOB_WORKER_BATCH_SIZE: process.env.IMPORT_JOB_WORKER_BATCH_SIZE,
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
        OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL,
        OLLAMA_CAC_MODEL: process.env.OLLAMA_CAC_MODEL,
        OLLAMA_BASIC_AUTH: process.env.OLLAMA_BASIC_AUTH,
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

export const getSupabaseJwtSecret = (): string => {
  if (typeof window !== 'undefined')
    throw new Error('SUPABASE_JWT_SECRET cannot be accessed on the client');
  if (!env?.SUPABASE_JWT_SECRET)
    throw new Error('SUPABASE_JWT_SECRET is not defined');
  return env.SUPABASE_JWT_SECRET;
};

// Optional Getters
export const getKorapaySecretKey = () => env?.KORAPAY_SECRET_KEY;
export const getKorapayPublicKey = () => env?.KORAPAY_PUBLIC_KEY;
export const getJuicywaySecretKey = () => env?.JUICYWAY_SECRET_KEY;
export const getJuicywayBaseUrl = () => env?.JUICYWAY_BASE_URL;
export const getZeptoMailToken = () => env?.ZEPTOMAIL_TOKEN;
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
  if (!env?.MYCOVER_WEBHOOK_SECRET)
    throw new Error('MYCOVER_WEBHOOK_SECRET is not defined');
  return env.MYCOVER_WEBHOOK_SECRET;
};

export const getCronSecret = () => env?.CRON_SECRET;

export const getInternalApiSecret = () => {
  if (typeof window !== 'undefined')
    throw new Error('INTERNAL_API_SECRET cannot be accessed on the client');
  return env?.INTERNAL_API_SECRET;
};

export const getImportJobWorkerBatchSize = () =>
  env?.IMPORT_JOB_WORKER_BATCH_SIZE || 3;

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
export const getCacApiUrl = () =>
  env?.CAC_API_URL ??
  'https://icrp.cac.gov.ng/name_similarity_app/api/public_search/search';
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

// Deprecated: No longer needed as we validate on import.
export const validateEnvironment = () => ({ valid: true, warnings: [] });
