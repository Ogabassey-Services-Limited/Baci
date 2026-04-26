import { createLogger } from '@/lib/logger';
import { hydrateProductRowsWithStorefrontVariants } from '@/lib/storefront-product-variants';

const log = createLogger('ProductHydration');

export interface HydratableProductRow extends Record<string, unknown> {
  has_variants?: unknown;
  id?: unknown;
  variants?: unknown;
}

export function needsVariantHydration(row: HydratableProductRow): boolean {
  return (
    row.has_variants === true &&
    (!Array.isArray(row.variants) || row.variants.length === 0)
  );
}

export async function hydrateRowsNeedingStorefrontVariants(
  rows: HydratableProductRow[]
): Promise<HydratableProductRow[]> {
  const rowsToHydrate = rows.filter(needsVariantHydration);
  if (rowsToHydrate.length === 0) {
    return rows;
  }

  let hydratedRows: HydratableProductRow[];
  try {
    hydratedRows =
      await hydrateProductRowsWithStorefrontVariants(rowsToHydrate);
  } catch (error) {
    log.warn('Failed to hydrate storefront variants; using embedded rows', {
      error,
    });
    return rows;
  }

  const hydratedById = new Map(
    hydratedRows
      .filter((row) => typeof row.id === 'string')
      .map((row) => [row.id as string, row])
  );

  return rows.map((row) => {
    if (typeof row.id !== 'string') {
      return row;
    }

    return hydratedById.get(row.id) ?? row;
  });
}
