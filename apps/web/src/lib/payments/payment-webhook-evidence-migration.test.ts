import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { expectedEvidenceIndexMatrix } from './payment-webhook-evidence-index-matrix.test-support';

const migrationFilename =
  '20260801150000_payment_webhook_evidence_foundation.sql';
const migrationPath = resolve(
  process.cwd(),
  `../../supabase/migrations/${migrationFilename}`
);
const replayContractPath = resolve(
  process.cwd(),
  '../../supabase/migrations/tests/payment_webhook_evidence_foundation.sql'
);

function readMigration() {
  return readFileSync(migrationPath, 'utf8');
}

describe('payment webhook evidence foundation migration', () => {
  it('adds the lexically ordered sealed migration', () => {
    expect(migrationFilename).toBe(
      '20260801150000_payment_webhook_evidence_foundation.sql'
    );
    expect(existsSync(migrationPath)).toBe(true);
  });

  it('creates only the three dormant evidence relations and one approved generation target', () => {
    const migrationSql = readMigration();
    const executableSql = migrationSql
      .replace(/--[^\n]*/g, '')
      .replace(/'(?:''|[^'])*'/g, '');

    expect(migrationSql).toContain(
      'ADD CONSTRAINT payment_ingress_contract_generations_evidence_binding_key'
    );

    for (const relation of [
      'payment_webhook_inbox',
      'payment_webhook_source_manifests',
      'payment_webhook_source_proofs',
    ]) {
      expect(migrationSql).toContain(`CREATE TABLE private.${relation}`);
      expect(migrationSql).toContain(
        `ALTER TABLE private.${relation} ENABLE ROW LEVEL SECURITY;`
      );
      expect(migrationSql).toContain(
        `ALTER TABLE private.${relation} FORCE ROW LEVEL SECURITY;`
      );

      for (const role of [
        'PUBLIC',
        'anon',
        'authenticated',
        'service_role',
        'payment_control_plane',
      ]) {
        expect(migrationSql).toContain(
          `REVOKE ALL ON TABLE private.${relation} FROM ${role};`
        );
      }
    }

    expect(executableSql.match(/\bCREATE\s+TABLE\b/gi) ?? []).toHaveLength(3);
    expect(executableSql).not.toMatch(
      /\bCREATE\s+(?:OR\s+REPLACE\s+)?(?:FUNCTION|PROCEDURE|TRIGGER|POLICY|ROLE)\b|\bINSERT\s+INTO\b|\bGRANT\s+/i
    );
  });

  it('keeps writer-only invariants out of the dormant schema-only slice', () => {
    const migrationSql = readMigration();

    expect(migrationSql).toContain("replay_key_preimage - ARRAY['v'");
    expect(migrationSql).not.toContain('jsonb_object_length');
    expect(migrationSql).not.toMatch(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION/i);
    expect(migrationSql).not.toMatch(/CREATE\s+TRIGGER/i);
    expect(migrationSql).not.toMatch(/CREATE\s+POLICY/i);
    expect(migrationSql).not.toMatch(/GRANT\s+/i);
  });

  it('indexes every new foreign-key referencing path without changing authority', () => {
    const migrationSql = readMigration();

    for (const definition of [
      'CREATE INDEX payment_webhook_source_manifests_generation_idx\n  ON private.payment_webhook_source_manifests (ingress_contract_generation_id, id);',
      'CREATE INDEX payment_webhook_inbox_generation_idx\n  ON private.payment_webhook_inbox (ingress_contract_generation_id, id);',
      'CREATE INDEX payment_webhook_inbox_source_manifest_idx\n  ON private.payment_webhook_inbox (source_manifest_id, id);',
      'CREATE INDEX payment_webhook_source_manifests_inbox_idx\n  ON private.payment_webhook_source_manifests (inbox_id, id)\n  WHERE inbox_id IS NOT NULL;',
    ]) {
      expect(migrationSql).toContain(definition);
    }
  });

  it('requires relation-scoped catalog checks and post-rollback fixture absence', () => {
    const replayContractSql = readFileSync(replayContractPath, 'utf8');

    expect(replayContractSql).toContain('pg_attribute');
    expect(replayContractSql).toContain('pg_attrdef');
    expect(replayContractSql).toContain('pg_get_constraintdef');
    expect(replayContractSql).toContain('conrelid');
    expect(replayContractSql).toContain('index_namespace');
    for (const [
      indexName,
      tableName,
      keyColumns,
      isUnique,
      isPrimary,
      predicate,
    ] of expectedEvidenceIndexMatrix) {
      const predicateSql =
        predicate === null ? 'NULL::text' : `'${predicate}'::text`;
      const keyColumnsSql = keyColumns
        .map((column) => `'${column}'`)
        .join(', ');

      expect(replayContractSql).toContain(
        `('${indexName}', '${tableName}', ARRAY[${keyColumnsSql}]::text[], ${isUnique}, ${isPrimary}, ${predicateSql})`
      );
    }
    expect(replayContractSql).toContain('indisprimary');
    expect(replayContractSql).toContain('PRIMARY KEY (id)');
    expect(replayContractSql).toContain(
      'payment webhook evidence index catalog changed after fixture rollback'
    );
    expect(replayContractSql).toContain(
      'payment webhook evidence named constraints changed or lost their relation scope after fixture rollback'
    );
    expect(replayContractSql).toContain('SET CONSTRAINTS ALL IMMEDIATE;');
    expect(replayContractSql).toMatch(/ROLLBACK;\s+DO \$\$/);
    expect(replayContractSql).toContain(
      'fixture identity row survived rollback'
    );
    expect(replayContractSql).toContain('20000000-0000-4000-8000-000000000002');
    expect(replayContractSql).toContain('20000000-0000-4000-8000-000000000003');
    expect(replayContractSql).toContain(
      'payment webhook evidence relations must be empty after fixture rollback'
    );
  });
});
