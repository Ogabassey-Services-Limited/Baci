import type { DomainEventV1 } from '@baci/shared/contracts';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { EventDestination } from './event-route-registry';

export type EventDestinationResult = {
  errorCode?: string;
  errorMessage?: string;
  httpStatus?: number;
  providerResponseId?: string;
  requestMayHaveBeenSent?: boolean;
  terminalOutcome?: 'delivered' | 'skipped';
  success: boolean;
};

export type EventDestinationContext = {
  destination: EventDestination;
  event: DomainEventV1;
  signal?: AbortSignal;
  supabase: SupabaseClient;
};

export interface EventDestinationAdapter {
  deliver(context: EventDestinationContext): Promise<EventDestinationResult>;
}
