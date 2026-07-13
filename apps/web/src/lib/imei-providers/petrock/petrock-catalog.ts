import 'server-only';

import { petrockProductsResponseSchema } from './petrock.schemas';

export interface PetrockCatalogRow {
  active: boolean;
  category_id: string | null;
  category_name: string | null;
  currency: string;
  input_fields: unknown[];
  name: string;
  order_field_name: string | null;
  price_usd: number | null;
  product_id: string;
  provider: 'petrock';
  raw_product: Record<string, unknown>;
  synced_at: string;
  turnaround: string | null;
  type: string;
}

export function normalizePetrockCatalog(
  payload: unknown,
  syncedAt: Date
): PetrockCatalogRow[] {
  const parsed = petrockProductsResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(
      'Petrock products response did not match the expected schema'
    );
  }

  const { categories, currency, products } = parsed.data.data;
  const normalizedCurrency = currency.trim().toUpperCase();
  if (normalizedCurrency !== 'USD') {
    throw new Error('Petrock catalog must use USD currency');
  }
  const timestamp = syncedAt.toISOString();
  return Object.entries(products).flatMap(([productId, product]) => {
    if (product.type.toLowerCase() !== 'imei') return [];

    const categoryId = product.cids[0] ?? product.cid ?? null;
    const rawProduct = product as Record<string, unknown>;
    return [
      {
        active: true,
        category_id: categoryId,
        category_name: categoryId
          ? (categories[categoryId]?.name ?? null)
          : null,
        currency: normalizedCurrency,
        input_fields: product.fields,
        name: product.name,
        order_field_name: product.fields[0]?.name ?? null,
        price_usd: product.price,
        product_id: productId,
        provider: 'petrock' as const,
        raw_product: rawProduct,
        synced_at: timestamp,
        turnaround: product.time ?? null,
        type: 'imei',
      },
    ];
  });
}
