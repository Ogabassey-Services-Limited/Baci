import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { assertMerchantOwnsVerifiedStorefrontDomain } from '@/lib/merchant-email-domain-ownership';
import {
  type DomainKeyRow,
  type DomainOwnerRow,
  isUniqueDomainReservationError,
  type MerchantEmailDomain,
  type MerchantEmailDomainWriteContext,
  type Row,
  rowToDomain,
  SELECT,
  stateToColumns,
  TABLE,
  writeDomainViaRpc,
} from '@/lib/merchant-email-domain-shared';
import { createClient as createServerClient } from '@/lib/supabase/server';
import {
  associateSendingDomainWithConfiguredMailagent,
  findSendingDomainByName,
  registerSendingDomain,
  type SendingDomainState,
  verifySendingDomain,
} from '@/lib/zeptomail-domains';

export type { MerchantEmailDomain };

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
