import { withKudaElectricityBillItems } from '@baci/shared/lib';
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
import { kudaBillerSchema } from '@/schemas/vtu-billers';
import {
  getMonnifyCategoryAliases,
  type NormalizedBiller,
  type NormalizedBillItem,
  normalizeKudaBillItem,
  normalizeMonnifyProducts,
} from './biller-normalizers';

const MONNIFY_PRODUCT_LOOKUP_CONCURRENCY = 4;
const MONNIFY_BILLER_DISCOVERY_BUDGET_MS = 3_500;

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

export function getErrorMessage(error: Error | null) {
  return error?.message;
}

export async function loadKudaBillers(type: string) {
  try {
    const rawKuda = await getBillersByCategory(type);
    const validatedKuda = z.array(kudaBillerSchema).safeParse(rawKuda);
    if (!validatedKuda.success) {
      throw new Error('Kuda biller payload failed validation');
    }

    // Inject the standard Prepaid/Postpaid items for electricity DISCOs here on
    // the server (idempotent — only fills empty billItems) so cross-provider
    // dedupe has items to match; the mobile app's own call then no-ops.
    const hydratedKuda = withKudaElectricityBillItems(validatedKuda.data);

    return {
      billers: hydratedKuda.map((biller) => ({
        billerId: biller.billerId,
        billerName: biller.billerName,
        billerType: biller.billerType,
        categoryId: biller.categoryId,
        categoryName: biller.categoryName,
        provider: 'kuda' as const,
        // Forward the Kuda-supplied logo so the app can render it (the mobile
        // BillerList reads billerIconUrl); previously dropped here. Coerce null
        // to undefined to satisfy the NormalizedBiller string|undefined type.
        billerIconUrl: biller.billerIconUrl ?? undefined,
        billItems: biller.billItems?.map(normalizeKudaBillItem),
      })),
      error: null,
    };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error('Failed to fetch Kuda billers:', err);
    return { billers: [], error };
  }
}

export async function loadMonnifyBillers({
  monnifyCategory,
  type,
}: {
  monnifyCategory: string;
  type: string;
}) {
  const monnifyDiscoveryController = new AbortController();
  let monnifyDiscoveryTimedOut = false;
  let monnifyDiscoveryTimeoutId: ReturnType<typeof setTimeout> | undefined;
  let monnifyProductError: Error | null = null;
  const captureMonnifyProductError = (error: Error) => {
    monnifyProductError ??= error;
  };

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
    const monnifyDiscovery = getBillersWithProducts({
      captureMonnifyProductError,
      monnifyCategory,
      signal: monnifyDiscoveryController.signal,
      type,
    });

    const billers = await Promise.race([
      monnifyDiscovery,
      monnifyDiscoveryTimeout,
    ]);

    if (monnifyDiscoveryTimedOut) {
      const error = new Error('Monnify biller discovery exceeded route budget');
      console.error('Monnify biller discovery exceeded route budget:', {
        type,
        monnifyCategory,
      });
      return { billers, error };
    }

    if (billers.length === 0 && monnifyProductError) {
      return { billers, error: monnifyProductError };
    }

    return { billers, error: null };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error('Failed to fetch Monnify billers:', err);
    return { billers: [], error };
  } finally {
    if (monnifyDiscoveryTimeoutId) {
      clearTimeout(monnifyDiscoveryTimeoutId);
    }
  }
}

async function getBillersWithProducts({
  captureMonnifyProductError,
  monnifyCategory,
  signal,
  type,
}: {
  captureMonnifyProductError: (error: Error) => void;
  monnifyCategory: string;
  signal: AbortSignal;
  type: string;
}) {
  const rawBillers = await getMonnifyBillers(monnifyCategory, { signal });
  const validatedBillers = z.array(billerSchema).safeParse(rawBillers);
  if (!validatedBillers.success) {
    throw new Error('Monnify biller payload failed validation');
  }
  const categoryAliases = getMonnifyCategoryAliases(monnifyCategory);
  const categoryAliasSet = new Set(categoryAliases);
  const billersInCategory = validatedBillers.data.filter((biller) =>
    biller.categoryCodes.some((categoryCode) =>
      categoryAliasSet.has(categoryCode)
    )
  );

  // TEMP DIAGNOSTIC: counts + category codes only (no PII) to see why a category
  // like electricity yields no Monnify billers. Remove with the other temp logs.
  console.log(
    '[monnify-bills] discovery billers:',
    JSON.stringify({
      monnifyCategory,
      aliases: [...categoryAliasSet],
      rawCount: validatedBillers.data.length,
      inCategoryCount: billersInCategory.length,
      categoryCodesSample: validatedBillers.data
        .slice(0, 10)
        .map((biller) => biller.categoryCodes),
    })
  );

  const normalizedMonnifyBillers = await mapWithConcurrency(
    billersInCategory,
    MONNIFY_PRODUCT_LOOKUP_CONCURRENCY,
    async (biller) => {
      let billItems: NormalizedBillItem[] = [];
      try {
        const rawProducts = await getMonnifyBillerProducts(biller.billerCode, {
          signal,
        });
        const validatedProducts = z
          .array(billerProductSchema)
          .safeParse(rawProducts);

        if (validatedProducts.success) {
          billItems = normalizeMonnifyProducts({
            billerCode: biller.billerCode,
            products: validatedProducts.data.filter(
              (product) =>
                (product.categoryCode
                  ? categoryAliasSet.has(product.categoryCode)
                  : true) &&
                (!product.billerCode ||
                  product.billerCode === biller.billerCode)
            ),
          });
        } else {
          captureMonnifyProductError(
            new Error(
              `Monnify products failed validation for ${biller.billerCode}`
            )
          );
          console.error('Monnify products failed validation:', {
            billerCode: biller.billerCode,
            error: validatedProducts.error.flatten(),
          });
        }
      } catch (prodError) {
        const message =
          prodError instanceof Error ? prodError.message : String(prodError);
        captureMonnifyProductError(
          new Error(
            `Failed to fetch Monnify products for ${biller.billerCode}: ${message}`
          )
        );
        console.error('Failed to fetch Monnify products for biller:', {
          billerCode: biller.billerCode,
          error: message,
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

  // TEMP DIAGNOSTIC: per-biller product counts (no PII) — shows whether billers
  // are dropped for having zero products. Remove with the other temp logs.
  console.log(
    '[monnify-bills] discovery products:',
    JSON.stringify({
      monnifyCategory,
      perBiller: normalizedMonnifyBillers.slice(0, 10).map((biller) => ({
        code: biller.billerCode,
        items: biller.billItems?.length ?? 0,
      })),
    })
  );

  return normalizedMonnifyBillers.filter(
    (biller) => biller.billItems && biller.billItems.length > 0
  );
}
