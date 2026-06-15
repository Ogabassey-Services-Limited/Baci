import type { Biller, BillItem } from '@/hooks/use-vtu-billers';

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
  const provider = selectedBillItem?.provider ?? selectedBiller.provider ?? 'kuda';
  return {
    billItemIdentifier: selectedBillItemIdentifier,
    billerCode: selectedBillItem?.billerCode ?? selectedBiller.billerCode,
    customerIdentifier,
    productCode:
      selectedBillItem?.productCode ??
      (provider === 'monnify' ? selectedBillItemIdentifier : undefined),
    provider,
  };
}
