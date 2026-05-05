/**
 * Kuda Bills Extension
 *
 * Generic bill purchase and category-based biller lookup.
 * Extends the core kuda.ts library for electricity, cable TV, and betting.
 */

import { withKudaElectricityBillItems } from '@baci/shared/lib';
import {
  type Biller,
  buildKudaVendMessage,
  extractKudaVoucherPin,
  generateRequestRef,
  getBillersByType,
  isKudaVendSuccessful,
  KudaServiceType,
  type KudaTransactionStatusData,
  kudaRequest,
  type PurchaseResult,
  verifyBillCustomer,
} from './kuda';

// Re-export for convenience
export {
  type Biller,
  getBillersByType,
  type PurchaseResult,
  verifyBillCustomer,
};

/**
 * Maps API bill type strings to Kuda's expected category names.
 * Keys must match the billTypeEnum values in schemas/vtu.ts,
 * NOT the BillType enum values in kuda.ts (which differ for 'data').
 */
const KUDA_CATEGORY_NAMES: Record<string, string> = {
  airtime: 'Airtime',
  data: 'Internet Data',
  electricity: 'Electricity',
  cable_tv: 'CableTv',
  betting: 'Betting',
};

function normalizeKudaString(value: number | string | null | undefined) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || undefined;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return undefined;
}

/**
 * Get billers for a bill category using our enum.
 * Convenience wrapper that maps API bill type strings to Kuda category names.
 */
export async function getBillersByCategory(
  category: string
): Promise<Biller[]> {
  const kudaName = KUDA_CATEGORY_NAMES[category];
  if (!kudaName) {
    throw new Error(`Unknown bill category: ${category}`);
  }

  const billers = await getBillersByType(kudaName);

  return category === 'electricity'
    ? withKudaElectricityBillItems(billers)
    : billers;
}

/**
 * Generic bill purchase for non-airtime/data services.
 * Works for electricity, cable TV, and betting using ADMIN_PURCHASE_BILL.
 *
 * Same Kuda service type as purchaseAirtime/purchaseData but with
 * flexible identifiers instead of hardcoded provider codes.
 * @param customerName - Customer's name for the Kuda transaction record.
 */
export async function purchaseBill(
  billItemIdentifier: string,
  customerIdentification: string,
  amount: number,
  customerName: string = 'Customer',
  requestRef?: string,
  customerPhone?: string
): Promise<PurchaseResult> {
  const reference = requestRef || generateRequestRef();

  try {
    const response = await kudaRequest<
      KudaTransactionStatusData & { reference?: string; Reference?: string }
    >(
      KudaServiceType.ADMIN_PURCHASE_BILL,
      {
        CustomerFirstName: customerName,
        CustomerIdentifier: customerIdentification,
        // For electricity/cable_tv/betting, customerIdentification is a meter
        // number / decoder / wallet — not a phone. Use the customer's real
        // phone for SMS token delivery; only fall back to customerIdentification
        // when no phone is captured (legacy rows).
        PhoneNumber: customerPhone || customerIdentification,
        BillItemIdentifier: billItemIdentifier,
        Amount: Math.round(amount * 100).toString(), // Naira → Kobo
        trackingReference: reference,
      },
      reference
    );

    const vendSucceeded = isKudaVendSuccessful(response.status, response.data);
    const pin = extractKudaVoucherPin(response.data);
    const transactionId =
      normalizeKudaString(response.data?.reference) ??
      normalizeKudaString(response.data?.Reference);

    return {
      success: vendSucceeded,
      reference,
      transactionId,
      ...(pin && { pin }),
      message: vendSucceeded
        ? response.message
        : buildKudaVendMessage(response.message, response.data),
      status: vendSucceeded ? 'successful' : 'failed',
      amount,
    };
  } catch (error) {
    return {
      success: false,
      reference,
      message: error instanceof Error ? error.message : 'Bill purchase failed',
      status: 'failed',
      amount,
    };
  }
}
