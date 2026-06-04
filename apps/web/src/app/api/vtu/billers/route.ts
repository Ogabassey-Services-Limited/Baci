import { type NextRequest, NextResponse } from 'next/server';
import { getBillersByCategory } from '@/lib/kuda-bills';
import {
  getBillerProducts as getMonnifyBillerProducts,
  getBillers as getMonnifyBillers,
} from '@/lib/monnify-bills';
import { billersQuerySchema } from '@/schemas/vtu';

interface NormalizedBillItem {
  itemCode: string;
  itemName: string;
  amount: number;
  itemCurrencySymbol: string;
  isAmountFixed: boolean;
  itemFee: number;
  provider: 'kuda' | 'monnify';
  billerCode?: string;
  productCode?: string;
}

interface NormalizedBiller {
  billerId: string;
  billerName: string;
  billerType: string;
  categoryId: string;
  categoryName: string;
  provider: 'kuda' | 'monnify';
  billerCode?: string;
  billItems?: NormalizedBillItem[];
}

interface RawKudaBillItem {
  itemCode: string;
  itemName: string;
  amount: number;
  itemCurrencySymbol: string;
  isAmountFixed: boolean;
  itemFee: number;
}

interface RawKudaBiller {
  billerId: string;
  billerName: string;
  billerType: string;
  categoryId: string;
  categoryName: string;
  billItems?: RawKudaBillItem[];
}

interface RawMonnifyBiller {
  billerCode: string;
  name: string;
  billerCategoryCode?: string;
}

interface RawMonnifyProduct {
  productCode: string;
  name: string;
  amount?: number;
  isAmountFixed?: boolean;
  fee?: number;
}

const BACI_TO_MONNIFY_CATEGORY: Record<string, string> = {
  electricity: 'UTILITY_PAYMENT',
  cable_tv: 'TV_SUBSCRIPTION',
  betting: 'LOTTERY_AND_BETTING',
};

/**
 * GET /api/vtu/billers?type=electricity
 * Returns available billers/providers for a given bill category.
 * Public endpoint — customers need to see billers before purchasing.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = billersQuerySchema.safeParse({
      type: searchParams.get('type'),
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid bill type',
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const type = parsed.data.type;

    let kudaError: Error | null = null;
    let kudaBillers: NormalizedBiller[] = [];
    try {
      const rawKuda = await getBillersByCategory(type);
      if (Array.isArray(rawKuda)) {
        const validatedKuda = rawKuda as RawKudaBiller[];
        kudaBillers = validatedKuda.map((biller) => ({
          billerId: biller.billerId,
          billerName: biller.billerName,
          billerType: biller.billerType,
          categoryId: biller.categoryId,
          categoryName: biller.categoryName,
          provider: 'kuda',
          billItems: biller.billItems?.map((item) => ({
            itemCode: item.itemCode,
            itemName: item.itemName,
            amount: item.amount,
            itemCurrencySymbol: item.itemCurrencySymbol,
            isAmountFixed: item.isAmountFixed,
            itemFee: item.itemFee,
            provider: 'kuda',
          })),
        }));
      }
    } catch (err) {
      kudaError = err instanceof Error ? err : new Error(String(err));
      console.error('Failed to fetch Kuda billers:', err);
    }

    let monnifyError: Error | null = null;
    let monnifyBillers: NormalizedBiller[] = [];
    const monnifyCategory = BACI_TO_MONNIFY_CATEGORY[type];
    if (monnifyCategory) {
      try {
        const billerRes = await getMonnifyBillers(monnifyCategory);
        const rawBillers =
          billerRes &&
          typeof billerRes === 'object' &&
          'requestSuccessful' in billerRes &&
          (billerRes as Record<string, unknown>).requestSuccessful &&
          'responseBody' in billerRes
            ? (billerRes as Record<string, unknown>).responseBody
            : billerRes;

        if (Array.isArray(rawBillers)) {
          const validatedBillers = rawBillers as RawMonnifyBiller[];
          monnifyBillers = await Promise.all(
            validatedBillers.map(async (biller) => {
              let billItems: NormalizedBillItem[] = [];
              try {
                const prodRes = await getMonnifyBillerProducts(
                  biller.billerCode
                );
                const rawProducts =
                  prodRes &&
                  typeof prodRes === 'object' &&
                  'requestSuccessful' in prodRes &&
                  (prodRes as Record<string, unknown>).requestSuccessful &&
                  'responseBody' in prodRes
                    ? (prodRes as Record<string, unknown>).responseBody
                    : prodRes;

                if (Array.isArray(rawProducts)) {
                  const validatedProducts = rawProducts as RawMonnifyProduct[];
                  billItems = validatedProducts.map((prod) => ({
                    itemCode: prod.productCode,
                    itemName: prod.name,
                    amount: prod.amount || 0,
                    itemCurrencySymbol: 'NGN',
                    isAmountFixed: prod.isAmountFixed ?? false,
                    itemFee: prod.fee || 0,
                    provider: 'monnify',
                    billerCode: biller.billerCode,
                    productCode: prod.productCode,
                  }));
                }
              } catch (prodError) {
                console.error(
                  'Failed to fetch Monnify products for biller:',
                  biller.billerCode,
                  prodError
                );
              }

              return {
                billerId: biller.billerCode,
                billerName: biller.name,
                billerType: type,
                categoryId: biller.billerCategoryCode || monnifyCategory,
                categoryName: type,
                provider: 'monnify',
                billerCode: biller.billerCode,
                billItems,
              };
            })
          );
        }
      } catch (err) {
        monnifyError = err instanceof Error ? err : new Error(String(err));
        console.error('Failed to fetch Monnify billers:', err);
      }
    }

    const mergedBillers = [...kudaBillers, ...monnifyBillers];

    if (mergedBillers.length === 0) {
      if (kudaError) {
        throw kudaError;
      }
      if (monnifyError) {
        throw monnifyError;
      }
    }

    return NextResponse.json(
      { billers: mergedBillers },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to fetch billers:', message, error);
    return NextResponse.json(
      { error: `Failed to fetch billers: ${message}` },
      { status: 500 }
    );
  }
}
