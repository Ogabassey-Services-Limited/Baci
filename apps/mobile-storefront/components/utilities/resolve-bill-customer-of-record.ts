import type { BillCustomer } from './bill-form-purchase.types';

interface BillCustomerOfRecordInput {
  customer: BillCustomer | null | undefined;
  verifiedCustomerName: string | null;
  verifiedCustomerAddress: string | null;
}

interface BillCustomerOfRecord {
  customerName?: string;
  customerAddress?: string;
}

/**
 * Resolves the bill customer-of-record persisted on the VTU transaction
 * (receipts / history / repeat). Prefers the verified meter/account holder,
 * falling back to the buyer's name then email. The address comes only from the
 * verify step — there's no buyer fallback, since the buyer's address isn't the
 * meter address.
 */
export function resolveBillCustomerOfRecord({
  customer,
  verifiedCustomerName,
  verifiedCustomerAddress,
}: BillCustomerOfRecordInput): BillCustomerOfRecord {
  const buyerFullName = [customer?.first_name, customer?.last_name]
    .filter(Boolean)
    .join(' ')
    .trim();
  const customerName =
    verifiedCustomerName?.trim() ||
    buyerFullName ||
    customer?.email ||
    undefined;
  const customerAddress = verifiedCustomerAddress?.trim() || undefined;
  return { customerName, customerAddress };
}
