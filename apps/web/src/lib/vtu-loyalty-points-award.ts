import {
  calculateVtuAirtimeLoyaltyPoints,
  type VtuPointsTransactionType,
} from '@baci/shared/lib';
import type { SupabaseClient } from '@supabase/supabase-js';

interface VtuAirtimeLoyaltyRow {
  customer_cashback: number | null;
  customer_id: string | null;
  id: string;
  type: VtuPointsTransactionType;
}

interface AwardVtuAirtimeLoyaltyPointsInput {
  metadata: Record<string, unknown>;
  row: VtuAirtimeLoyaltyRow;
  supabase: SupabaseClient;
}

interface AwardVtuAirtimeLoyaltyPointsResult {
  credited: boolean;
  earned: number;
  metadataChanged: boolean;
  newBalance?: number;
}

interface AwardVtuAirtimeLoyaltyPointsRpcResponse {
  awarded?: boolean;
  error?: string;
  new_points_balance?: unknown;
  points_awarded?: unknown;
  reason?: string;
  success?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function coerceFiniteNumber(value: unknown): number | undefined {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function setMetadataValue(
  metadata: Record<string, unknown>,
  key: string,
  value: unknown
) {
  if (Object.is(metadata[key], value)) {
    return false;
  }

  metadata[key] = value;
  return true;
}

function readRpcResponse(
  data: unknown
): AwardVtuAirtimeLoyaltyPointsRpcResponse {
  return isRecord(data) ? data : {};
}

export async function awardVtuAirtimeLoyaltyPoints({
  metadata,
  row,
  supabase,
}: AwardVtuAirtimeLoyaltyPointsInput): Promise<AwardVtuAirtimeLoyaltyPointsResult> {
  const earned = calculateVtuAirtimeLoyaltyPoints({
    customerCashback: row.customer_cashback,
    transactionType: row.type,
  });

  if (earned <= 0 || !row.customer_id) {
    return { credited: false, earned, metadataChanged: false };
  }

  const { data, error } = await supabase.rpc(
    'award_vtu_airtime_loyalty_points',
    {
      p_points: earned,
      p_transaction_id: row.id,
    }
  );

  if (error) {
    console.error('Failed to award VTU airtime loyalty points:', {
      error: error.message,
      points: earned,
      transactionId: row.id,
    });
    return { credited: false, earned, metadataChanged: false };
  }

  const response = readRpcResponse(data);
  if (response.success !== true) {
    console.error('VTU airtime loyalty points award was rejected:', {
      error: response.error,
      points: earned,
      transactionId: row.id,
    });
    return { credited: false, earned, metadataChanged: false };
  }

  const credited =
    response.awarded === true || response.reason === 'already_awarded';
  if (!credited) {
    return { credited: false, earned, metadataChanged: false };
  }

  const rpcEarned = coerceFiniteNumber(response.points_awarded) ?? earned;
  const newBalance = coerceFiniteNumber(response.new_points_balance);
  let metadataChanged = false;

  metadataChanged =
    setMetadataValue(metadata, 'loyaltyPointsAwarded', true) || metadataChanged;
  metadataChanged =
    setMetadataValue(metadata, 'loyaltyPointsEarned', rpcEarned) ||
    metadataChanged;

  if (newBalance !== undefined) {
    metadataChanged =
      setMetadataValue(metadata, 'loyaltyPointsBalance', newBalance) ||
      metadataChanged;
  }

  return {
    credited: true,
    earned: rpcEarned,
    metadataChanged,
    ...(newBalance !== undefined && { newBalance }),
  };
}
