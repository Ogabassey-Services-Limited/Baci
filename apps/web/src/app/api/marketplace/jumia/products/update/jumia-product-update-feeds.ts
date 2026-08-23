import type { JumiaClient } from '@/lib/jumia/client';
import { updatePrice, updateStatus } from '@/lib/jumia/feeds';
import type { IntegrationScopedMapping } from '@/lib/jumia/product-mapping-scope';
import { logger } from '@/lib/logger';

interface SalePriceResult {
  value: number;
  startAt: string | null;
  endAt: string | null;
}

export function resolveSalePrice(
  overrides: {
    jumia_sale_price?: number | null;
    jumia_sale_start?: string | null;
    jumia_sale_end?: string | null;
  },
  mapping: {
    jumia_sale_price: number | null;
    jumia_sale_start: string | null;
    jumia_sale_end: string | null;
  }
): SalePriceResult | undefined {
  if (
    Object.hasOwn(overrides, 'jumia_sale_price') &&
    overrides.jumia_sale_price != null
  ) {
    return {
      value: overrides.jumia_sale_price,
      startAt: Object.hasOwn(overrides, 'jumia_sale_start')
        ? (overrides.jumia_sale_start ?? null)
        : (mapping.jumia_sale_start ?? null),
      endAt: Object.hasOwn(overrides, 'jumia_sale_end')
        ? (overrides.jumia_sale_end ?? null)
        : (mapping.jumia_sale_end ?? null),
    };
  }

  if (
    Object.hasOwn(overrides, 'jumia_sale_price') &&
    overrides.jumia_sale_price == null
  ) {
    return undefined;
  }

  if (
    (Object.hasOwn(overrides, 'jumia_sale_start') ||
      Object.hasOwn(overrides, 'jumia_sale_end')) &&
    mapping.jumia_sale_price != null
  ) {
    return {
      value: mapping.jumia_sale_price,
      startAt: Object.hasOwn(overrides, 'jumia_sale_start')
        ? (overrides.jumia_sale_start ?? null)
        : (mapping.jumia_sale_start ?? null),
      endAt: Object.hasOwn(overrides, 'jumia_sale_end')
        ? (overrides.jumia_sale_end ?? null)
        : (mapping.jumia_sale_end ?? null),
    };
  }

  return undefined;
}

export function getJumiaProductUpdateReadinessErrors(
  mappings: Array<{ jumia_product_id: string | null }>,
  includesStatus: boolean,
  includesPrice: boolean
): string[] {
  const readyCount = mappings.filter((mapping) => mapping.jumia_product_id).length;
  const pendingCount = mappings.length - readyCount;
  if (pendingCount === 0) return [];

  const suffix =
    readyCount > 0
      ? 'rejected: not all variants are ready on Jumia yet'
      : 'skipped: product has not been assigned a Jumia product ID yet (feed may still be processing)';
  return [
    ...(includesStatus ? [`Status update ${suffix}`] : []),
    ...(includesPrice ? [`Price update ${suffix}`] : []),
  ];
}

export async function pushStatusUpdates(
  client: JumiaClient,
  mappings: IntegrationScopedMapping[],
  isActive: boolean,
  feedIds: string[],
  feedErrors: string[]
): Promise<void> {
  const readyMappings = mappings.filter((mapping) => mapping.jumia_product_id);
  const pendingMappings = mappings.length - readyMappings.length;
  if (pendingMappings > 0 && readyMappings.length > 0) {
    feedErrors.push(
      'Status update rejected: not all variants are ready on Jumia yet'
    );
    return;
  }
  if (readyMappings.length === 0) {
    feedErrors.push(
      'Status update skipped: product has not been assigned a Jumia product ID yet (feed may still be processing)'
    );
    return;
  }

  try {
    const statusFeedId = await updateStatus(
      client,
      readyMappings.map((mapping) => ({
        id: mapping.jumia_product_id as string,
        sellerSku: mapping.jumia_sku,
        status: isActive ? 'active' : 'inactive',
      }))
    );
    feedIds.push(statusFeedId);
  } catch (err) {
    logger.error({ message: 'Jumia status feed failed', error: err });
    feedErrors.push(
      `Status update failed: ${err instanceof Error ? err.message : 'Unknown error'}`
    );
  }
}

export async function pushPriceUpdates(
  client: JumiaClient,
  mappings: IntegrationScopedMapping[],
  overrides: {
    jumia_price?: number;
    jumia_sale_price?: number | null;
    jumia_sale_start?: string | null;
    jumia_sale_end?: string | null;
  },
  currency: string,
  feedIds: string[],
  feedErrors: string[]
): Promise<void> {
  const readyMappings = mappings.filter((mapping) => mapping.jumia_product_id);
  const pendingMappings = mappings.length - readyMappings.length;
  if (pendingMappings > 0 && readyMappings.length > 0) {
    feedErrors.push(
      'Price update rejected: not all variants are ready on Jumia yet'
    );
    return;
  }
  if (readyMappings.length === 0) {
    feedErrors.push(
      'Price update skipped: product has not been assigned a Jumia product ID yet (feed may still be processing)'
    );
    return;
  }

  const priceItems = readyMappings.flatMap((mapping) => {
    const resolvedPrice = Object.hasOwn(overrides, 'jumia_price')
      ? overrides.jumia_price
      : mapping.jumia_price;
    if (resolvedPrice == null) {
      feedErrors.push(
        `Price update skipped for ${mapping.jumia_sku}: no price available (override or existing)`
      );
      return [];
    }

    return [
      {
        id: mapping.jumia_product_id as string,
        sellerSku: mapping.jumia_sku,
        price: {
          value: resolvedPrice,
          currency,
          salePrice: resolveSalePrice(overrides, mapping),
        },
      },
    ];
  });

  if (priceItems.length === 0) {
    return;
  }

  try {
    const priceFeedId = await updatePrice(client, priceItems);
    feedIds.push(priceFeedId);
  } catch (err) {
    logger.error({ message: 'Jumia price feed failed', error: err });
    feedErrors.push(
      `Price update failed: ${err instanceof Error ? err.message : 'Unknown error'}`
    );
  }
}
