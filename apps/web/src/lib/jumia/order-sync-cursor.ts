import type { SupabaseClient } from '@supabase/supabase-js';
import type { JumiaOrderSyncResult } from '@/lib/jumia/order-sync-result';
import type { MarketplaceIntegrationRow } from './order-sync-mappers';
import {
  clearFullFailureState,
  MAX_FULL_FAILURES_BEFORE_ADVANCE,
  readFullFailureState,
  withFullFailureState,
} from './order-sync-state';

const INITIAL_SYNC_CURSOR = 'initial-sync';

type SyncUpdatePayload = Partial<{ last_sync_at: string }> & {
  sync_config: Record<string, unknown>;
  sync_error: string | null;
};

export class JumiaSyncCursorUpdateError extends Error {
  constructor(
    message: string,
    readonly syncUpdate: SyncUpdatePayload
  ) {
    super(message);
    this.name = 'JumiaSyncCursorUpdateError';
    Object.setPrototypeOf(this, JumiaSyncCursorUpdateError.prototype);
  }
}

export async function persistJumiaSyncCursor({
  earliestFailedSyncAt,
  integration,
  orderErrorsBefore,
  result,
  supabase,
  syncStartedAt,
  syncedAnyOrder,
}: {
  earliestFailedSyncAt: string | null;
  integration: MarketplaceIntegrationRow;
  orderErrorsBefore: number;
  result: JumiaOrderSyncResult;
  supabase: SupabaseClient;
  syncStartedAt: string;
  syncedAnyOrder: boolean;
}) {
  const integrationOrderErrors = result.orderErrors - orderErrorsBefore;
  let syncUpdate: SyncUpdatePayload;
  if (integrationOrderErrors === 0) {
    syncUpdate = {
      last_sync_at: syncStartedAt,
      sync_error: null,
      sync_config: clearFullFailureState(integration.sync_config),
    };
  } else if (syncedAnyOrder) {
    syncUpdate = {
      last_sync_at: earliestFailedSyncAt ?? syncStartedAt,
      sync_error: `Processed with ${integrationOrderErrors} Jumia order error(s); cursor parked at earliest failed order ${earliestFailedSyncAt ?? syncStartedAt} so failed orders remain retryable`,
      sync_config: clearFullFailureState(integration.sync_config),
    };
  } else {
    const failureCursor = integration.last_sync_at ?? INITIAL_SYNC_CURSOR;
    const previousFailureState = readFullFailureState(integration.sync_config);
    const fullFailureCount =
      previousFailureState?.cursor === failureCursor
        ? previousFailureState.count + 1
        : 1;
    syncUpdate =
      fullFailureCount >= MAX_FULL_FAILURES_BEFORE_ADVANCE
        ? {
            last_sync_at: syncStartedAt,
            sync_error: `All ${integrationOrderErrors} Jumia order(s) failed ${fullFailureCount} consecutive time(s); cursor advanced to ${syncStartedAt} and operators should inspect the logged order errors`,
            sync_config: clearFullFailureState(integration.sync_config),
          }
        : {
            sync_error: `All ${integrationOrderErrors} Jumia order(s) failed; cursor not advanced before retry ${fullFailureCount}/${MAX_FULL_FAILURES_BEFORE_ADVANCE}`,
            sync_config: withFullFailureState(
              integration.sync_config,
              failureCursor,
              fullFailureCount
            ),
          };
  }

  const { error: syncError } = await supabase
    .from('marketplace_integrations')
    .update(syncUpdate)
    .eq('id', integration.id)
    .eq('merchant_id', integration.merchant_id);
  if (syncError) {
    throw new JumiaSyncCursorUpdateError(
      `Failed to update Jumia sync cursor: ${syncError.message}`,
      syncUpdate
    );
  }
}
