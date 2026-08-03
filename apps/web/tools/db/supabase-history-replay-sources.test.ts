import { describe, expect, it } from 'vitest';
import { REPLAY_SOURCE_DATA } from './supabase-history-replay-sources';

const {
  PIPELINE_SOURCES,
  POST_REPLAY_SOURCES,
  PENDING_SOURCES,
  PRODUCTION_MAPPINGS,
} = REPLAY_SOURCE_DATA;

/**
 * Colocated guard for the extracted replay-source data. The manifest module
 * (`supabase-history-replay-manifest.ts`) parses these template-literal blocks
 * with `parseFrozenSources` / `parseProductionMappings`, both of which throw on a
 * malformed row. This test fails fast — with a readable message — if an edit to
 * this data breaks the row shape, rather than surfacing as an opaque parser throw
 * inside the far slower manifest-verification suite.
 */

const FROZEN_ROW = /^[0-9a-f]{64} 202\d{11}_[a-z0-9_]+\.sql$/;
const MAPPING_ROW =
  /^202\d{11}\t202\d{11}_[a-z0-9_]+\.sql\t[0-9a-f]{64}\t[a-z-]+$/;
const ADDITIVE_PROVENANCE_MIGRATION =
  '20260731090000_add_product_description_provenance.sql';
const CORRECTIVE_ATTESTATION_MIGRATION =
  '20260731100000_harden_product_description_attestation_grants.sql';
const RETENTION_PROVENANCE_MIGRATION =
  '20260801090000_harden_product_description_provenance_retention.sql';
const OPERATION_ID_BINDING_MIGRATION =
  '20260801100000_preserve_product_description_attestation_operation_ids.sql';
const ATTESTATION_PRIVACY_MIGRATION =
  '20260801110000_harden_product_description_attestation_privacy.sql';
const ATTESTATION_ISSUANCE_MIGRATION =
  '20260801130000_bound_product_description_attestation_issuance.sql';
const OPERATION_ID_SCOPE_MIGRATION =
  '20260801160000_scope_product_description_attestation_operation_ids.sql';
const ATTESTATION_GRANT_FUNCTION_MIGRATION =
  '20260801170000_redefine_product_description_attestation_grant.sql';
const ATTESTATION_INDEX_MIGRATION =
  '20260801180000_harden_product_description_attestation_indexes.sql';
const ATTESTATION_INDEX_RECOVERY_MIGRATION =
  '20260801190000_recover_product_description_attestation_indexes.sql';
const ATTESTATION_PERMISSION_MIGRATION =
  '20260801210000_require_product_permission_for_attestation_grant.sql';

function rows(block: string): string[] {
  return block
    .trim()
    .split('\n')
    .filter((row) => row.length > 0);
}

describe('supabase-history-replay sources', () => {
  it.each([
    ['PIPELINE_SOURCES', PIPELINE_SOURCES],
    ['POST_REPLAY_SOURCES', POST_REPLAY_SOURCES],
    ['PENDING_SOURCES', PENDING_SOURCES],
  ])('%s rows are all `<sha256> <filename>.sql`', (_name, block) => {
    for (const row of rows(block)) {
      expect(row, `malformed frozen source row: ${row}`).toMatch(FROZEN_ROW);
    }
  });

  it('PRODUCTION_MAPPINGS rows are `<version>\\t<file>\\t<sha256>\\t<rule>`', () => {
    for (const row of rows(PRODUCTION_MAPPINGS)) {
      expect(row, `malformed production mapping row: ${row}`).toMatch(
        MAPPING_ROW
      );
    }
  });

  it('contains no blank rows (a blank row would throw in parseFrozenSources)', () => {
    for (const [name, block] of [
      ['PIPELINE_SOURCES', PIPELINE_SOURCES],
      ['POST_REPLAY_SOURCES', POST_REPLAY_SOURCES],
      ['PENDING_SOURCES', PENDING_SOURCES],
      ['PRODUCTION_MAPPINGS', PRODUCTION_MAPPINGS],
    ] as const) {
      const hasInternalBlank = block
        .trim()
        .split('\n')
        .some((row) => row.trim().length === 0);
      expect(hasInternalBlank, `${name} has a blank row`).toBe(false);
    }
  });

  it('registers the provenance migrations in execution order', () => {
    const migrationOrder = [
      ADDITIVE_PROVENANCE_MIGRATION,
      CORRECTIVE_ATTESTATION_MIGRATION,
      RETENTION_PROVENANCE_MIGRATION,
      OPERATION_ID_BINDING_MIGRATION,
      ATTESTATION_PRIVACY_MIGRATION,
      ATTESTATION_ISSUANCE_MIGRATION,
      OPERATION_ID_SCOPE_MIGRATION,
      ATTESTATION_GRANT_FUNCTION_MIGRATION,
      ATTESTATION_INDEX_MIGRATION,
      ATTESTATION_INDEX_RECOVERY_MIGRATION,
      ATTESTATION_PERMISSION_MIGRATION,
    ].map((migration) => PENDING_SOURCES.indexOf(migration));
    expect(migrationOrder.every((index) => index >= 0)).toBe(true);
    expect(migrationOrder).toEqual([...migrationOrder].sort((a, b) => a - b));
  });

  it('registers each source filename at most once across all blocks', () => {
    const names = [
      ...rows(PIPELINE_SOURCES),
      ...rows(POST_REPLAY_SOURCES),
      ...rows(PENDING_SOURCES),
    ].map((row) => row.split(' ')[1]);
    expect(new Set(names).size).toBe(names.length);
  });

  it('registers the bounded identity-verification capability as a pending source', () => {
    expect(rows(PENDING_SOURCES)).toContain(
      '60be0be8990407b279108981c8c47815a90f8855a05a106d6a9024e23cb6998d 20260729100000_add_merchant_identity_verified_rpc.sql'
    );
  });

  it('registers the shipping provider policy follow-up as a pending source', () => {
    expect(rows(PENDING_SOURCES)).toContain(
      'c0ec34bcd397263cf1f8d91fe94d0e3aa0edd4d600101dc9656ce261cd6bf2d1 20260802220000_centralize_shipping_provider_policy.sql'
    );
  });

  it('registers the repair booking rate-limit index as a pending source', () => {
    expect(rows(PENDING_SOURCES)).toContain(
      '846a37482ca4ea765f63c9ba1cf5bb747e81446f955c0c440dead034cd86fa11 20260803000000_add_repair_booking_rate_limit_index.sql'
    );
  });

  it('registers the shipping and repair hardening follow-up as a pending source', () => {
    expect(rows(PENDING_SOURCES)).toContain(
      '2fcb90a7746d88841ed00c86e2d46a7525674bb4e7aea04393f53bca3c0fef1c 20260803000100_harden_shipping_provider_policy_and_repair_rate_limits.sql'
    );
  });

  it('registers the shipping and repair regression repair as a pending source', () => {
    expect(rows(PENDING_SOURCES)).toContain(
      '068707fce641a6818521fcef448d8a35eccbeadad9ff785420a16be7133e3ceb 20260803000200_fix_shipping_provider_and_repair_booking_regressions.sql'
    );
  });
});
