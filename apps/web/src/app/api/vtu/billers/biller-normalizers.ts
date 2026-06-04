import type { BillerProduct } from '@/schemas/monnify-bills-schema';
import {
  type KudaBillItemPayload,
  type MonnifySupportedCategory,
  monnifySupportedCategorySchema,
} from '@/schemas/vtu-billers';

const MONNIFY_CURRENCY = 'NGN';

export interface NormalizedBillItem {
  itemCode: string;
  itemName: string;
  amount: number;
  itemCurrencySymbol: string;
  isAmountFixed: boolean;
  itemFee: number;
  provider: 'kuda' | 'monnify';
  billerCode?: string;
  billItems?: NormalizedBillItem[];
  productCode?: string;
}

export interface NormalizedBiller {
  billerId: string;
  billerName: string;
  billerType: string;
  categoryId: string;
  categoryName: string;
  provider: 'kuda' | 'monnify';
  billerCode?: string;
  billItems?: NormalizedBillItem[];
}

export interface BillersResponsePayload {
  billers: NormalizedBiller[];
  kudaError?: string;
  monnifyError?: string;
}

export function normalizeKudaBillItem(
  item: KudaBillItemPayload
): NormalizedBillItem {
  return {
    itemCode: item.itemCode,
    itemName: item.itemName,
    amount: item.amount,
    itemCurrencySymbol: item.itemCurrencySymbol,
    isAmountFixed: item.isAmountFixed,
    itemFee: item.itemFee,
    provider: 'kuda',
    billItems: item.billItems?.map(normalizeKudaBillItem),
  };
}

const BACI_TO_MONNIFY_CATEGORY: Record<MonnifySupportedCategory, string> = {
  electricity: 'ELECTRICITY',
  cable_tv: 'CABLE_TV',
};

export function getMonnifyCategoryCode(type: string) {
  const parsed = monnifySupportedCategorySchema.safeParse(type);
  return parsed.success ? BACI_TO_MONNIFY_CATEGORY[parsed.data] : undefined;
}

export function normalizeMonnifyProducts({
  billerCode,
  products,
}: {
  billerCode: string;
  products: BillerProduct[];
}): NormalizedBillItem[] {
  return products.map((prod) => ({
    itemCode: prod.productCode,
    itemName: prod.name,
    amount: prod.amount ?? 0,
    itemCurrencySymbol: MONNIFY_CURRENCY,
    isAmountFixed: prod.isAmountFixed ?? false,
    itemFee: prod.fee ?? 0,
    provider: 'monnify',
    billerCode,
    productCode: prod.productCode,
  }));
}
