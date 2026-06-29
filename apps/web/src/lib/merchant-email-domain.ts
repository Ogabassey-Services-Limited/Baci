import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { vercel } from '@/lib/vercel';
import {
  associateSendingDomainWithConfiguredMailagent,
  findSendingDomainByName,
  registerSendingDomain,
  type SendingDomainState,
  verifySendingDomain,
  type ZeptomailDnsRecord,
} from '@/lib/zeptomail-domains';

const TABLE = 'merchant_email_domains';
const SELECT =
  'domain, sender_local_part, status, enabled, dkim_host, dkim_value, bounce_host, bounce_value';

type EmailDomainWriteRpc =
  | 'save_merchant_email_domain_registration'
  | 'save_merchant_email_domain_verification'
  | 'set_merchant_email_domain_enabled';

interface MerchantEmailDomainWriteContext {
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

interface DomainKeyRow extends Row {
  zeptomail_domain_id: string | null;
}

interface DomainOwnerRow {
  merchant_id: string;
  status: 'pending' | 'verified' | 'failed';
  enabled: boolean;
}

interface StorefrontDomainOwnershipRow {
  id: string;
  domain: string;
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

async function writeDomainViaRpc(
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

function isUniqueDomainReservationError(error: unknown): boolean {
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

function isVercelDomainVerified(
  verification: Awaited<ReturnType<typeof vercel.verifyDomain>>
) {
  return (
    verification.verified === true &&
    (!verification.verification || verification.verification.length === 0)
  );
}

async function assertMerchantOwnsVerifiedStorefrontDomain(
  supabase: SupabaseClient,
  merchantId: string,
  domain: string
) {
  // Require an active+verified row for the EXACT sender domain. Do NOT accept a
  // www↔apex counterpart: verifying www.example.com does not prove control of
  // example.com (e.g. a delegated subdomain), and registration sends ZeptoMail
  // the submitted domain — so accepting the counterpart would let a merchant
  // reserve a sender domain they haven't actually verified.
  const { data, error } = await supabase
    .from('domains')
    .select('id, domain')
    .eq('merchant_id', merchantId)
    .eq('domain', domain.toLowerCase())
    .eq('status', 'active')
    .in('domain_type', ['custom', 'purchased']);
  if (error) {
    throw new Error(`Failed to load storefront domain: ${error.message}`);
  }
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(
      'Domain must be an active verified storefront domain before email sending can be configured'
    );
  }

  const verifiedDomain = await firstVerifiedVercelDomain(
    data as StorefrontDomainOwnershipRow[]
  );
  if (!verifiedDomain) {
    throw new Error(
      'Domain must be an active verified storefront domain before email sending can be configured'
    );
  }
}

async function firstVerifiedVercelDomain(
  rows: StorefrontDomainOwnershipRow[]
): Promise<StorefrontDomainOwnershipRow | null> {
  for (const row of rows) {
    try {
      const verification = await vercel.verifyDomain(row.domain);
      if (isVercelDomainVerified(verification)) {
        return row;
      }
    } catch {
      // Fail closed: a Vercel/API error means the local `domains` row is not a
      // sufficient proof of sender ownership for self-serve email domains.
    }
  }
  return null;
}

async function getLocalDomainOwner(
  supabase: SupabaseClient,
  domain: string
): Promise<DomainOwnerRow | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('merchant_id, status, enabled')
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
    return associateSendingDomainWithConfiguredMailagent(existing);
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
  domain: string,
  scopedSupabase: SupabaseClient,
  writeContext?: MerchantEmailDomainWriteContext
): Promise<MerchantEmailDomain> {
  const supabase = scopedSupabase;
  const writeSupabase = writeContext?.supabase ?? scopedSupabase;
  await assertMerchantOwnsVerifiedStorefrontDomain(
    supabase,
    merchantId,
    domain
  );

  const localOwner = await getLocalDomainOwner(supabase, domain);
  if (localOwner && localOwner.merchant_id !== merchantId) {
    throw new Error('Domain is already registered by another merchant');
  }

  const state = await getRegisterableSendingDomain(domain, {
    allowVerifiedReuse: localOwner?.merchant_id === merchantId,
  });

  const columns = stateToColumns(state);
  const data = await writeDomainViaRpc(
    writeSupabase,
    'save_merchant_email_domain_registration',
    {
      p_actor_user_id: writeContext?.actorUserId ?? null,
      p_merchant_id: merchantId,
      p_domain: state.domain,
      p_zeptomail_domain_id: columns.zeptomail_domain_id,
      p_status: columns.status,
      p_verified_at: columns.verified_at,
      p_dkim_host: columns.dkim_host,
      p_dkim_value: columns.dkim_value,
      p_bounce_host: columns.bounce_host,
      p_bounce_value: columns.bounce_value,
    },
    'Failed to save email domain'
  ).catch((error) => {
    if (isUniqueDomainReservationError(error)) {
      throw new Error('Domain is already registered by another merchant');
    }
    throw error;
  });
  if (!data) {
    throw new Error('Failed to save email domain: no row returned');
  }
  return rowToDomain(data);
}

/** Re-check verification with ZeptoMail and update the stored status. */
export async function verifyMerchantEmailDomain(
  merchantId: string,
  scopedSupabase: SupabaseClient,
  writeContext?: MerchantEmailDomainWriteContext
): Promise<MerchantEmailDomain> {
  const supabase = scopedSupabase;
  const writeSupabase = writeContext?.supabase ?? scopedSupabase;
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
      // The provider domain is gone (no stored zeptomail_domain_id and ZeptoMail
      // can't find it). Fail CLOSED: a stale 'verified' row would keep the UI
      // green and keep sending from a domain ZeptoMail can no longer validate.
      // Persist a non-verified state (which also stops the sender, since it
      // gates on status='verified') instead of returning the stale row.
      const data = await writeDomainViaRpc(
        writeSupabase,
        'save_merchant_email_domain_verification',
        {
          p_actor_user_id: writeContext?.actorUserId ?? null,
          p_merchant_id: merchantId,
          p_checked_domain: existingRow.domain,
          p_checked_zeptomail_domain_id: existingRow.zeptomail_domain_id,
          p_zeptomail_domain_id: null,
          p_status: 'pending',
          p_verified_at: null,
          p_dkim_host: existingRow.dkim_host,
          p_dkim_value: existingRow.dkim_value,
          p_bounce_host: existingRow.bounce_host,
          p_bounce_value: existingRow.bounce_value,
        },
        'Failed to update email domain'
      );
      if (!data) {
        throw new Error(
          'Sending domain changed while verification was in progress'
        );
      }
      return rowToDomain(data);
    }
  }

  const state = await verifySendingDomain(domainKey);
  const columns = stateToColumns(state);
  const data = await writeDomainViaRpc(
    writeSupabase,
    'save_merchant_email_domain_verification',
    {
      p_actor_user_id: writeContext?.actorUserId ?? null,
      p_merchant_id: merchantId,
      p_checked_domain: existingRow.domain,
      p_checked_zeptomail_domain_id: existingRow.zeptomail_domain_id,
      p_zeptomail_domain_id: columns.zeptomail_domain_id,
      p_status: columns.status,
      p_verified_at: columns.verified_at,
      // Preserve the previously stored DNS records when a partial verify
      // response omits them — otherwise a failed/pending re-check would null
      // out the DKIM/CNAME values the merchant still needs to fix their DNS.
      p_dkim_host: columns.dkim_host ?? existingRow.dkim_host,
      p_dkim_value: columns.dkim_value ?? existingRow.dkim_value,
      p_bounce_host: columns.bounce_host ?? existingRow.bounce_host,
      p_bounce_value: columns.bounce_value ?? existingRow.bounce_value,
    },
    'Failed to update email domain'
  );
  if (!data) {
    throw new Error(
      'Sending domain changed while verification was in progress'
    );
  }
  return rowToDomain(data);
}

/** Enable/disable sending from the domain (only a verified domain may enable). */
export async function setMerchantEmailDomainEnabled(
  merchantId: string,
  enabled: boolean,
  scopedSupabase: SupabaseClient,
  writeContext?: MerchantEmailDomainWriteContext
): Promise<MerchantEmailDomain> {
  const supabase = scopedSupabase;
  const writeSupabase = writeContext?.supabase ?? scopedSupabase;
  if (enabled) {
    const { data: existing, error: readError } = await supabase
      .from(TABLE)
      .select('domain, status')
      .eq('merchant_id', merchantId)
      .maybeSingle();
    if (readError) {
      throw new Error(`Failed to load email domain: ${readError.message}`);
    }
    const existingRow = existing as {
      domain: string;
      status: Row['status'];
    } | null;
    if (existingRow?.status !== 'verified') {
      throw new Error('Domain must be verified before enabling');
    }
    await assertMerchantOwnsVerifiedStorefrontDomain(
      supabase,
      merchantId,
      existingRow.domain
    );
  }
  const data = await writeDomainViaRpc(
    writeSupabase,
    'set_merchant_email_domain_enabled',
    {
      p_actor_user_id: writeContext?.actorUserId ?? null,
      p_merchant_id: merchantId,
      p_enabled: enabled,
    },
    'Failed to update email domain'
  );
  if (!data) {
    throw new Error(
      enabled
        ? 'Domain must be verified before enabling'
        : 'No sending domain to update'
    );
  }
  return rowToDomain(data as Row);
}
