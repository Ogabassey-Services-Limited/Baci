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
  // Kuda-display + Monnify-fulfillment: when this DISCO/meter was folded with
  // Monnify codes, verify through Monnify (instant) using those codes.
  const monnifyBillerCode = selectedBillItem?.monnifyBillerCode;
  const monnifyProductCode = selectedBillItem?.monnifyProductCode;
  if (monnifyBillerCode && monnifyProductCode) {
    return {
      billItemIdentifier: selectedBillItemIdentifier,
      billerCode: monnifyBillerCode,
      customerIdentifier,
      productCode: monnifyProductCode,
      provider: 'monnify' as const,
    };
  }

  const provider =
    selectedBillItem?.provider ?? selectedBiller.provider ?? 'kuda';
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
