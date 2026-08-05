import { createClient } from '@/lib/supabase/client';
import type { Json } from '@/types/supabase';

interface StorefrontProfileSettings {
  business_name?: string;
  country?: string;
  site_description?: string;
  support_email?: string;
  support_phone?: string;
}

interface UpdateStorefrontProfileInput {
  merchantId: string;
  expectedUpdatedAt: string;
  settings: StorefrontProfileSettings;
}

function assertValidReceipt(value: Json): void {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    typeof value.id !== 'string' ||
    typeof value.updated_at !== 'string'
  ) {
    throw new Error('Store settings saved without a valid receipt.');
  }
}

export async function updateStorefrontProfile({
  merchantId,
  expectedUpdatedAt,
  settings,
}: UpdateStorefrontProfileInput): Promise<void> {
  const { data, error } = await createClient().rpc(
    'update_merchant_identity_settings',
    {
      p_merchant_id: merchantId,
      p_expected_updated_at: expectedUpdatedAt,
      p_settings: settings,
    }
  );

  if (error) throw error;
  assertValidReceipt(data);
}
