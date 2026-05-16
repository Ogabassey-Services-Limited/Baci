import AsyncStorage from '@react-native-async-storage/async-storage';

type RedemptionKeyInput = {
  customerId: string;
  merchantId: string;
  points: number;
};

export function getPendingLoyaltyRedemptionStorageKey({
  customerId,
  merchantId,
  points,
}: RedemptionKeyInput) {
  return `loyalty-redemption:${customerId}:${merchantId}:${points}`;
}

export async function getOrCreatePendingLoyaltyRedemptionId({
  createId,
  customerId,
  merchantId,
  points,
}: RedemptionKeyInput & { createId: () => string }) {
  const key = getPendingLoyaltyRedemptionStorageKey({
    customerId,
    merchantId,
    points,
  });
  const existing = await AsyncStorage.getItem(key);
  if (existing) {
    return { key, redemptionId: existing };
  }

  const redemptionId = createId();
  await AsyncStorage.setItem(key, redemptionId);
  return { key, redemptionId };
}

export async function clearPendingLoyaltyRedemptionId(key: string) {
  await AsyncStorage.removeItem(key);
}
