import type { SupabaseClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';
import { resolveEventIngressContext } from '@/lib/events/event-ingress-context';
import type { Database } from '@/types/supabase';

export async function resolveLegacyFanoutContext(input: {
  merchantId: string;
  request: NextRequest;
  supabase: SupabaseClient<Database>;
}): Promise<string | null> {
  // Privileged fanout may observe only the request routing authority.
  const hostOnlyRequest = {
    headers: {
      get: (name: string) =>
        name.toLowerCase() === 'host'
          ? input.request.headers.get('host')
          : null,
    },
  };
  const context = await resolveEventIngressContext({
    merchantId: input.merchantId,
    request: hostOnlyRequest,
    supabase: input.supabase,
  });
  return context.ok && context.verified ? context.merchantId : null;
}
