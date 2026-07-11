import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const MIGRATION_SOURCE = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    '../../../../supabase/migrations/20260710123000_storefront_public_read_snapshots.sql'
  ),
  'utf8'
);

describe('storefront public read snapshots migration', () => {
  it('enforces normalized active-domain uniqueness after deterministic cleanup', () => {
    expect(MIGRATION_SOURCE).toContain('ambiguous_active_storefront_domain');
    expect(MIGRATION_SOURCE).toContain(
      'count(DISTINCT domain_row.merchant_id) > 1'
    );
    expect(MIGRATION_SOURCE).toContain('ranked_active_domains');
    expect(MIGRATION_SOURCE).toContain('ranked.duplicate_rank > 1');
    expect(MIGRATION_SOURCE).toContain('domains_active_normalized_domain_uidx');
    expect(MIGRATION_SOURCE).toContain(
      'pg_catalog.lower(pg_catalog.btrim(domain))'
    );
    expect(MIGRATION_SOURCE).toMatch(
      /CREATE INDEX IF NOT EXISTS idx_domains_active_lower_domain[\s\S]*pg_catalog\.lower\(domain\)[\s\S]*WHERE status = 'active'/
    );
    expect(MIGRATION_SOURCE).not.toContain(
      'DROP INDEX IF EXISTS public.idx_domains_active_lower_domain'
    );
    expect(MIGRATION_SOURCE).toContain('normalize_storefront_domain_row');
  });

  it('skips blank-after-trim rows when backfilling normalized domains', () => {
    // The normalization backfill runs after the blank-domain trigger is
    // installed. A whitespace-only legacy row would normalize to '' and trip
    // the trigger, aborting the whole migration. Guard the UPDATE so such rows
    // are left untouched instead of failing the apply.
    expect(MIGRATION_SOURCE).toMatch(
      /UPDATE public\.domains AS domain_row\s+SET domain = pg_catalog\.lower\(pg_catalog\.btrim\(domain_row\.domain\)\)\s+WHERE domain_row\.domain IS DISTINCT FROM\s+pg_catalog\.lower\(pg_catalog\.btrim\(domain_row\.domain\)\)\s+AND pg_catalog\.btrim\(domain_row\.domain\) <> ''/
    );
  });

  it('exposes explicit merchant and PDP resolution statuses to public API roles', () => {
    expect(MIGRATION_SOURCE).toContain(
      'public.resolve_storefront_public_snapshot_v2'
    );
    expect(MIGRATION_SOURCE).toContain('public.get_storefront_pdp_core_v2');
    expect(MIGRATION_SOURCE).toContain(
      'public.get_storefront_pdp_semantic_enrichment_v1'
    );
    expect(MIGRATION_SOURCE).toMatch(/'found'::text/);
    expect(MIGRATION_SOURCE).toMatch(/'not_found'::text/);
    expect(MIGRATION_SOURCE).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.resolve_storefront_public_snapshot_v2\(text\)[\s\S]*TO anon, authenticated, service_role/
    );
    expect(MIGRATION_SOURCE).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.get_storefront_pdp_core_v2\(uuid, text, uuid\)[\s\S]*TO anon, authenticated, service_role/
    );
    expect(MIGRATION_SOURCE).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.get_storefront_pdp_semantic_enrichment_v1\([\s\S]*?\) TO anon, authenticated, service_role/
    );
  });

  it('keeps the PDP snapshot bounded and public-column allowlisted', () => {
    expect(MIGRATION_SOURCE).toContain(
      'pg_catalog.octet_length(p_product_slug) <= 200'
    );
    expect(MIGRATION_SOURCE).toContain('LIMIT 128');
    expect(MIGRATION_SOURCE).toContain("'variant_count'");
    expect(MIGRATION_SOURCE).toContain("'variants_truncated'");
    expect(MIGRATION_SOURCE).toContain('product_row.default_variant_id');
    expect(MIGRATION_SOURCE).toContain('LIMIT 16');
    expect(MIGRATION_SOURCE).toContain("'product_variants', variants.data");
    expect(MIGRATION_SOURCE).toContain("'product_offers', offers.data");
    expect(MIGRATION_SOURCE).toContain("'product_key_specs', key_specs.data");
    expect(MIGRATION_SOURCE).toContain(
      'GREATEST(COALESCE(p_inventory_limit, 48), 1)'
    );
    expect(MIGRATION_SOURCE).toContain(
      'GREATEST(COALESCE(p_cluster_guide_limit, 48), 1)'
    );
    expect(MIGRATION_SOURCE).toContain(
      'GREATEST(COALESCE(p_product_guide_limit, 8), 1)'
    );
    expect(MIGRATION_SOURCE).toContain('true AS is_current');
    expect(MIGRATION_SOURCE).toContain('inventory_rows.is_current DESC');
    expect(MIGRATION_SOURCE).not.toMatch(/SELECT\s+\*/i);
    expect(MIGRATION_SOURCE).not.toContain("'cost_price'");
  });

  it('keeps published merchant snapshots on an explicit public projection', () => {
    expect(MIGRATION_SOURCE).toContain("'paystack_subaccount_configured'");
    expect(MIGRATION_SOURCE).toContain("'price_negotiation_enabled'");
    expect(MIGRATION_SOURCE).toContain("'site_title'");
    expect(MIGRATION_SOURCE).toContain("'published_config'");
    expect(MIGRATION_SOURCE).not.toMatch(
      /WHEN resolved\.is_published THEN resolved\.merchant_data/
    );
  });

  it('applies definer-only safety predicates before returning public PDP data', () => {
    expect(MIGRATION_SOURCE).toMatch(
      /direct_category\.id = product_row\.category_id[\s\S]*direct_category\.is_active/
    );
    expect(MIGRATION_SOURCE).toMatch(
      /joined_category\.id = membership\.category_id[\s\S]*joined_category\.is_active/
    );
    expect(MIGRATION_SOURCE).toContain(
      "NULLIF(\n        pg_catalog.btrim(parent_product.slug),\n        ''\n      ) IS NOT NULL"
    );

    const rawInputOffset = MIGRATION_SOURCE.indexOf(
      'WITH raw_input AS MATERIALIZED'
    );
    const enrichmentRegexOffset = MIGRATION_SOURCE.indexOf(
      'pg_catalog.regexp_replace(',
      rawInputOffset
    );
    const enrichmentBoundOffset = MIGRATION_SOURCE.indexOf(
      'pg_catalog.octet_length(raw_input.category_slug) <= 64',
      rawInputOffset
    );
    expect(rawInputOffset).toBeGreaterThan(-1);
    expect(enrichmentBoundOffset).toBeGreaterThan(rawInputOffset);
    expect(enrichmentRegexOffset).toBeGreaterThan(enrichmentBoundOffset);
  });

  it('pins every new function search path and isolates privileged PDP reads', () => {
    expect(MIGRATION_SOURCE).toMatch(
      /private\.get_storefront_pdp_core_v2[\s\S]*SECURITY DEFINER[\s\S]*SET search_path TO ''/
    );
    expect(MIGRATION_SOURCE).toMatch(
      /public\.get_storefront_pdp_core_v2[\s\S]*SECURITY DEFINER[\s\S]*SET search_path TO ''/
    );
    expect(MIGRATION_SOURCE).toMatch(
      /public\.resolve_storefront_public_snapshot_v2[\s\S]*SECURITY DEFINER[\s\S]*SET search_path TO ''/
    );
    expect(MIGRATION_SOURCE).toMatch(
      /REVOKE ALL ON FUNCTION public\.resolve_storefront_cached_merchant\(text\)[\s\S]*FROM PUBLIC, anon, authenticated/
    );
    const merchantResolverGrant = MIGRATION_SOURCE.match(
      /GRANT EXECUTE ON FUNCTION public\.resolve_storefront_cached_merchant\(text\)[\s\S]*?;/
    )?.[0];
    expect(merchantResolverGrant).toBeDefined();
    expect(merchantResolverGrant).toContain('TO service_role');
    expect(merchantResolverGrant).not.toContain('anon');
    expect(merchantResolverGrant).not.toContain('authenticated');
    expect(MIGRATION_SOURCE).toContain("'is_published', false");
    expect(MIGRATION_SOURCE).toContain(
      'CASE WHEN resolved.is_published THEN resolved.feature_settings'
    );
    expect(MIGRATION_SOURCE).toContain(
      'public_feature_setting.key = ANY (ARRAY['
    );
    expect(MIGRATION_SOURCE).toContain("'blog_enabled'");
    expect(MIGRATION_SOURCE).toContain("'wallet_paystack_dva_enabled'");
    expect(MIGRATION_SOURCE).not.toContain(
      "merchant_row.feature_settings - 'custom_settings'"
    );
    expect(MIGRATION_SOURCE).toContain("'google_merchant_id'");
    expect(MIGRATION_SOURCE).toContain("'google_store_widget_enabled'");
    expect(MIGRATION_SOURCE).toMatch(
      /private\.get_storefront_pdp_semantic_enrichment_v1[\s\S]*SECURITY DEFINER[\s\S]*SET search_path TO ''/
    );
    expect(MIGRATION_SOURCE).toMatch(
      /public\.get_storefront_pdp_semantic_enrichment_v1[\s\S]*SECURITY DEFINER[\s\S]*SET search_path TO ''/
    );
    expect(MIGRATION_SOURCE).toMatch(
      /GRANT EXECUTE ON FUNCTION private\.get_storefront_pdp_core_v2\(uuid, text, uuid\)[^;]*TO service_role/
    );
    expect(MIGRATION_SOURCE).not.toMatch(
      /GRANT EXECUTE ON FUNCTION private\.get_storefront_pdp_core_v2\(uuid, text, uuid\)[^;]*TO anon/
    );
    const privateEnrichmentGrant = MIGRATION_SOURCE.match(
      /GRANT EXECUTE ON FUNCTION private\.get_storefront_pdp_semantic_enrichment_v1\([\s\S]*?\) TO service_role;/
    )?.[0];
    expect(privateEnrichmentGrant).toBeDefined();
    expect(privateEnrichmentGrant).not.toContain('anon');
    expect(privateEnrichmentGrant).not.toContain('authenticated');
  });
});
