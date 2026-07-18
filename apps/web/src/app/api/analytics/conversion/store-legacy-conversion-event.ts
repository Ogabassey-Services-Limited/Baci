import type { SupabaseClient } from '@supabase/supabase-js';
import { conversionEventPayload } from '@/lib/events/conversion-event-payload';
import { logger } from '@/lib/logger';
import type { ConversionEventRequest } from '@/schemas/conversion-event';
import type { Database } from '@/types/supabase';

export async function storeLegacyConversionEvent(
  supabase: SupabaseClient<Database>,
  merchantId: string,
  eventType: string,
  eventId: string,
  input: ConversionEventRequest
): Promise<void> {
  const { error } = await supabase.from('analytics_events').upsert(
    {
      event_data: conversionEventPayload.toStoredEventData(input),
      event_id: eventId,
      event_timestamp: new Date(input.event_time * 1_000).toISOString(),
      event_type: eventType,
      merchant_id: merchantId,
      source: input.event_source,
    },
    { ignoreDuplicates: true, onConflict: 'merchant_id,event_id,event_type' }
  );
  if (error) {
    logger.warn({
      error,
      eventType,
      merchantId,
      message: 'Failed to log conversion event locally',
    });
  }
}
