import type { SupabaseClient } from '@supabase/supabase-js';

const DISCOVERY_TTL_MS = 10 * 60 * 1000;

export function getJumiaSelfAuthorizationDiscoveryTtlMs(): number {
  return DISCOVERY_TTL_MS;
}

export async function createJumiaSelfAuthorizationDiscovery(
  supabase: SupabaseClient,
  args: {
    merchantId: string;
    clientKeyHash: string;
    credentialCiphertext: string;
  }
): Promise<string> {
  const { data, error } = await supabase.rpc(
    'create_jumia_self_authorization_discovery',
    {
      p_merchant_id: args.merchantId,
      p_client_key_hash: args.clientKeyHash,
      p_credential_ciphertext: args.credentialCiphertext,
    }
  );

  if (error || !data) {
    throw new Error('Failed to persist Jumia self-authorization discovery');
  }

  return data;
}

export async function loadJumiaSelfAuthorizationDiscovery(
  supabase: SupabaseClient,
  args: {
    discoveryId: string;
    merchantId: string;
    clientKeyHash: string;
  }
): Promise<string | null> {
  const { data, error } = await supabase.rpc(
    'load_jumia_self_authorization_discovery',
    {
      p_discovery_id: args.discoveryId,
      p_merchant_id: args.merchantId,
      p_client_key_hash: args.clientKeyHash,
    }
  );

  if (error) {
    throw new Error('Failed to load Jumia self-authorization discovery');
  }

  return data ?? null;
}

export async function consumeJumiaSelfAuthorizationDiscovery(
  supabase: SupabaseClient,
  args: {
    discoveryId: string;
    merchantId: string;
    clientKeyHash: string;
  }
): Promise<string | null> {
  const { data, error } = await supabase.rpc(
    'consume_jumia_self_authorization_discovery',
    {
      p_discovery_id: args.discoveryId,
      p_merchant_id: args.merchantId,
      p_client_key_hash: args.clientKeyHash,
    }
  );

  if (error) {
    throw new Error('Failed to consume Jumia self-authorization discovery');
  }

  return data ?? null;
}
