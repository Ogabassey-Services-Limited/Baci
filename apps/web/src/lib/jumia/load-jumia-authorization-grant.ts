import type { SupabaseClient } from '@supabase/supabase-js';
import { JumiaApiError } from '@/lib/jumia/jumia-api-error';

type JumiaAuthorizationGrantRow = {
  credential_ciphertext: string;
  token_expires_at: string;
  rotation_version: number;
  client_key_hash: string;
};

export async function loadJumiaAuthorizationGrant(
  supabase: SupabaseClient,
  authorizationId: string,
  merchantId: string
): Promise<JumiaAuthorizationGrantRow> {
  const { data, error } = await supabase.rpc(
    'load_jumia_authorization_credentials',
    {
      p_authorization_id: authorizationId,
      p_merchant_id: merchantId,
    }
  );

  if (error) {
    throw new JumiaApiError(404, 'Jumia authorization grant not found', error);
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (
    !row ||
    typeof row !== 'object' ||
    !('credential_ciphertext' in row) ||
    typeof row.credential_ciphertext !== 'string' ||
    !('token_expires_at' in row) ||
    typeof row.token_expires_at !== 'string' ||
    !('rotation_version' in row) ||
    typeof row.rotation_version !== 'number' ||
    !('client_key_hash' in row) ||
    typeof row.client_key_hash !== 'string'
  ) {
    throw new JumiaApiError(404, 'Jumia authorization grant not found');
  }

  return row as JumiaAuthorizationGrantRow;
}
