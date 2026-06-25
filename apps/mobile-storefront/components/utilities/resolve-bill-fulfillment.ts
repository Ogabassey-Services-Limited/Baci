import type { Biller, BillItem } from '@/hooks/use-vtu-billers';

export interface ResolvedBillFulfillment {
  provider: 'kuda' | 'monnify';
  billerCode?: string;
  productCode?: string;
}

/**
 * Resolves the fulfillment provider + codes for a selected bill item.
 *
 * Kuda-display + Monnify-fulfillment: when an electricity item was folded with
 * Monnify codes (`monnifyBillerCode`/`monnifyProductCode`), fulfill via Monnify
 * (instant) using those; otherwise use the item/biller's own provider + codes.
 * Shared by the verify payload and the purchase handler so both route identically.
 */
export function resolveBillFulfillment(
  selectedBillItem: BillItem | null,
  selectedBiller: Biller,
  selectedBillItemIdentifier: string | undefined
): ResolvedBillFulfillment {
  const monnifyBillerCode = selectedBillItem?.monnifyBillerCode;
  const monnifyProductCode = selectedBillItem?.monnifyProductCode;
  if (monnifyBillerCode && monnifyProductCode) {
    return {
      provider: 'monnify',
      billerCode: monnifyBillerCode,
      productCode: monnifyProductCode,
    };
  }

  const provider =
    selectedBillItem?.provider ?? selectedBiller.provider ?? 'kuda';
  return {
    provider,
    billerCode: selectedBillItem?.billerCode ?? selectedBiller.billerCode,
    productCode:
      selectedBillItem?.productCode ??
      (provider === 'monnify' ? selectedBillItemIdentifier : undefined),
  };
}
