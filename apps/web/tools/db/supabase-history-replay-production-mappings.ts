import { migration } from './supabase-history-replay-migration-path';
import type { ProductionReplayMapping } from './supabase-history-replay-types';

const mappingRules = {
  'append-only-repair': true,
  canonical: true,
  'superseded-final-state': true,
} satisfies Record<ProductionReplayMapping['rule'], true>;

const productionNames: Record<string, string> = {
  '20260623190041': 'enable_realtime_negotiation_requests',
  '20260624211416': 'merchant_email_domains',
  '20260625173604': 'public_read_storefront_feature_settings',
  '20260626131520': 'fix_search_products_condition_filter',
  '20260629154903': 'add_order_fulfillment_timestamps',
  '20260630123511': 'fix_mobile_admin_product_phantom_columns',
  '20260701080400': 'order_item_unit_costs_supplier_analytics',
  '20260701123945': 'supplier_purchase_analytics_branch_scope',
  '20260706202930': 'add_storefront_preflight_rpcs',
  '20260706210329': 'allow_page_config_history_insert',
  '20260707064146': 'add_blog_listing_preflight_rpc',
  '20260708072653': 'create_domain_purchase_transaction_rpc',
  '20260708072825': 'fix_domain_purchase_rpc_merchant_derivation',
  '20260708075932': 'lock_domain_purchase_rpc_service_role',
  '20260708102643': 'optimize_storefront_cached_merchant_and_variant_wrappers',
  '20260708220832': 'drop_authenticated_domain_purchase_rpc',
  '20260713200830': 'split_platform_blog_anon_read_policy',
};

function isMappingRule(
  value: string
): value is ProductionReplayMapping['rule'] {
  return Object.hasOwn(mappingRules, value);
}

export function parseProductionMappings(
  rows: string
): ProductionReplayMapping[] {
  return rows
    .trim()
    .split('\n')
    .map((row) => {
      const [productionVersion, filename, sha256, rule, ...extra] =
        row.split('\t');
      const filenameMatch = filename?.match(/^(\d{14})_([a-z0-9_]+)\.sql$/);
      const linkedName = productionNames[productionVersion ?? ''];
      if (
        !productionVersion ||
        !linkedName ||
        !filename ||
        !filenameMatch ||
        !sha256 ||
        !rule ||
        extra.length > 0 ||
        !isMappingRule(rule)
      ) {
        throw new Error('Invalid production replay mapping row');
      }
      return {
        appliedName: filenameMatch[2] as string,
        appliedVersion: filenameMatch[1] as string,
        linkedName,
        productionVersion,
        repositoryPath: migration(filename),
        rule,
        sha256,
      };
    });
}
