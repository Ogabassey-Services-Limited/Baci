/**
 * Kuda Bills Extension
 *
 * Generic bill purchase and category-based biller lookup.
 * Extends the core kuda.ts library for electricity, cable TV, and betting.
 */

import {
  type Biller,
  generateRequestRef,
  getBillersByType,
  KudaServiceType,
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

/**
 * Get billers for a bill category using our enum.
 * Convenience wrapper that maps API bill type strings to Kuda category names.
 */
export function getBillersByCategory(category: string): Promise<Biller[]> {
  const kudaName = KUDA_CATEGORY_NAMES[category];
  if (!kudaName) {
    throw new Error(`Unknown bill category: ${category}`);
  }
  return getBillersByType(kudaName);
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
  requestRef?: string
): Promise<PurchaseResult> {
  const reference = requestRef || generateRequestRef();

  try {
    // Kuda purchase response: { reference: string; pin: string | null }
    const response = await kudaRequest<{
      reference: string;
      pin: string | null;
    }>(
      KudaServiceType.ADMIN_PURCHASE_BILL,
      {
        CustomerFirstName: customerName,
        CustomerIdentifier: customerIdentification,
        PhoneNumber: customerIdentification,
        BillItemIdentifier: billItemIdentifier,
        Amount: (amount * 100).toString(), // Convert Naira to Kobo
        trackingReference: reference,
      },
      reference
    );

    return {
      success: response.status,
      reference,
      transactionId: response.data?.reference,
      message: response.message,
      status: response.status ? 'successful' : 'failed',
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
