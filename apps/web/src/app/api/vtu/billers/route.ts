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

const MONNIFY_PRODUCT_LOOKUP_CONCURRENCY = 4;
const MONNIFY_BILLER_DISCOVERY_BUDGET_MS = 3_500;

interface NormalizedBillItem {
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

interface KudaBillItemPayload {
  itemCode: string;
  itemName: string;
  amount: number;
  itemCurrencySymbol: string;
  isAmountFixed: boolean;
  itemFee: number;
  billItems?: KudaBillItemPayload[];
}

const kudaBillItemSchema: z.ZodType<KudaBillItemPayload> = z.lazy(() =>
  z.object({
    itemCode: z.string(),
    itemName: z.string(),
    amount: z.number(),
    itemCurrencySymbol: z.string(),
    isAmountFixed: z.boolean(),
    itemFee: z.number(),
    billItems: z.array(kudaBillItemSchema).optional(),
  })
);

function normalizeKudaBillItem(item: KudaBillItemPayload): NormalizedBillItem {
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

const monnifySupportedCategorySchema = z.enum(['electricity', 'cable_tv']);

const BACI_TO_MONNIFY_CATEGORY: Record<
  z.infer<typeof monnifySupportedCategorySchema>,
  string
> = {
  electricity: 'ELECTRICITY',
  cable_tv: 'CABLE_TV',
};

function getMonnifyCategoryCode(type: string) {
  const parsed = monnifySupportedCategorySchema.safeParse(type);
  return parsed.success ? BACI_TO_MONNIFY_CATEGORY[parsed.data] : undefined;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        const item = items[currentIndex];
        if (item !== undefined) {
          results[currentIndex] = await mapper(item);
        }
      }
    }
  );
  await Promise.all(workers);
  return results;
}

function normalizeMonnifyProducts({
  billerCode,
  products,
}: {
  billerCode: string;
  products: z.infer<typeof billerProductSchema>[];
}): NormalizedBillItem[] {
  return products.map((prod) => ({
    itemCode: prod.productCode,
    itemName: prod.name,
    amount: prod.amount ?? 0,
    itemCurrencySymbol: 'NGN',
    isAmountFixed: prod.isAmountFixed ?? false,
    itemFee: prod.fee ?? 0,
    provider: 'monnify',
    billerCode,
    productCode: prod.productCode,
  }));
}

const kudaBillerSchema = z.object({
  billerId: z.string(),
  billerName: z.string(),
  billerType: z.string(),
  categoryId: z.string(),
  categoryName: z.string(),
  billItems: z.array(kudaBillItemSchema).optional(),
});

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
      includeMonnify: searchParams.get('includeMonnify') ?? undefined,
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
    const includeMonnify = parsed.data.includeMonnify;

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
          billItems: biller.billItems?.map(normalizeKudaBillItem),
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
    const monnifyCategory = includeMonnify
      ? getMonnifyCategoryCode(type)
      : undefined;
    if (monnifyCategory) {
      const monnifyDiscoveryController = new AbortController();
      let monnifyDiscoveryTimedOut = false;
      let monnifyDiscoveryTimeoutId: ReturnType<typeof setTimeout> | undefined;
      try {
        const monnifyDiscoveryTimeout = new Promise<NormalizedBiller[]>(
          (resolve) => {
            monnifyDiscoveryTimeoutId = setTimeout(() => {
              monnifyDiscoveryTimedOut = true;
              monnifyDiscoveryController.abort();
              resolve([]);
            }, MONNIFY_BILLER_DISCOVERY_BUDGET_MS);
          }
        );
        const monnifyDiscovery = (async () => {
          const rawBillers = await getMonnifyBillers(monnifyCategory, {
            signal: monnifyDiscoveryController.signal,
          });
          const validatedBillers = z.array(billerSchema).safeParse(rawBillers);
          if (!validatedBillers.success) {
            throw new Error('Monnify biller payload failed validation');
          }

          const normalizedMonnifyBillers = await mapWithConcurrency(
            validatedBillers.data,
            MONNIFY_PRODUCT_LOOKUP_CONCURRENCY,
            async (biller) => {
              let billItems: NormalizedBillItem[] = [];
              try {
                const rawProducts = await getMonnifyBillerProducts(
                  biller.billerCode,
                  { signal: monnifyDiscoveryController.signal }
                );
                const validatedProducts = z
                  .array(billerProductSchema)
                  .safeParse(rawProducts);

                if (validatedProducts.success) {
                  billItems = normalizeMonnifyProducts({
                    billerCode: biller.billerCode,
                    products: validatedProducts.data,
                  });
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
                provider: 'monnify' as const,
                billerCode: biller.billerCode,
                billItems,
              };
            }
          );
          return normalizedMonnifyBillers.filter(
            (biller) => biller.billItems && biller.billItems.length > 0
          );
        })();

        monnifyBillers = await Promise.race([
          monnifyDiscovery,
          monnifyDiscoveryTimeout,
        ]);

        if (monnifyDiscoveryTimedOut) {
          monnifyError = new Error(
            'Monnify biller discovery exceeded route budget'
          );
          console.error('Monnify biller discovery exceeded route budget:', {
            type,
            monnifyCategory,
          });
        }
      } catch (err) {
        monnifyError = err instanceof Error ? err : new Error(String(err));
        console.error('Failed to fetch Monnify billers:', err);
      } finally {
        if (monnifyDiscoveryTimeoutId) {
          clearTimeout(monnifyDiscoveryTimeoutId);
        }
      }
    }

    const mergedBillers = [...kudaBillers, ...monnifyBillers];

    if (mergedBillers.length === 0) {
      const providerError = kudaError ?? monnifyError;
      if (providerError) {
        return NextResponse.json(
          { error: `Failed to fetch billers: ${providerError.message}` },
          { status: 500 }
        );
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
