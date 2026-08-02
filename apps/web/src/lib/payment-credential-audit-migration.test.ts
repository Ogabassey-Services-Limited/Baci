import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationDirectory = resolve(process.cwd(), '../../supabase/migrations');
const migrationPath = resolve(
  migrationDirectory,
  '20260730000500_audit_payment_credential_lifecycle.sql'
);
const sqlRegressionIncludes = [
  'audit_payment_credential_lifecycle/01_setup_and_create.sql',
  'audit_payment_credential_lifecycle/02_schema_and_disable.sql',
  'audit_payment_credential_lifecycle/03_reactivation_and_pair_create.sql',
  'audit_payment_credential_lifecycle/04_pair_update_and_role_delete.sql',
  'audit_payment_credential_lifecycle/05_cascade_and_noop.sql',
  'audit_payment_credential_lifecycle/06_writer_rollback.sql',
] as const;
const sqlRegressionPaths = [
  resolve(migrationDirectory, 'tests/audit_payment_credential_lifecycle.sql'),
  ...sqlRegressionIncludes.map((includePath) =>
    resolve(migrationDirectory, 'tests', includePath)
  ),
];

const exactFields = [
  'credential_role',
  'environment',
  'is_active',
  'kek_version',
  'provider',
] as const;

const presenceOnlyFields = [
  'ciphertext',
  'disabled_at',
  'last_validated_at',
] as const;

const ignoredFields = ['created_at', 'updated_at'] as const;
const forbiddenFields = [
  'disabled_reason',
  'id',
  'key_last4',
  'last_validation_error',
  'merchant_id',
] as const;

function extractSqlFunction(
  migrationSql: string,
  functionName: string
): string {
  const escapedFunctionName = functionName.replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&'
  );

  return (
    migrationSql.match(
      new RegExp(
        `CREATE OR REPLACE FUNCTION ${escapedFunctionName}` +
          String.raw`[\s\S]*?\n\$\$;`
      )
    )?.[0] ?? ''
  );
}

function extractDeclaredFields(
  triggerFunctionSql: string,
  fieldGroup: 'exact' | 'presence' | 'ignored' | 'forbidden'
): string[] {
  const declarationValues =
    triggerFunctionSql.match(
      new RegExp(
        String.raw`v_${fieldGroup}_fields text\[\] := ARRAY\[([\s\S]*?)\]::text\[\];`
      )
    )?.[1] ?? '';

  return [...declarationValues.matchAll(/'([^']+)'/g)].map(
    ([, field]) => field
  );
}

describe('payment credential audit migration contract', () => {
  it('reserves the Task 6 migration version exactly once', () => {
    const matchingMigrationFiles = readdirSync(migrationDirectory).filter(
      (fileName) => fileName.startsWith('20260730000500_')
    );

    expect(matchingMigrationFiles).toEqual([
      '20260730000500_audit_payment_credential_lifecycle.sql',
    ]);
  });

  it('installs a non-callable, owner-confined private slot trigger', () => {
    expect(existsSync(migrationPath)).toBe(true);
    const migrationSql = readFileSync(migrationPath, 'utf8');
    const triggerFunctionSql = extractSqlFunction(
      migrationSql,
      'private.audit_payment_credential_change_v1()'
    );

    expect(triggerFunctionSql).toContain('SECURITY DEFINER');
    expect(triggerFunctionSql).toContain("SET search_path = ''");
    expect(triggerFunctionSql).toContain(
      'FROM private.audit_event_writer_capabilities AS capability'
    );
    expect(triggerFunctionSql).toContain('private.write_audit_event_v1(');
    expect(triggerFunctionSql).toContain('payment_credential.cascade_delete');
    expect(migrationSql).toMatch(
      /^REVOKE ALL ON FUNCTION private\.audit_payment_credential_change_v1\(\)\n {2}FROM PUBLIC, anon, authenticated, service_role;$/m
    );
    expect(migrationSql).not.toMatch(
      /GRANT EXECUTE ON FUNCTION private\.audit_payment_credential_change_v1\(\)/
    );
    expect(migrationSql).toContain(
      'AFTER INSERT OR DELETE OR UPDATE ON private.merchant_payment_credentials'
    );
    expect(migrationSql).toContain(
      'EXECUTE FUNCTION private.audit_payment_credential_change_v1()'
    );
    expect(migrationSql).toContain(
      'GRANT EXECUTE ON FUNCTION public.set_merchant_payment_credential('
    );
    expect(migrationSql).toMatch(/\)\s+TO service_role;/);
  });

  it('classifies every live vault column and never snapshots a credential row', () => {
    const migrationSql = readFileSync(migrationPath, 'utf8');
    const triggerFunctionSql = extractSqlFunction(
      migrationSql,
      'private.audit_payment_credential_change_v1()'
    );
    const classifiedFields = [
      ...exactFields,
      ...presenceOnlyFields,
      ...ignoredFields,
      ...forbiddenFields,
    ];

    expect(new Set(classifiedFields).size).toBe(classifiedFields.length);
    expect(classifiedFields).toHaveLength(15);
    expect(extractDeclaredFields(triggerFunctionSql, 'exact')).toEqual(
      exactFields
    );
    expect(extractDeclaredFields(triggerFunctionSql, 'presence')).toEqual(
      presenceOnlyFields
    );
    expect(extractDeclaredFields(triggerFunctionSql, 'ignored')).toEqual(
      ignoredFields
    );
    expect(extractDeclaredFields(triggerFunctionSql, 'forbidden')).toEqual(
      forbiddenFields
    );
    expect(triggerFunctionSql).toContain(
      'audit_payment_credential_unclassified_column'
    );
    expect(triggerFunctionSql).toContain(
      'audit_payment_credential_classification_invalid'
    );
    expect(triggerFunctionSql).toContain('credential_state');
    expect(triggerFunctionSql).toContain('validation_state');
    expect(triggerFunctionSql).not.toMatch(/to_jsonb\(\s*(?:OLD|NEW)\s*\)/);
  });

  it('keeps the psql fixture wrapper and every included section under the file gate', () => {
    const fixtureWrapper = readFileSync(sqlRegressionPaths[0], 'utf8');

    expect(fixtureWrapper.match(/^\\ir .+$/gm)).toEqual(
      sqlRegressionIncludes.map((includePath) => `\\ir ${includePath}`)
    );
    expect(fixtureWrapper).toContain('Execute with `psql -f`');
    for (const regressionPath of sqlRegressionPaths) {
      const sourceLineCount = readFileSync(regressionPath, 'utf8')
        .trimEnd()
        .split('\n').length;

      expect(sourceLineCount).toBeLessThanOrEqual(300);
    }
  });

  it('ships executable redaction, slot-cardinality, cascade, and rollback regressions', () => {
    const sqlRegression = sqlRegressionPaths
      .map((regressionPath) => readFileSync(regressionPath, 'utf8'))
      .join('\n');

    expect(sqlRegression).toContain('information_schema.columns');
    expect(sqlRegression).toContain('task6-ciphertext-sentinel-QWZX');
    expect(sqlRegression).toContain('task6-key-last4-sentinel-RSTV');
    expect(sqlRegression).toContain('task6-validation-error-sentinel-XQWZ');
    expect(sqlRegression).toContain('task6-disabled-reason-sentinel-VWXY');
    expect(sqlRegression).toContain(
      'task6-client-rotate-ciphertext-sentinel-QXRV'
    );
    expect(sqlRegression).toContain(
      'CREATE FUNCTION pg_temp.assert_task6_redacted_audit_rows('
    );
    expect(sqlRegression).toContain('v_create_count');
    expect(sqlRegression).toContain('v_disable_count');
    expect(sqlRegression).toContain('v_reactivation_count');
    expect(sqlRegression).toContain('database_transaction_id');
    expect(sqlRegression).toContain('client_id');
    expect(sqlRegression).toContain('secret_key');
    expect(sqlRegression).toContain('pair_update');
    expect(sqlRegression).toContain('payment_credential.cascade_delete');
    expect(sqlRegression).toContain('merchant_label IS NOT NULL');
    expect(sqlRegression).toContain('ROLLBACK TO SAVEPOINT');
    expect(sqlRegression).toContain(
      'audit_payment_credential_unclassified_column'
    );
    expect(sqlRegression).toContain(
      'audit_payment_credential_writer_capability_unavailable'
    );
  });
});
