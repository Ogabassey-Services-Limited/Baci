import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ImportCommitDevice,
  ImportCommitRepository,
  ImportCommitServiceType,
} from './import-commit';

/**
 * Supabase-backed ImportCommitRepository. Every query is scoped to the merchant.
 * The commit only reads/writes public columns (never internal_notes), so it runs
 * on the caller's RLS-scoped client after the route permission check.
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

export function createImportCommitRepository(
  supabase: SupabaseClient,
  merchantId: string
): ImportCommitRepository {
  return {
    async listServiceTypes(): Promise<ImportCommitServiceType[]> {
      const { data, error } = await supabase
        .from('repair_service_types')
        .select('id, name, slug')
        .eq('merchant_id', merchantId);
      if (error) {
        throw new Error(error.message);
      }
      return ((data ?? []) as Row[]).map((row) => ({
        id: str(row.id),
        name: str(row.name),
        slug: str(row.slug),
      }));
    },

    async listDevices(): Promise<ImportCommitDevice[]> {
      const { data, error } = await supabase
        .from('repair_devices')
        .select('id, brand, model, slug, aliases, product_id')
        .eq('merchant_id', merchantId);
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
    },

    async createServiceType(input) {
      const { data, error } = await supabase
        .from('repair_service_types')
        .insert({ merchant_id: merchantId, name: input.name, slug: input.slug })
        .select('id')
        .single();
      if (error) {
        throw new Error(error.message);
      }
      return { id: str((data as Row).id) };
    },

    async createDevice(input) {
      const { data, error } = await supabase
        .from('repair_devices')
        .insert({
          merchant_id: merchantId,
          brand: input.brand,
          model: input.model,
          slug: input.slug,
          device_type: input.deviceType,
          product_id: input.productId,
          aliases: input.aliases,
        })
        .select('id')
        .single();
      if (error) {
        throw new Error(error.message);
      }
      return { id: str((data as Row).id) };
    },

    async findQuote(deviceId, serviceTypeId, partQuality) {
      let query = supabase
        .from('repair_quotes')
        .select('id')
        .eq('merchant_id', merchantId)
        .eq('device_id', deviceId)
        .eq('service_type_id', serviceTypeId);
      query =
        partQuality === null
          ? query.is('part_quality', null)
          : query.eq('part_quality', partQuality);
      const { data, error } = await query.maybeSingle();
      if (error) {
        throw new Error(error.message);
      }
      return data ? { id: str((data as Row).id) } : null;
    },

    async updateQuotePrice(id, price, isFromPrice) {
      const { error } = await supabase
        .from('repair_quotes')
        .update({ price, is_from_price: isFromPrice })
        .eq('id', id)
        .eq('merchant_id', merchantId);
      if (error) {
        throw new Error(error.message);
      }
    },

    async createQuote(input) {
      const { error } = await supabase.from('repair_quotes').insert({
        merchant_id: merchantId,
        device_id: input.deviceId,
        service_type_id: input.serviceTypeId,
        part_quality: input.partQuality,
        price: input.price,
        is_from_price: input.isFromPrice,
      });
      if (error) {
        throw new Error(error.message);
      }
    },
  };
}
