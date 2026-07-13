import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SignJWT } from 'jose';
import {
  getSupabaseAnonKey,
  getSupabaseJwtSecret,
  getSupabaseUrl,
} from '@/env';

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

function createEventIngressToken(
  input: EventIngressCapabilityInput
): Promise<string> {
  return new SignJWT({
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
    role: 'anon',
  })
    .setAudience('authenticated')
    .setExpirationTime('60s')
    .setIssuedAt()
    .setJti(crypto.randomUUID())
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .sign(new TextEncoder().encode(getSupabaseJwtSecret()));
}

export async function createEventIngressClient(
  input: EventIngressCapabilityInput
): Promise<SupabaseClient> {
  const accessToken = await createEventIngressToken(input);
  return createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    accessToken: async () => accessToken,
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}
