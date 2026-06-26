import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { createClient as createServerClient } from '@/lib/supabase/server';
import {
  findSendingDomainByName,
  registerSendingDomain,
  type SendingDomainState,
  verifySendingDomain,
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

interface DomainKeyRow {
  domain: string;
  zeptomail_domain_id: string | null;
  status: 'pending' | 'verified' | 'failed';
  sender_local_part: string;
  enabled: boolean;
  dkim_host: string | null;
  dkim_value: string | null;
  bounce_host: string | null;
  bounce_value: string | null;
}

interface DomainOwnerRow {
  merchant_id: string;
  status: 'pending' | 'verified' | 'failed';
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

function stateToColumns(state: SendingDomainState) {
  return {
    zeptomail_domain_id: state.domainKey,
    status: state.verified ? 'verified' : (state.status ?? 'pending'),
    verified_at: state.verified ? new Date().toISOString() : null,
    ...recordsToColumns(state.records),
  };
}

function domainOwnershipCandidates(domain: string): string[] {
  const normalized = domain.toLowerCase();
  return normalized.startsWith('www.')
    ? [normalized, normalized.slice(4)]
    : [normalized, `www.${normalized}`];
}

async function assertMerchantOwnsActiveStorefrontDomain(
  supabase: SupabaseClient,
  merchantId: string,
  domain: string
) {
  // Ownership = an *active* storefront domain row for this merchant. Do NOT
  // additionally require `verified_at`: most live custom domains in `domains`
  // carry a null `verified_at`, so filtering on it would reject legitimately
  // active storefronts (and mismatch the auth-branding lookup, which also keys
  // on status='active' only).
  const { data, error } = await supabase
    .from('domains')
    .select('id')
    .eq('merchant_id', merchantId)
    .in('domain', domainOwnershipCandidates(domain))
    .eq('status', 'active')
    .limit(1);
  if (error) {
    throw new Error(`Failed to load storefront domain: ${error.message}`);
  }
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(
      'Domain must be an active verified storefront domain before email sending can be configured'
    );
  }
}

async function getLocalDomainOwner(
  supabase: SupabaseClient,
  domain: string
): Promise<DomainOwnerRow | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('merchant_id, status')
    .eq('domain', domain)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to load email domain: ${error.message}`);
  }
  return data as DomainOwnerRow | null;
}

async function getRegisterableSendingDomain(
  domain: string,
  options: { allowVerifiedReuse: boolean }
): Promise<SendingDomainState> {
  try {
    return await registerSendingDomain(domain);
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !error.message.toLowerCase().includes('already')
    ) {
      throw error;
    }
    const existing = await findSendingDomainByName(domain);
    if (!existing) {
      throw error;
    }
    if (existing.verified && !options.allowVerifiedReuse) {
      throw new Error(
        'Domain is already verified in ZeptoMail and cannot be claimed automatically'
      );
    }
    return existing;
  }
}

/** The merchant's current sending-domain config, or null if none registered. */
export async function getMerchantEmailDomain(
  merchantId: string,
  scopedSupabase?: SupabaseClient
): Promise<MerchantEmailDomain | null> {
  const supabase = scopedSupabase ?? (await createServerClient());
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
  const supabase = createAdminClient();
  await assertMerchantOwnsActiveStorefrontDomain(supabase, merchantId, domain);

  const localOwner = await getLocalDomainOwner(supabase, domain);
  if (localOwner && localOwner.merchant_id !== merchantId) {
    throw new Error('Domain is already registered by another merchant');
  }

  const state = await getRegisterableSendingDomain(domain, {
    allowVerifiedReuse: localOwner?.merchant_id === merchantId,
  });
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(
      {
        merchant_id: merchantId,
        domain: state.domain,
        // Never auto-enable — the merchant flips it on after verification.
        enabled: false,
        ...stateToColumns(state),
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
    .select(`zeptomail_domain_id, ${SELECT}`)
    .eq('merchant_id', merchantId)
    .maybeSingle();
  if (readError) {
    throw new Error(`Failed to load email domain: ${readError.message}`);
  }
  if (!existing) {
    throw new Error('No sending domain to verify');
  }

  const existingRow = existing as DomainKeyRow;
  let domainKey = existingRow.zeptomail_domain_id;
  if (!domainKey) {
    const recovered = await findSendingDomainByName(existingRow.domain);
    domainKey = recovered?.domainKey ?? null;
    if (!domainKey) {
      if (existingRow.status === 'verified') {
        return rowToDomain(existingRow);
      }
      throw new Error('No sending domain to verify');
    }
  }

  const state = await verifySendingDomain(domainKey);
  const { data, error } = await supabase
    .from(TABLE)
    .update(stateToColumns(state))
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
