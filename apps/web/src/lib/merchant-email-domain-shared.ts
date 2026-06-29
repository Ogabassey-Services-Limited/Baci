import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  SendingDomainState,
  ZeptomailDnsRecord,
} from '@/lib/zeptomail-domains';

export const TABLE = 'merchant_email_domains';
export const SELECT =
  'domain, sender_local_part, status, enabled, dkim_host, dkim_value, bounce_host, bounce_value';

export type EmailDomainWriteRpc =
  | 'save_merchant_email_domain_registration'
  | 'save_merchant_email_domain_verification'
  | 'set_merchant_email_domain_enabled';

export interface MerchantEmailDomainWriteContext {
  actorUserId: string;
  supabase: SupabaseClient;
}

export interface MerchantEmailDomain {
  domain: string;
  senderLocalPart: string;
  status: 'pending' | 'verified' | 'failed';
  enabled: boolean;
  records: ZeptomailDnsRecord[];
}

export interface Row {
  domain: string;
  sender_local_part: string;
  status: 'pending' | 'verified' | 'failed';
  enabled: boolean;
  dkim_host: string | null;
  dkim_value: string | null;
  bounce_host: string | null;
  bounce_value: string | null;
}

export interface DomainKeyRow extends Row {
  zeptomail_domain_id: string | null;
}

export interface DomainOwnerRow {
  merchant_id: string;
  status: 'pending' | 'verified' | 'failed';
  enabled: boolean;
}

export interface StorefrontDomainOwnershipRow {
  id: string;
  domain: string;
  domain_type: 'custom' | 'purchased' | string;
}

export function rowToDomain(row: Row): MerchantEmailDomain {
  const records: ZeptomailDnsRecord[] = [];
  if (row.dkim_host && row.dkim_value) {
    records.push({ type: 'TXT', host: row.dkim_host, value: row.dkim_value });
  }
  if (row.bounce_host && row.bounce_value) {
    records.push({
      type: 'CNAME',
      host: row.bounce_host,
      value: row.bounce_value,
    });
  }
  return {
    domain: row.domain,
    senderLocalPart: row.sender_local_part,
    status: row.status,
    enabled: row.enabled,
    records,
  };
}

export function recordsToColumns(records: ZeptomailDnsRecord[]) {
  const dkim = records.find((record) => record.type === 'TXT');
  const bounce = records.find((record) => record.type === 'CNAME');
  return {
    dkim_host: dkim?.host ?? null,
    dkim_value: dkim?.value ?? null,
    bounce_host: bounce?.host ?? null,
    bounce_value: bounce?.value ?? null,
  };
}

export function stateToColumns(state: SendingDomainState) {
  return {
    zeptomail_domain_id: state.domainKey,
    status: state.verified ? 'verified' : (state.status ?? 'pending'),
    verified_at: state.verified ? new Date().toISOString() : null,
    ...recordsToColumns(state.records),
  };
}

export async function writeDomainViaRpc(
  supabase: SupabaseClient,
  rpcName: EmailDomainWriteRpc,
  args: Record<string, unknown>,
  errorPrefix: string
): Promise<Row | null> {
  const { data, error } = await supabase.rpc(rpcName, args).maybeSingle();
  if (error) {
    throw new Error(`${errorPrefix}: ${error.message}`);
  }
  return data as Row | null;
}

export function isUniqueDomainReservationError(error: unknown): boolean {
  if (!(error && typeof error === 'object')) {
    return false;
  }
  const candidate = error as { code?: string; message?: string };
  return (
    candidate.code === '23505' ||
    candidate.message
      ?.toLowerCase()
      .includes('merchant_email_domains_domain') === true
  );
}
