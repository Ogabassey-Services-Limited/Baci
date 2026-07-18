import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/env';
import { signScopedSupabaseJwt } from '@/lib/supabase/scoped-jwt';
import type { Database } from '@/types/supabase';

type EventIngressCapabilityInput = {
  eventId: string;
  eventName: string;
  eventTimestamp: string;
  eventType: string;
  kind: 'analytics' | 'platform';
  merchantId?: string;
  producer: 'mobile' | 'web';
  source?: 'mobile_app' | 'server' | 'web';
  trustLevel: 'anonymous_client' | 'tenant_verified_client';
};

function eventTimestampMs(timestamp: string): string {
  const milliseconds = Date.parse(timestamp);
  if (!Number.isSafeInteger(milliseconds)) {
    throw new Error('event_ingress_capability_invalid_timestamp');
  }
  return String(milliseconds);
}

function createEventIngressToken(input: EventIngressCapabilityInput): string {
  const issuedAt = Math.floor(Date.now() / 1_000);
  return signScopedSupabaseJwt({
    aud: 'authenticated',
    baci_event_ingress_event_id: input.eventId,
    baci_event_ingress_event_name: input.eventName,
    baci_event_ingress_event_timestamp_ms: eventTimestampMs(
      input.eventTimestamp
    ),
    baci_event_ingress_event_type: input.eventType,
    baci_event_ingress_kind: input.kind,
    baci_event_ingress_merchant_id: input.merchantId ?? '',
    baci_event_ingress_producer: input.producer,
    baci_event_ingress_source: input.source ?? '',
    baci_event_ingress_trust_level: input.trustLevel,
    exp: issuedAt + 60,
    iat: issuedAt,
    jti: crypto.randomUUID(),
    role: 'anon',
  });
}

export function createEventIngressClient(
  input: EventIngressCapabilityInput
): SupabaseClient<Database> {
  const accessToken = createEventIngressToken(input);
  return createClient<Database>(getSupabaseUrl(), getSupabaseAnonKey(), {
    accessToken: async () => accessToken,
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}
