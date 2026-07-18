import type { SupabaseClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';
import {
  type EventIngressContext,
  resolveEventIngressContext,
} from '@/lib/events/event-ingress-context';
import type { Database } from '@/types/supabase';

export type ConversionRouteMerchantContext = {
  context: EventIngressContext;
  persistenceMerchantId: string | null;
  verifiedMerchantId: string | null;
};

const DEFAULT_MERCHANT_SLUG = 'ogabassey';

async function resolveLegacyMerchant(
  supabase: SupabaseClient<Database>,
  claimedMerchantId: string | undefined,
  origin: string
): Promise<string | null> {
  if (claimedMerchantId) {
    const { data, error } = await supabase
      .from('merchants')
      .select('id')
      .eq('id', claimedMerchantId)
      .maybeSingle();
    if (!error && data?.id) return data.id;
  }
  const slug =
    origin.match(/^https?:\/\/([^.]+)\./)?.[1] ?? DEFAULT_MERCHANT_SLUG;
  const { data, error } = await supabase
    .from('merchants')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  return error ? null : (data?.id ?? null);
}

export async function resolveConversionRouteMerchantContext(input: {
  claimedMerchantId?: string;
  request: NextRequest;
  supabase: SupabaseClient<Database>;
}): Promise<ConversionRouteMerchantContext> {
  const persistenceMerchantId = await resolveLegacyMerchant(
    input.supabase,
    input.claimedMerchantId,
    input.request.headers.get('origin') ?? ''
  );
  const context = await resolveEventIngressContext({
    merchantId: input.claimedMerchantId ?? persistenceMerchantId ?? undefined,
    request: input.request,
    supabase: input.supabase,
  });
  // Resolve path context first, then require an independent Host-only authority pass.
  const hostOnlyRequest = {
    headers: {
      get: (name: string) =>
        name.toLowerCase() === 'host'
          ? input.request.headers.get('host')
          : null,
    },
  };
  const authorityContext = await resolveEventIngressContext({
    merchantId: input.claimedMerchantId ?? persistenceMerchantId ?? undefined,
    request: hostOnlyRequest,
    supabase: input.supabase,
  });
  return {
    context,
    persistenceMerchantId:
      context.ok && context.verified
        ? context.merchantId
        : persistenceMerchantId,
    verifiedMerchantId:
      authorityContext.ok && authorityContext.verified
        ? authorityContext.merchantId
        : null,
  };
}
