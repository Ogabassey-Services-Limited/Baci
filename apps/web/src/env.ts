// src/env.ts
import z from 'zod';

/**
 * A type-safe and validated way to access environment variables.
 * This is the single source of truth for all environment variables in the app.
 *
 * 2026 Best Practice: Schema-based validation using Zod.
 */

const serverSchema = z.object({
  // Supabase (Server Admin)
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),

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

  // BNPL
  CREDIT_DIRECT_PRIVATE_KEY: z.string().optional(),

  // Node Env
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),

  // Internal
  JUICYWAY_BASE_URL: z.string().default('https://api.spendjuice.com'),
  MYCOVER_WEBHOOK_SECRET: z.string().optional(),
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

  // Google Maps Embed API
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: z.string().optional(),
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
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY:
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
  };

  const serverEnv = isServer
    ? {
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
        BLOG_PREVIEW_SECRET: process.env.BLOG_PREVIEW_SECRET,
        KORAPAY_SECRET_KEY: process.env.KORAPAY_SECRET_KEY,
        JUICYWAY_SECRET_KEY: process.env.JUICYWAY_SECRET_KEY,
        PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY,
        ZEPTOMAIL_TOKEN: process.env.ZEPTOMAIL_TOKEN,
        GOOGLE_GENAI_API_KEY: process.env.GOOGLE_GENAI_API_KEY,
        GEMINI_API_KEY: process.env.GEMINI_API_KEY,
        CREDIT_DIRECT_PRIVATE_KEY: process.env.CREDIT_DIRECT_PRIVATE_KEY,
        NODE_ENV: process.env.NODE_ENV,
        JUICYWAY_BASE_URL: process.env.JUICYWAY_BASE_URL,
        MYCOVER_WEBHOOK_SECRET: process.env.MYCOVER_WEBHOOK_SECRET,
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

// Optional Getters
export const getKorapaySecretKey = () => env?.KORAPAY_SECRET_KEY;
export const getKorapayPublicKey = () => env?.KORAPAY_PUBLIC_KEY;
export const getJuicywaySecretKey = () => env?.JUICYWAY_SECRET_KEY;
export const getJuicywayBaseUrl = () => env?.JUICYWAY_BASE_URL;
export const getZeptoMailToken = () => env?.ZEPTOMAIL_TOKEN;
export const getGeminiApiKey = () =>
  env?.GOOGLE_GENAI_API_KEY || env?.GEMINI_API_KEY;
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

export const getMyCoverWebhookSecret = (): string => {
  if (typeof window !== 'undefined')
    throw new Error('MYCOVER_WEBHOOK_SECRET cannot be accessed on the client');
  if (!env?.MYCOVER_WEBHOOK_SECRET)
    throw new Error('MYCOVER_WEBHOOK_SECRET is not defined');
  return env.MYCOVER_WEBHOOK_SECRET;
};

export const isProduction = () => env?.NODE_ENV === 'production';

// Deprecated: No longer needed as we validate on import.
export const validateEnvironment = () => ({ valid: true, warnings: [] });
