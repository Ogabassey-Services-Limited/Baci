import { createBrowserClient } from '@supabase/ssr';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/env';

export function createClient() {
  // Use the default createBrowserClient which automatically handles
  // cookies safely and correctly (including chunking for large tokens).
  return createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey());
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
    console.error(`Commerce Brain Error [${action}]:`, error);
    throw error;
  }

  return result;
}
