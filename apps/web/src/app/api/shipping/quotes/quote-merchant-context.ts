import type { SupabaseClient } from '@supabase/supabase-js';
import { hasPermission } from '@/lib/api-auth';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { deriveMerchantLocation } from '@/lib/shipping/order-shipment-booking-utils';
import type { ShippingAddress } from '@/lib/shipping/types';
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server';

type QuoteInput = {
  merchantId?: string;
  sender?: ShippingAddress;
  shipmentType: 'domestic' | 'international';
};

type MerchantDetails = {
  business_address: string | null;
  business_name: string | null;
  phone: string | null;
};

export type QuoteMerchantContextResult =
  | {
      ok: true;
      merchantId?: string;
      senderInfo?: ShippingAddress;
    }
  | { error: string; ok: false; status: number };

type HeaderReader = {
  headers: {
    get(name: string): string | null;
  };
};

function normalizeHeader(value: string | null): string | undefined {
  return value?.trim().toLowerCase() || undefined;
}

function normalizeHost(value: string | null): string {
  return (value ?? '').split(':')[0]?.trim().toLowerCase() ?? '';
}

function isTrustedStorefrontHeader(request: HeaderReader): boolean {
  const host = normalizeHost(request.headers.get('host'));
  const slug = normalizeHeader(request.headers.get('x-merchant-slug'));
  const domain = normalizeHeader(request.headers.get('x-merchant-domain'));
  const rootDomain = (
    process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com'
  ).toLowerCase();

  if (domain && (host === domain || host === `www.${domain}`)) {
    return true;
  }

  if (!slug) return false;

  return (
    host === `${slug}.${rootDomain}` ||
    host === `${slug}.localhost` ||
    host.startsWith(`${slug}.localhost:`)
  );
}

async function resolveAuthenticatedMerchantId(
  request: HeaderReader,
  supabase: SupabaseClient,
  requestedMerchantId?: string
): Promise<string | undefined | QuoteMerchantContextResult> {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : undefined;

  const authClient = token ? supabase : await createServerSupabaseClient();
  const {
    data: { user },
  } = token
    ? await authClient.auth.getUser(token)
    : await authClient.auth.getUser();

  if (!user) return undefined;

  const merchantContext = await getMerchantForApiRequest(supabase, user.id, {
    requestedMerchantId,
  });
  if (!merchantContext) return undefined;

  const access = toUserAccess(merchantContext);
  if (!hasPermission(access, 'orders', 'fulfill')) {
    return { error: 'Forbidden', ok: false, status: 403 };
  }

  return merchantContext.merchantId;
}

async function resolveStorefrontMerchantId(
  request: HeaderReader,
  supabase: SupabaseClient
): Promise<string | undefined | QuoteMerchantContextResult> {
  if (!isTrustedStorefrontHeader(request)) return undefined;

  const slug = normalizeHeader(request.headers.get('x-merchant-slug'));
  if (slug) {
    const { data, error } = await supabase
      .from('merchants')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (error) {
      console.error('Error resolving storefront merchant slug:', error);
      return {
        error: 'Failed to resolve storefront merchant',
        ok: false,
        status: 500,
      };
    }

    const merchant = data as { id?: string } | null;
    if (merchant?.id) return merchant.id;
  }

  const domain = normalizeHeader(request.headers.get('x-merchant-domain'));
  if (!domain) return undefined;

  const { data, error } = await supabase
    .from('domains')
    .select('merchant_id')
    .eq('domain', domain)
    .eq('status', 'active')
    .maybeSingle();
  if (error) {
    console.error('Error resolving storefront merchant domain:', error);
    return {
      error: 'Failed to resolve storefront merchant',
      ok: false,
      status: 500,
    };
  }

  const domainRow = data as { merchant_id?: string } | null;
  return domainRow?.merchant_id;
}

async function resolveMerchantDetails(
  supabase: SupabaseClient,
  merchantId: string
): Promise<MerchantDetails | null | QuoteMerchantContextResult> {
  const { data, error } = await supabase
    .from('merchants')
    .select('business_name, business_address, phone')
    .eq('id', merchantId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching merchant for sender info:', error);
    return {
      error: 'Failed to resolve merchant sender',
      ok: false,
      status: 500,
    };
  }

  return (data as MerchantDetails | null) ?? null;
}

function buildSenderInfo(details: MerchantDetails): ShippingAddress {
  const location = deriveMerchantLocation(details.business_address);
  return {
    name: details.business_name || 'Merchant',
    phone: details.phone || '',
    address: location.address,
    city: location.city,
    state: location.state,
    country: 'Nigeria',
    countryCode: 'NG',
  };
}

export async function resolveQuoteMerchantContext({
  data,
  request,
  supabase,
}: {
  data: QuoteInput;
  request: HeaderReader;
  supabase: SupabaseClient;
}): Promise<QuoteMerchantContextResult> {
  const authenticatedMerchantId = await resolveAuthenticatedMerchantId(
    request,
    supabase,
    data.merchantId
  );
  if (authenticatedMerchantId && typeof authenticatedMerchantId === 'object') {
    return authenticatedMerchantId;
  }

  const storefrontMerchantId = await resolveStorefrontMerchantId(
    request,
    supabase
  );
  if (storefrontMerchantId && typeof storefrontMerchantId === 'object') {
    return storefrontMerchantId;
  }

  const merchantId =
    authenticatedMerchantId ?? storefrontMerchantId ?? data.merchantId;
  const trustedSenderMerchantId =
    authenticatedMerchantId ?? storefrontMerchantId;

  let senderInfo =
    data.shipmentType === 'international' ? undefined : data.sender;

  if (
    trustedSenderMerchantId &&
    (data.shipmentType === 'international' || !senderInfo)
  ) {
    const details = await resolveMerchantDetails(
      supabase,
      trustedSenderMerchantId
    );
    if (details && 'ok' in details) return details;
    if (details) senderInfo = buildSenderInfo(details);
  }

  return {
    ok: true,
    merchantId,
    senderInfo,
  };
}
