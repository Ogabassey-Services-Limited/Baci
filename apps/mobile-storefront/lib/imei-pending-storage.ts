import {
  type ImeiServiceTierKey,
  isImeiServiceTierKey,
} from '@baci/shared/imei';
import AsyncStorage from '@react-native-async-storage/async-storage';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface PendingImeiLookup {
  createdAt: string;
  lookupId: string;
  tier: ImeiServiceTierKey;
}

export function pendingImeiStorageKey(merchantId: string, customerId: string) {
  return `baci:imei-pending:v1:${merchantId}:${customerId}`;
}

export async function savePendingImeiLookup(
  key: string,
  pending: PendingImeiLookup
) {
  await AsyncStorage.setItem(key, JSON.stringify(pending));
}

export async function clearPendingImeiLookup(key: string) {
  await AsyncStorage.removeItem(key);
}

export async function loadPendingImeiLookup(
  key: string
): Promise<PendingImeiLookup | null> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;

  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (
      typeof value.lookupId !== 'string' ||
      !UUID_PATTERN.test(value.lookupId) ||
      typeof value.createdAt !== 'string' ||
      !Number.isFinite(Date.parse(value.createdAt)) ||
      typeof value.tier !== 'string' ||
      !isImeiServiceTierKey(value.tier)
    ) {
      throw new Error('Invalid pending IMEI lookup');
    }
    return {
      createdAt: value.createdAt,
      lookupId: value.lookupId,
      tier: value.tier,
    };
  } catch {
    await AsyncStorage.removeItem(key);
    return null;
  }
}
