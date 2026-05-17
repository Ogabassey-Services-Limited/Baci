const MIN_REDEEM_POINTS = 100;

type LoyaltyRedemptionInput = {
  currentPoints?: unknown;
  points: unknown;
  pointsToNairaRate?: unknown;
};

type LoyaltyRedemptionResult =
  | {
      currentPoints?: number;
      error: string;
      minRedeemPoints?: number;
      requestedPoints?: number;
      success: false;
    }
  | {
      conversionRate: 1;
      pointsRedeemed: number;
      remainingPoints: number;
      success: true;
      walletCredit: number;
    };

function parsePointAmount(value: unknown) {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) ? value : Number.NaN;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) {
      return Number.NaN;
    }
    const numeric = Number(trimmed);
    return Number.isSafeInteger(numeric) ? numeric : Number.NaN;
  }

  return Number.NaN;
}

export function calculateLoyaltyRedemption({
  currentPoints = 0,
  points,
}: LoyaltyRedemptionInput): LoyaltyRedemptionResult {
  const numericPoints = parsePointAmount(points);
  const numericCurrentPoints = parsePointAmount(currentPoints);
  const availablePoints = Number.isFinite(numericCurrentPoints)
    ? numericCurrentPoints
    : 0;

  if (!Number.isSafeInteger(numericPoints) || numericPoints <= 0) {
    return {
      error: 'Invalid redemption amount',
      minRedeemPoints: MIN_REDEEM_POINTS,
      success: false,
    };
  }

  if (numericPoints < MIN_REDEEM_POINTS) {
    return {
      error: 'Minimum redemption is 100 points',
      minRedeemPoints: MIN_REDEEM_POINTS,
      success: false,
    };
  }

  if (numericPoints % MIN_REDEEM_POINTS !== 0) {
    return {
      error: 'Redeem points in 100-point blocks',
      minRedeemPoints: MIN_REDEEM_POINTS,
      success: false,
    };
  }

  if (numericPoints > availablePoints) {
    return {
      currentPoints: availablePoints,
      error: 'Insufficient loyalty points',
      requestedPoints: numericPoints,
      success: false,
    };
  }

  return {
    conversionRate: 1,
    pointsRedeemed: numericPoints,
    remainingPoints: availablePoints - numericPoints,
    success: true,
    walletCredit: numericPoints,
  };
}
