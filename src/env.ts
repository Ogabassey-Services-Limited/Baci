
// src/env.ts

/**
 * A type-safe and validated way to access environment variables.
 * This is the single source of truth for all environment variables in the app.
 */

const getSupabaseUrl = (): string => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not defined in your environment variables.');
  }
  return url;
};

const getSupabaseAnonKey = (): string => {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not defined in your environment variables.');
  }
  return key;
};

export const supabaseUrl = getSupabaseUrl();
export const supabaseAnonKey = getSupabaseAnonKey();

export const env = {
  supabaseUrl,
  supabaseAnonKey,
};
