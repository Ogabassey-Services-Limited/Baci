import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readBoundReplayReceipt } from './read-bound-replay-receipt';
import { migrationNameAliasDeployRepairSchema } from './schemas/migration-name-alias-deploy-repair-schema';
import { supabaseHistoryReplayManifest } from './supabase-history-replay-manifest';

const WORKSPACE_ROOT = path.resolve(import.meta.dirname, '../../../..');

describe('readBoundReplayReceipt', () => {
  it('returns schema-validated data only when the canonical bytes match', async () => {
    const receipt = await readBoundReplayReceipt(
      WORKSPACE_ROOT,
      supabaseHistoryReplayManifest.aliasReceipt,
      'Migration-name alias receipt',
      migrationNameAliasDeployRepairSchema
    );

    expect(receipt.alias.disposition).toBe('already-applied-no-ledger-write');
  });

  it('rejects a binding with the wrong SHA-256', async () => {
    await expect(
      readBoundReplayReceipt(
        WORKSPACE_ROOT,
        {
          ...supabaseHistoryReplayManifest.aliasReceipt,
          sha256: '0'.repeat(64),
        },
        'Migration-name alias receipt',
        migrationNameAliasDeployRepairSchema
      )
    ).rejects.toThrow('SHA-256 does not match');
  });
});
