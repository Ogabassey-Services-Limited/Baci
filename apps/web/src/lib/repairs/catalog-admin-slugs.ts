import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Loads the slugs a merchant already uses in a catalogue table so a new row can
 * pick a non-colliding slug (nextAvailableSlug). The UNIQUE (merchant_id, slug)
 * constraint remains the backstop against races. Tenant-scoped by merchant_id.
 */
export type SluggedRepairTable = 'repair_devices' | 'repair_service_types';

export async function loadTakenSlugs(
  supabase: SupabaseClient,
  table: SluggedRepairTable,
  merchantId: string,
  base: string
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from(table)
    .select('slug')
    .eq('merchant_id', merchantId)
    .ilike('slug', `${base}%`);

  if (error) {
    throw new Error(error.message ?? 'Failed to load existing slugs');
  }

  const taken = new Set<string>();
  for (const row of (data ?? []) as Array<{ slug: unknown }>) {
    if (typeof row.slug === 'string') {
      taken.add(row.slug);
    }
  }
  return taken;
}
