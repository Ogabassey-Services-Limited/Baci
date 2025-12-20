import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const KUDA_COMMISSION_RATES: Record<string, number> = {
  MTN_AIRTIME: 0.03,
  AIRTEL_AIRTIME: 0.03,
  GLO_AIRTIME: 0.04,
  "9MOBILE_AIRTIME": 0.05,
  DEFAULT: 0.02,
};

Deno.serve(async (req) => {
  const { action, data } = await req.json();

  let result = {};

  switch (action) {
    case "calculate_vtu":
      const { amount, provider, category = "AIRTIME", merchantSplit = 50 } = data;
      const key = `${provider.toUpperCase()}_${category}`;
      const rate = KUDA_COMMISSION_RATES[key] || KUDA_COMMISSION_RATES.DEFAULT;
      
      const totalCommission = amount * rate;
      const merchantEarning = totalCommission * (merchantSplit / 100);
      const platformEarning = totalCommission - merchantEarning;

      result = {
        platformEarning: Math.round(platformEarning * 100) / 100,
        merchantEarning: Math.round(merchantEarning * 100) / 100,
        totalCommission: Math.round(totalCommission * 100) / 100,
        commissionRate: rate * 100,
      };
      break;

    case "calculate_order":
      const { subtotal, taxRate = 0.075, shippingFee = 0 } = data;
      const taxAmount = subtotal * taxRate;
      const total = subtotal + taxAmount + shippingFee;

      result = {
        taxAmount: Math.round(taxAmount * 100) / 100,
        total: Math.round(total * 100) / 100,
      };
      break;

    case "redeem_loyalty":
      // Loyalty Points Redemption: 100 points = ₦100 (1:1 ratio)
      const { points, currentPoints = 0, pointsToNairaRate = 1 } = data;
      const minRedeemPoints = 100; // Minimum 100 points to redeem

      if (points < minRedeemPoints) {
        result = {
          success: false,
          error: `Minimum ${minRedeemPoints} points required`,
          minRedeemPoints,
        };
        break;
      }

      if (points > currentPoints) {
        result = {
          success: false,
          error: "Insufficient loyalty points",
          currentPoints,
          requestedPoints: points,
        };
        break;
      }

      const walletCredit = Math.round(points * pointsToNairaRate * 100) / 100;
      const remainingPoints = currentPoints - points;

      result = {
        success: true,
        pointsRedeemed: points,
        walletCredit,
        remainingPoints,
        conversionRate: pointsToNairaRate,
      };
      break;

    default:
      return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400 });
  }

  return new Response(JSON.stringify(result), {
    headers: { "Content-Type": "application/json" },
  });
});
