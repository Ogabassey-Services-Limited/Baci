import type { Biller, BillItem } from '@/hooks/use-vtu-billers';
import { resolveBillFulfillment } from './resolve-bill-fulfillment';

interface CreateBillFormVerifyPayloadInput {
  customerIdentifier: string;
  selectedBiller: Biller;
  selectedBillItem: BillItem | null;
  selectedBillItemIdentifier: string;
}

export function createBillFormVerifyPayload({
  customerIdentifier,
  selectedBiller,
  selectedBillItem,
  selectedBillItemIdentifier,
}: CreateBillFormVerifyPayloadInput) {
  const { provider, billerCode, productCode } = resolveBillFulfillment(
    selectedBillItem,
    selectedBiller,
    selectedBillItemIdentifier
  );
  return {
    billItemIdentifier: selectedBillItemIdentifier,
    billerCode,
    customerIdentifier,
    productCode,
    provider,
  };
}
