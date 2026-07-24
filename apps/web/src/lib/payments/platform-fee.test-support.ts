// Legacy fee oracles + input grids for platform-fee.test.ts, extracted so the
// test file stays under the 300-line modularity gate. The oracles are verbatim
// copies of the three pre-consolidation formulas; the consolidated module must
// return EXACTLY these values (bit-for-bit).

/** Copy of the old `lib/korapay.ts` calculatePlatformFee (major units, 2dp). */
export function korapayOracle(amount: number) {
  const pct = Number.parseFloat(process.env.PLATFORM_FEE_PERCENTAGE || '2');
  let platformFee = (amount * pct) / 100;
  platformFee = Math.min(platformFee, 2050);
  const merchantAmount = amount - platformFee;
  return {
    platformFee: Math.round(platformFee * 100) / 100,
    merchantAmount: Math.round(merchantAmount * 100) / 100,
    total: amount,
  };
}

/** Copy of the old `lib/paystack.ts` calculatePlatformFee (kobo, integer). */
export function paystackOracle(amountInKobo: number) {
  const PCT = 2;
  let platformFee = Math.round((amountInKobo * PCT) / 100);
  platformFee = Math.min(platformFee, 2050 * 100);
  const merchantAmount = amountInKobo - platformFee;
  return { platformFee, merchantAmount, total: amountInKobo };
}

/** Copy of the old `lib/credit-direct.ts` fee helper (major units, unrounded). */
export function creditDirectFeeOracle(amount: number) {
  const fee = amount * 0.02;
  const cap = 2050;
  return Math.min(fee, cap);
}

export function creditDirectMerchantOracle(amount: number) {
  return amount - creditDirectFeeOracle(amount);
}

// Grids: 0, negative, tiny, float-divergence (14.25), mid, exactly-at-cap,
// above-cap, and huge.
export const NAIRA_AMOUNTS = [
  0, -500, 0.5, 1, 13, 14.25, 35, 100, 1000, 12345.67, 102499.99, 102500,
  102500.01, 200000, 1_000_000, 1e9, 1e12,
];

export const KOBO_AMOUNTS = [
  0, -50000, 1, 13, 24, 25, 149, 150, 250, 100000, 12345678, 10249999, 10250000,
  10250050, 20000000, 1e9, 1e12,
];
