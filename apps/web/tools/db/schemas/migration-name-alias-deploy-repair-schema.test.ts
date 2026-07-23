import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { migrationNameAliasDeployRepairSchema } from './migration-name-alias-deploy-repair-schema';

async function readFixture(): Promise<unknown> {
  const fixturePath = path.resolve(
    process.cwd(),
    'tools/db/fixtures/migration-name-alias-deploy-repair.json'
  );
  return JSON.parse(await readFile(fixturePath, 'utf8'));
}

describe('migrationNameAliasDeployRepairSchema', () => {
  it('accepts the no-ledger-write deployment-repair receipt', async () => {
    const receipt = migrationNameAliasDeployRepairSchema.parse(
      await readFixture()
    );

    expect(receipt.alias).toEqual({
      disposition: 'already-applied-no-ledger-write',
      recordedName: 'fix_storefront_order_customer_returning_id_ambiguity',
      repositoryName:
        'fix_create_storefront_order_customer_returning_id_ambiguity',
      version: '20260604132853',
    });
    expect(receipt.failedPreRepairAttempt.deploymentRunId).toBe(29384198864);
    expect(receipt.successfulRepairAttempt.deploymentRunId).toBe(29417244012);
    expect(receipt.provenanceTreatment).toBe(
      'deploy-repair-only-not-production-effect-exceptional-record'
    );
  });

  it('rejects unknown keys and incorrect receipt discriminants', async () => {
    const receipt = (await readFixture()) as Record<string, unknown>;
    expect(
      migrationNameAliasDeployRepairSchema.safeParse({
        ...receipt,
        ledgerWrite: true,
      }).success
    ).toBe(false);

    const wrongDisposition = structuredClone(receipt) as {
      alias: { disposition: string };
    };
    wrongDisposition.alias.disposition = 'ledger-write';
    expect(
      migrationNameAliasDeployRepairSchema.safeParse(wrongDisposition).success
    ).toBe(false);
  });

  it('rejects a nested unknown key and non-positive run identifiers', async () => {
    const nested = structuredClone(await readFixture()) as {
      successfulRepairAttempt: Record<string, unknown>;
    };
    nested.successfulRepairAttempt.logOrdinal = 1;
    expect(migrationNameAliasDeployRepairSchema.safeParse(nested).success).toBe(
      false
    );

    const invalidRun = structuredClone(await readFixture()) as {
      failedPreRepairAttempt: { deploymentRunId: number };
    };
    invalidRun.failedPreRepairAttempt.deploymentRunId = 0;
    expect(
      migrationNameAliasDeployRepairSchema.safeParse(invalidRun).success
    ).toBe(false);
  });

  it('rejects a newly applied migration path that does not match its version and name', async () => {
    const receipt = structuredClone(await readFixture()) as {
      successfulRepairAttempt: {
        newlyAppliedMigration: { repositoryOwnerPath: string };
      };
    };
    receipt.successfulRepairAttempt.newlyAppliedMigration.repositoryOwnerPath =
      'supabase/migrations/20260714220001_quiz_event_lifecycle_followup.sql';

    const result = migrationNameAliasDeployRepairSchema.safeParse(receipt);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message:
              'repositoryOwnerPath must match the migration version and name',
            path: [
              'successfulRepairAttempt',
              'newlyAppliedMigration',
              'repositoryOwnerPath',
            ],
          }),
        ])
      );
    }
  });

  it('rejects an alias whose recorded and repository names are identical', async () => {
    const receipt = structuredClone(await readFixture()) as {
      alias: { recordedName: string; repositoryName: string };
    };
    receipt.alias.recordedName = receipt.alias.repositoryName;

    const result = migrationNameAliasDeployRepairSchema.safeParse(receipt);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: 'recordedName and repositoryName must differ',
            path: ['alias', 'repositoryName'],
          }),
        ])
      );
    }
  });

  it('binds both the base and successful attempt head to the repair commit', async () => {
    const distinctBase = structuredClone(await readFixture()) as {
      baseSha: string;
    };
    distinctBase.baseSha = '0'.repeat(40);
    const distinctBaseResult =
      migrationNameAliasDeployRepairSchema.safeParse(distinctBase);
    expect(distinctBaseResult.success).toBe(false);
    if (!distinctBaseResult.success) {
      expect(distinctBaseResult.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: 'baseSha and repairCommitSha must match',
            path: ['repairCommitSha'],
          }),
        ])
      );
    }

    const wrongSuccessfulHead = structuredClone(await readFixture()) as {
      successfulRepairAttempt: { headSha: string };
    };
    wrongSuccessfulHead.successfulRepairAttempt.headSha = '0'.repeat(40);
    const result =
      migrationNameAliasDeployRepairSchema.safeParse(wrongSuccessfulHead);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message:
              'successfulRepairAttempt.headSha must match repairCommitSha',
            path: ['successfulRepairAttempt', 'headSha'],
          }),
        ])
      );
    }
  });
});
