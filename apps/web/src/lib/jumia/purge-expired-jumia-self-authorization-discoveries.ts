import { createAdminClient } from '@/lib/supabase/admin';

export async function purgeExpiredJumiaSelfAuthorizationDiscoveries(): Promise<number> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc(
    'purge_expired_jumia_self_authorization_discoveries'
  );

  if (error) {
    throw new Error(
      `Failed to purge expired Jumia self-authorization discoveries: ${error.message}`
    );
  }

  return typeof data === 'number' ? data : 0;
}
