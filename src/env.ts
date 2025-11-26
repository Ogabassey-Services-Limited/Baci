
// src/env.ts

/**
 * A type-safe and validated way to access environment variables.
 * This is the single source of truth for all environment variables in the app.
 */

// Required environment variables (will throw if missing)
export const getSupabaseUrl = (): string => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not defined in your environment variables.');
  }
  return url;
};

export const getSupabaseAnonKey = (): string => {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not defined in your environment variables.');
  }
  return key;
};

// Optional environment variables with defaults and warnings
export const getKorapaySecretKey = (): string | undefined => {
  const key = process.env.KORAPAY_SECRET_KEY;
  if (!key && typeof window === 'undefined') {
    console.warn('KORAPAY_SECRET_KEY is not defined. Payment processing will not work.');
  }
  return key;
};

export const getKorapayPublicKey = (): string | undefined => {
  const key = process.env.KORAPAY_PUBLIC_KEY;
  if (!key && typeof window === 'undefined') {
    console.warn('KORAPAY_PUBLIC_KEY is not defined. Payment checkout will not work.');
  }
  return key;
};

export const getBrevoApiKey = (): string | undefined => {
  const key = process.env.BREVO_API_KEY;
  if (!key && typeof window === 'undefined') {
    console.warn('BREVO_API_KEY is not defined. Email sending will not work.');
  }
  return key;
};

export const getGeminiApiKey = (): string | undefined => {
  const key = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY;
  if (!key && typeof window === 'undefined') {
    console.warn('GOOGLE_GENAI_API_KEY/GEMINI_API_KEY is not defined. AI features will not work.');
  }
  return key;
};

export const getRootDomain = (): string => {
  return process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com';
};

export const isProduction = (): boolean => {
  return process.env.NODE_ENV === 'production';
};

/**
 * Validate all critical environment variables at startup.
 * Call this in your app initialization to get early warnings.
 * This function only warns and does not throw to avoid breaking the app.
 */
export const validateEnvironment = (): { valid: boolean; warnings: string[] } => {
  const warnings: string[] = [];

  // Check required variables
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    warnings.push('NEXT_PUBLIC_SUPABASE_URL is missing (required)');
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    warnings.push('NEXT_PUBLIC_SUPABASE_ANON_KEY is missing (required)');
  }

  // Check optional but important variables
  if (!process.env.KORAPAY_SECRET_KEY) {
    warnings.push('KORAPAY_SECRET_KEY is missing (payments disabled)');
  }
  if (!process.env.BREVO_API_KEY) {
    warnings.push('BREVO_API_KEY is missing (emails disabled)');
  }
  if (!process.env.GOOGLE_GENAI_API_KEY && !process.env.GEMINI_API_KEY) {
    warnings.push('GOOGLE_GENAI_API_KEY is missing (AI features disabled)');
  }

  if (warnings.length > 0 && typeof window === 'undefined') {
    console.warn('Environment validation warnings:', warnings);
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
};
