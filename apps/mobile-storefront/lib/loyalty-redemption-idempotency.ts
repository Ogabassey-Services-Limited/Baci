import AsyncStorage from '@react-native-async-storage/async-storage';

export const PENDING_LOYALTY_REDEMPTION_TTL_MS = 30 * 60 * 1000;

type RedemptionKeyInput = {
  customerId: string;
  merchantId: string;
  points: number;
};

type PendingLoyaltyRedemptionRecord = {
  attemptId: string;
  createdAt: number;
  pointsBeforeRedeem: number;
  redemptionId: string;
  version: 2;
};

export function getPendingLoyaltyRedemptionStorageKey({
  customerId,
  merchantId,
  points,
}: RedemptionKeyInput) {
  return `loyalty-redemption:${customerId}:${merchantId}:${points}`;
}

function parsePendingLoyaltyRedemptionRecord(
  value: string | null
): PendingLoyaltyRedemptionRecord | null {
  if (!value) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(value) as unknown;

    if (typeof parsedValue === 'object' && parsedValue !== null) {
      const record = parsedValue as Record<string, unknown>;
      const { attemptId, createdAt, pointsBeforeRedeem, redemptionId, version } =
        record;

      if (
        version === 2 &&
        typeof attemptId === 'string' &&
        typeof createdAt === 'number' &&
        typeof pointsBeforeRedeem === 'number' &&
        typeof redemptionId === 'string' &&
        attemptId.length > 0 &&
        Number.isFinite(createdAt) &&
        Number.isFinite(pointsBeforeRedeem) &&
        redemptionId.length > 0
      ) {
        return {
          attemptId,
          createdAt,
          pointsBeforeRedeem,
          redemptionId,
          version,
        };
      }
    }
  } catch {
    return null;
  }

  return null;
}

function canReusePendingLoyaltyRedemptionRecord({
  attemptId,
  currentPoints,
  now,
  record,
  ttlMs,
}: {
  attemptId: string;
  currentPoints: number;
  now: number;
  record: PendingLoyaltyRedemptionRecord;
  ttlMs: number;
}) {
  const ageMs = now - record.createdAt;
  return (
    ageMs >= 0 &&
    ageMs <= ttlMs &&
    record.attemptId === attemptId &&
    record.pointsBeforeRedeem === currentPoints
  );
}

export async function getOrCreatePendingLoyaltyRedemptionId({
  attemptId,
  createId,
  customerId,
  currentPoints,
  merchantId,
  now = Date.now,
  points,
  ttlMs = PENDING_LOYALTY_REDEMPTION_TTL_MS,
}: RedemptionKeyInput & {
  attemptId: string;
  createId: () => string;
  currentPoints: number;
  now?: () => number;
  ttlMs?: number;
}) {
  const key = getPendingLoyaltyRedemptionStorageKey({
    customerId,
    merchantId,
    points,
  });
  const nowMs = now();
  const existingRecord = parsePendingLoyaltyRedemptionRecord(
    await AsyncStorage.getItem(key)
  );

  if (
    existingRecord &&
    canReusePendingLoyaltyRedemptionRecord({
      attemptId,
      currentPoints,
      now: nowMs,
      record: existingRecord,
      ttlMs,
    })
  ) {
    return { key, redemptionId: existingRecord.redemptionId };
  }

  if (existingRecord) {
    await AsyncStorage.removeItem(key);
  }

  const redemptionId = createId();
  await AsyncStorage.setItem(
    key,
    JSON.stringify({
      attemptId,
      createdAt: nowMs,
      pointsBeforeRedeem: currentPoints,
      redemptionId,
      version: 2,
    } satisfies PendingLoyaltyRedemptionRecord)
  );
  return { key, redemptionId };
}

export async function clearPendingLoyaltyRedemptionId(key: string) {
  await AsyncStorage.removeItem(key);
}
