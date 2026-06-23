import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClientOptions } from '@supabase/supabase-js';

function getBrowserSupabaseUrl() {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!value) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not defined');
  }

  return value;
}

function getBrowserSupabaseAnonKey() {
  const value = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!value) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not defined');
  }

  return value;
}

export function createClient() {
  // Keep the browser client off the zod-backed server env module. Next.js
  // statically inlines NEXT_PUBLIC_* reads in client chunks, which prevents
  // storefront commerce drawers from downloading the full env validator.
  const options: SupabaseClientOptions<'public'> | undefined =
    process.env.NEXT_PUBLIC_SUPABASE_PASSKEY_AUTH_ENABLED === 'true'
      ? {
          auth: {
            experimental: {
              passkey: true,
            },
          },
        }
      : undefined;

  return createBrowserClient(
    getBrowserSupabaseUrl(),
    getBrowserSupabaseAnonKey(),
    options
  );
}

/**
 * Call the central commerce brain (Supabase Edge Function)
 * Centralizes math for Parity between Web & App
 */
export async function calculateCommerce(
  action: 'calculate_vtu' | 'calculate_order',
  // biome-ignore lint/suspicious/noExplicitAny: Dynamic payload data
  data: any
) {
  const supabase = createClient();
  const { data: result, error } = await supabase.functions.invoke(
    'calculate-commerce',
    {
      body: { action, data },
    }
  );

  if (error) {
    console.error('Commerce Brain Error', action, ':', error);
    throw error;
  }

  return result;
}
