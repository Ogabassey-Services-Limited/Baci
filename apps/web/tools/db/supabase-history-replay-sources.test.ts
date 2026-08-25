import { describe, expect, it } from 'vitest';
import { EXPECTED_QUIZ_LIVE_PENDING_SOURCES } from './expected-quiz-live-pending-sources.test-support';
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

  it('orders pending sources by migration filename across independently maintained batches', () => {
    const pendingRows = rows(PENDING_SOURCES);
    const pendingFilenames = pendingRows.map((row) => row.split(' ')[1] ?? '');

    expect(pendingFilenames).toEqual([...pendingFilenames].sort());
    expect(
      pendingFilenames.indexOf('20260805150000_platform_admin_rbac.sql')
    ).toBeLessThan(
      pendingFilenames.indexOf(
        '20260805173000_harden_merchant_invoice_partial_completion.sql'
      )
    );
  });

  it('registers the bounded identity-verification capability as a pending source', () => {
    expect(rows(PENDING_SOURCES)).toContain(
      '60be0be8990407b279108981c8c47815a90f8855a05a106d6a9024e23cb6998d 20260729100000_add_merchant_identity_verified_rpc.sql'
    );
  });

  it('registers the Jumia authorization repair migrations in the replay input', () => {
    expect(rows(PENDING_SOURCES)).toEqual(
      expect.arrayContaining([
        '76df6e5a16ecd22c612f2b42a4164ffd592bdc1bc3255eca6c419812e286c48a 20260822100000_mark_reactivated_jumia_self_authorization_as_inserted.sql',
        'b083e3e5682da5828f34d9593304d2371a1b38abb8020701e22e6ec1e1350f67 20260823100000_jumia_orphan_authorization_sweep.sql',
        '3afab9495b805517ee42d7492a9666a608ffba11172321a3a810a0cb1c597780 20260823110000_harden_jumia_orphan_authorization_sweep.sql',
        '629f967ffa25a8f79c38387262007e184e6ccb99d9bf0ef40cf5e43940ca00fa 20260824230000_allow_jumia_view_credential_refresh.sql',
        '1cb9abb1ef1bd5b9026c44958c78ee8534be0fbc065076112d6f979ead65921e 20260824230100_lock_each_jumia_orphan_shop.sql',
        'af3fa5a276348e8ec9ead71449beb1704a71a61adf6bd13e7a66542d5c2bfac2 20260825000000_restore_jumia_manage_credential_rotation.sql',
        'f051891d4b3b48e8928e8e7ef0879ac97909ad3bbdfdd21a7d86169cfcd45852 20260825000100_serialize_jumia_disconnect_purge.sql',
      ])
    );
  });

  it('keeps the quiz-live pending-source cohort unique and lexically ordered', () => {
    const repositoryPaths = EXPECTED_QUIZ_LIVE_PENDING_SOURCES.map(
      ({ repositoryPath }) => repositoryPath
    );

    expect(repositoryPaths.length).toBeGreaterThan(0);
    expect(new Set(repositoryPaths).size).toBe(repositoryPaths.length);
    expect(repositoryPaths).toEqual([...repositoryPaths].sort());

    const pendingByPath = new Map(
      rows(PENDING_SOURCES).map((row) => {
        const [sha256, filename] = row.trim().split(/\s+/);
        return [`supabase/migrations/${filename}`, sha256] as const;
      })
    );
    for (const {
      repositoryPath,
      sha256,
    } of EXPECTED_QUIZ_LIVE_PENDING_SOURCES) {
      expect(pendingByPath.get(repositoryPath)).toBe(sha256);
    }
  });
});
