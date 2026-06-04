import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getBillersByCategory } from '@/lib/kuda-bills';
import {
  getBillerProducts as getMonnifyBillerProducts,
  getBillers as getMonnifyBillers,
} from '@/lib/monnify-bills';
import {
  billerProductSchema,
  billerSchema,
} from '@/schemas/monnify-bills-schema';
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

const kudaBillItemSchema = z.object({
  itemCode: z.string(),
  itemName: z.string(),
  amount: z.number(),
  itemCurrencySymbol: z.string(),
  isAmountFixed: z.boolean(),
  itemFee: z.number(),
});

const kudaBillerSchema = z.object({
  billerId: z.string(),
  billerName: z.string(),
  billerType: z.string(),
  categoryId: z.string(),
  categoryName: z.string(),
  billItems: z.array(kudaBillItemSchema).optional(),
});

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
      const validatedKuda = z.array(kudaBillerSchema).safeParse(rawKuda);
      if (validatedKuda.success) {
        kudaBillers = validatedKuda.data.map((biller) => ({
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
      } else {
        throw new Error('Kuda biller payload failed validation');
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
        const rawBillers = await getMonnifyBillers(monnifyCategory);
        const validatedBillers = z.array(billerSchema).safeParse(rawBillers);
        if (validatedBillers.success) {
          monnifyBillers = await Promise.all(
            validatedBillers.data.map(async (biller) => {
              let billItems: NormalizedBillItem[] = [];
              try {
                const rawProducts = await getMonnifyBillerProducts(
                  biller.billerCode
                );
                const validatedProducts = z
                  .array(billerProductSchema)
                  .safeParse(rawProducts);

                if (validatedProducts.success) {
                  billItems = validatedProducts.data.map((prod) => ({
                    itemCode: prod.productCode,
                    itemName: prod.name,
                    amount: prod.amount ?? 0,
                    itemCurrencySymbol: 'NGN',
                    isAmountFixed: prod.isAmountFixed ?? false,
                    itemFee: prod.fee ?? 0,
                    provider: 'monnify',
                    billerCode: biller.billerCode,
                    productCode: prod.productCode,
                  }));
                } else {
                  console.error('Monnify products failed validation:', {
                    billerCode: biller.billerCode,
                    error: validatedProducts.error.flatten(),
                  });
                }
              } catch (prodError) {
                console.error('Failed to fetch Monnify products for biller:', {
                  billerCode: biller.billerCode,
                  error:
                    prodError instanceof Error
                      ? prodError.message
                      : String(prodError),
                });
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
        } else {
          throw new Error('Monnify biller payload failed validation');
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
