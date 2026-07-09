import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ImportMatchContext,
  ImportMatchDevice,
  ImportMatchProduct,
  ImportMatchServiceType,
} from './import-match';

/**
 * Loads the tenant-scoped device / product / service-type lists the AI-import
 * matcher needs. Everything is filtered by merchant_id so a suggestion can never
 * reference another merchant's row. Uses the caller's RLS-scoped client.
 */

type Row = Record<string, unknown>;

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function strOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function aliasArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

async function loadDevices(
  supabase: SupabaseClient,
  merchantId: string
): Promise<ImportMatchDevice[]> {
  const { data, error } = await supabase
    .from('repair_devices')
    .select('id, brand, model, slug, aliases, product_id')
    .eq('merchant_id', merchantId)
    .limit(2000);
  if (error) {
    throw new Error(error.message);
  }
  return ((data ?? []) as Row[]).map((row) => ({
    id: str(row.id),
    brand: str(row.brand),
    model: str(row.model),
    slug: str(row.slug),
    aliases: aliasArray(row.aliases),
    productId: strOrNull(row.product_id),
  }));
}

async function loadProducts(
  supabase: SupabaseClient,
  merchantId: string
): Promise<ImportMatchProduct[]> {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, brand')
    .eq('merchant_id', merchantId)
    .limit(2000);
  if (error) {
    throw new Error(error.message);
  }
  return ((data ?? []) as Row[]).map((row) => ({
    id: str(row.id),
    name: str(row.name),
    brand: strOrNull(row.brand),
  }));
}

async function loadServiceTypes(
  supabase: SupabaseClient,
  merchantId: string
): Promise<ImportMatchServiceType[]> {
  const { data, error } = await supabase
    .from('repair_service_types')
    .select('id, name')
    .eq('merchant_id', merchantId)
    .limit(2000);
  if (error) {
    throw new Error(error.message);
  }
  return ((data ?? []) as Row[]).map((row) => ({
    id: str(row.id),
    name: str(row.name),
  }));
}

export async function loadImportMatchContext(
  supabase: SupabaseClient,
  merchantId: string
): Promise<ImportMatchContext> {
  const [devices, products, serviceTypes] = await Promise.all([
    loadDevices(supabase, merchantId),
    loadProducts(supabase, merchantId),
    loadServiceTypes(supabase, merchantId),
  ]);
  return { devices, products, serviceTypes };
}
