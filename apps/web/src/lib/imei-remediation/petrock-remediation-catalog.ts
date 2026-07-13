import 'server-only';

import type { PetrockCatalogRow } from '@/lib/imei-providers/petrock/petrock-catalog';
import { parsePetrockRemediationProduct } from './petrock-remediation-product-parser';

function productFields(value: unknown[]) {
  return value.flatMap((field) => {
    if (
      typeof field === 'object' &&
      field !== null &&
      typeof (field as { name?: unknown }).name === 'string'
    ) {
      return [{ name: (field as { name: string }).name }];
    }
    return [];
  });
}

function carrierRegion(carrier: string | null) {
  if (!carrier) return null;
  if (carrier.endsWith(' UK')) return 'GB';
  if (['AT&T', 'T-Mobile US', 'Verizon'].includes(carrier)) return 'US';
  return null;
}

export function buildPetrockRemediationCatalogRows(
  products: readonly PetrockCatalogRow[]
) {
  return products.map((product) => {
    const parsed = parsePetrockRemediationProduct({
      categoryId: product.category_id,
      categoryName: product.category_name,
      fields: productFields(product.input_fields),
      name: product.name,
      priceUsd: product.price_usd,
      productId: product.product_id,
      turnaround: product.turnaround,
    });
    return {
      carrier: parsed.carrier,
      catalog_synced_at: product.synced_at,
      category_id: parsed.categoryId,
      cost_usd: parsed.costUsd,
      excluded_reason: parsed.excludedReason,
      launch_carrier: parsed.launchCarrier,
      model_scope: parsed.modelScope,
      order_field_name: parsed.orderFieldName,
      parser_version: 1,
      provider_product_id: parsed.productId,
      raw_name: parsed.rawName,
      refund_policy: parsed.refundPolicy,
      region: carrierRegion(parsed.carrier),
      status_segment: parsed.statusSegment,
      success_rate: parsed.successRate,
      turnaround: parsed.turnaround,
    };
  });
}
