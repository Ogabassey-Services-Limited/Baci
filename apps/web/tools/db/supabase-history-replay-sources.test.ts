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
});
