import { logger } from '@/lib/logger';
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
  maxAmount?: number;
  minAmount?: number;
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
  airtime: 'AIRTIME',
  electricity: 'ELECTRICITY',
  cable_tv: 'CABLE_TV',
};

const MONNIFY_CATEGORY_ALIASES: Record<string, string[]> = {
  AIRTIME: ['AIRTIME'],
  CABLE_TV: ['CABLE_TV'],
  ELECTRICITY: ['ELECTRICITY'],
};

export function getMonnifyCategoryCode(type: string) {
  const parsed = monnifySupportedCategorySchema.safeParse(type);
  return parsed.success ? BACI_TO_MONNIFY_CATEGORY[parsed.data] : undefined;
}

export function getMonnifyCategoryAliases(categoryCode: string) {
  return MONNIFY_CATEGORY_ALIASES[categoryCode] ?? [categoryCode];
}

export function normalizeMonnifyProducts({
  billerCode,
  products,
}: {
  billerCode: string;
  products: BillerProduct[];
}): NormalizedBillItem[] {
  return products.flatMap((prod) => {
    if (
      prod.minAmount != null &&
      prod.maxAmount != null &&
      prod.maxAmount < prod.minAmount
    ) {
      logger.warn({
        message: 'Skipping Monnify product with invalid amount range',
        billerCode,
        maxAmount: prod.maxAmount,
        minAmount: prod.minAmount,
        productCode: prod.productCode,
      });
      return [];
    }

    return [
      {
        itemCode: prod.productCode,
        itemName: prod.name,
        amount: prod.amount ?? prod.minAmount ?? 0,
        itemCurrencySymbol: MONNIFY_CURRENCY,
        isAmountFixed: prod.isAmountFixed ?? false,
        itemFee: prod.fee ?? 0,
        provider: 'monnify',
        billerCode,
        ...(prod.maxAmount != null ? { maxAmount: prod.maxAmount } : {}),
        ...(prod.minAmount != null ? { minAmount: prod.minAmount } : {}),
        productCode: prod.productCode,
      },
    ];
  });
}
