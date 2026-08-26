import { MAX_AUTO_NEGOTIATION_DISCOUNT_RATE } from '@baci/shared/lib';

// ±1 NGN tolerance mirrors the RPC's parity tolerances so display rounding is
// not mistaken for tampering / breaking the floor.
const PRICE_TOLERANCE = 1;

export interface NegotiationLineInput {
  catalogUnitPrice: number;
  clientUnitPrice: number;
  quantity: number;
  negotiable: boolean;
  vatCategoryCode: string | null;
  vatRate: number | null;
}

export type EligibleLineRejectionCode =
  | 'non_negotiable_line_discounted'
  | 'negotiated_price_below_floor';

export interface EligibleLineDiscountAllocation {
  merchandiseDiscount: number;
  vatRelief: number;
}

export interface EligibleLineDiscountResult {
  totalDiscount: number;
  // Non-null when the order must be rejected: a non-negotiable (budget-brand /
  // Samsung A) line was priced below catalog, or a negotiable line was priced
  // more than `maxRate` below catalog. Rejecting (not clamping) the below-floor
  // case also bounds the assurance fee, which /api/orders derives from the line
  // price — a within-floor line ⇒ assurance ≤ maxRate below catalog too.
  rejectionCode: EligibleLineRejectionCode | null;
  // Aligned with the input lines so order history can preserve the negotiated
  // line boundaries instead of redistributing one order total.
  lineDiscounts?: Array<EligibleLineDiscountAllocation | null>;
}

// Mirrors roundToCents in checkout-order-tax.ts and the RPC trigger formula.
function roundToCents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function computeEligibleLineDiscount(
  lines: NegotiationLineInput[],
  maxRate: number = MAX_AUTO_NEGOTIATION_DISCOUNT_RATE
): EligibleLineDiscountResult {
  let totalDiscount = 0;
  const lineDiscounts: Array<EligibleLineDiscountAllocation | null> = [];

  for (const [lineIndex, lineInput] of lines.entries()) {
    lineDiscounts[lineIndex] = null;
    const quantity = Number(lineInput.quantity);
    const catalogUnit = Number(lineInput.catalogUnitPrice);
    const clientUnit = Number(lineInput.clientUnitPrice);
    if (
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      !Number.isFinite(catalogUnit) ||
      catalogUnit < 0 ||
      !Number.isFinite(clientUnit) ||
      clientUnit < 0
    ) {
      // The route validates items separately; skip defensively here.
      continue;
    }

    const catalogLine = roundToCents(catalogUnit * quantity);
    const clientLine = roundToCents(clientUnit * quantity);
    // Only standard-rated ('S') lines carry VAT — matches the order_items
    // trigger and computeAgenticOrderTax exactly.
    const rawRate =
      (lineInput.vatCategoryCode ?? 'S') === 'S'
        ? Number(lineInput.vatRate ?? 7.5)
        : 0;
    const rate = Number.isFinite(rawRate) && rawRate >= 0 ? rawRate : 0;

    if (!lineInput.negotiable) {
      if (catalogLine - clientLine > PRICE_TOLERANCE) {
        return {
          totalDiscount: 0,
          rejectionCode: 'non_negotiable_line_discounted',
        };
      }
      continue;
    }

    const reduction = catalogLine - clientLine;
    if (reduction <= 0) {
      // At or above catalog → no discount for this line.
      continue;
    }
    // The 2% floor is on the price (subtotal) reduction.
    const maxReduction = roundToCents(catalogLine * maxRate);
    if (reduction - maxReduction > PRICE_TOLERANCE) {
      return {
        totalDiscount: 0,
        rejectionCode: 'negotiated_price_below_floor',
      };
    }
    // The persisted order line stays at CATALOG price (the RPC ignores client
    // prices), so its VAT is on the full catalog line. The discount must also
    // absorb the VAT on the reduction for the gateway total to equal the
    // negotiated total the customer saw.
    const reductionVat = roundToCents((reduction * rate) / 100);
    totalDiscount = roundToCents(totalDiscount + reduction + reductionVat);
    lineDiscounts[lineIndex] = {
      merchandiseDiscount: reduction,
      vatRelief: reductionVat,
    };
  }

  return {
    totalDiscount,
    rejectionCode: null,
    ...(lineDiscounts.some(Boolean) ? { lineDiscounts } : {}),
  };
}
