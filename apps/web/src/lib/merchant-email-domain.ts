import 'server-only';

import { createClient as createAdminClient } from '@/lib/supabase/admin';
import {
  getSendingDomain,
  registerSendingDomain,
  type ZeptomailDnsRecord,
} from '@/lib/zeptomail-domains';

const TABLE = 'merchant_email_domains';
const SELECT =
  'domain, sender_local_part, status, enabled, dkim_host, dkim_value, bounce_host, bounce_value';

export interface MerchantEmailDomain {
  domain: string;
  senderLocalPart: string;
  status: 'pending' | 'verified' | 'failed';
  enabled: boolean;
  records: ZeptomailDnsRecord[];
}

interface Row {
  domain: string;
  sender_local_part: string;
  status: 'pending' | 'verified' | 'failed';
  enabled: boolean;
  dkim_host: string | null;
  dkim_value: string | null;
  bounce_host: string | null;
  bounce_value: string | null;
}

function rowToDomain(row: Row): MerchantEmailDomain {
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

function recordsToColumns(records: ZeptomailDnsRecord[]) {
  const dkim = records.find((record) => record.type === 'TXT');
  const bounce = records.find((record) => record.type === 'CNAME');
  return {
    dkim_host: dkim?.host ?? null,
    dkim_value: dkim?.value ?? null,
    bounce_host: bounce?.host ?? null,
    bounce_value: bounce?.value ?? null,
  };
}

/** The merchant's current sending-domain config, or null if none registered. */
export async function getMerchantEmailDomain(
  merchantId: string
): Promise<MerchantEmailDomain | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select(SELECT)
    .eq('merchant_id', merchantId)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to load email domain: ${error.message}`);
  }
  return data ? rowToDomain(data as Row) : null;
}

/** Register a domain with ZeptoMail and persist the returned DNS records. */
export async function registerMerchantEmailDomain(
  merchantId: string,
  domain: string
): Promise<MerchantEmailDomain> {
  const state = await registerSendingDomain(domain);
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(
      {
        merchant_id: merchantId,
        domain: state.domain,
        zeptomail_domain_id: state.domainKey,
        status: state.verified ? 'verified' : 'pending',
        // Never auto-enable — the merchant flips it on after verification.
        enabled: false,
        verified_at: state.verified ? new Date().toISOString() : null,
        ...recordsToColumns(state.records),
      },
      { onConflict: 'merchant_id' }
    )
    .select(SELECT)
    .single();
  if (error) {
    throw new Error(`Failed to save email domain: ${error.message}`);
  }
  return rowToDomain(data as Row);
}

/** Re-check verification with ZeptoMail and update the stored status. */
export async function verifyMerchantEmailDomain(
  merchantId: string
): Promise<MerchantEmailDomain> {
  const supabase = createAdminClient();
  const { data: existing, error: readError } = await supabase
    .from(TABLE)
    .select('zeptomail_domain_id')
    .eq('merchant_id', merchantId)
    .maybeSingle();
  if (readError) {
    throw new Error(`Failed to load email domain: ${readError.message}`);
  }
  const domainKey = (existing as { zeptomail_domain_id?: string } | null)
    ?.zeptomail_domain_id;
  if (!domainKey) {
    throw new Error('No sending domain to verify');
  }

  const state = await getSendingDomain(domainKey);
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      status: state.verified ? 'verified' : 'pending',
      verified_at: state.verified ? new Date().toISOString() : null,
      ...recordsToColumns(state.records),
    })
    .eq('merchant_id', merchantId)
    .select(SELECT)
    .single();
  if (error) {
    throw new Error(`Failed to update email domain: ${error.message}`);
  }
  return rowToDomain(data as Row);
}

/** Enable/disable sending from the domain (only a verified domain may enable). */
export async function setMerchantEmailDomainEnabled(
  merchantId: string,
  enabled: boolean
): Promise<MerchantEmailDomain> {
  const supabase = createAdminClient();
  if (enabled) {
    const { data: existing, error: readError } = await supabase
      .from(TABLE)
      .select('status')
      .eq('merchant_id', merchantId)
      .maybeSingle();
    if (readError) {
      throw new Error(`Failed to load email domain: ${readError.message}`);
    }
    if ((existing as { status?: string } | null)?.status !== 'verified') {
      throw new Error('Domain must be verified before enabling');
    }
  }
  const { data, error } = await supabase
    .from(TABLE)
    .update({ enabled })
    .eq('merchant_id', merchantId)
    .select(SELECT)
    .single();
  if (error) {
    throw new Error(`Failed to update email domain: ${error.message}`);
  }
  return rowToDomain(data as Row);
}
