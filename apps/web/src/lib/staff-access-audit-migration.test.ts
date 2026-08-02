import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationDirectory = resolve(process.cwd(), '../../supabase/migrations');
const migrationPath = resolve(
  migrationDirectory,
  '20260730000200_audit_staff_access_changes.sql'
);
const boundedProjectionRepairPath = resolve(
  migrationDirectory,
  '20260730000201_bound_staff_access_audit_permission_projection.sql'
);
const sqlRegressionPath = resolve(
  migrationDirectory,
  'tests/audit_staff_access_changes.sql'
);
const sqlRegressionPartsDirectory = resolve(
  migrationDirectory,
  'tests/audit_staff_access_changes'
);

function readStaffAccessSqlRegression() {
  const orderedPartSql = readdirSync(sqlRegressionPartsDirectory, {
    withFileTypes: true,
  })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    .sort()
    .map((fileName) =>
      readFileSync(resolve(sqlRegressionPartsDirectory, fileName), 'utf8')
    );

  return [readFileSync(sqlRegressionPath, 'utf8'), ...orderedPartSql].join(
    '\n'
  );
}

const classifiedStaffMemberFields = [
  'accepted_at',
  'created_at',
  'email',
  'id',
  'invitation_expires_at',
  'invitation_token',
  'invited_at',
  'last_login_at',
  'merchant_id',
  'name',
  'permissions',
  'phone',
  'role',
  'status',
  'updated_at',
  'user_id',
] as const;

describe('staff access audit migration contract', () => {
  it('uses the reserved migration version exactly once', () => {
    const matchingMigrationFiles = readdirSync(migrationDirectory).filter(
      (fileName) => fileName.startsWith('20260730000200_')
    );

    expect(matchingMigrationFiles).toEqual([
      '20260730000200_audit_staff_access_changes.sql',
    ]);
  });

  it('installs an owner-confined AFTER trigger using Task 1’s opaque capability', () => {
    const migrationSql = readFileSync(migrationPath, 'utf8');

    expect(migrationSql).toContain(
      'CREATE OR REPLACE FUNCTION private.audit_staff_access_change_v1()'
    );
    expect(migrationSql).toContain('SECURITY DEFINER');
    expect(migrationSql).toContain("SET search_path = ''");
    expect(migrationSql).toContain(
      'FROM private.audit_event_writer_capabilities AS capability'
    );
    expect(migrationSql).toContain(
      "capability.capability_name = 'canonical_audit_event_writer_v1'"
    );
    expect(migrationSql).toContain('private.write_audit_event_v1(');
    expect(migrationSql).toContain(
      'REVOKE ALL ON FUNCTION private.audit_staff_access_change_v1()'
    );
    expect(migrationSql).toMatch(
      /REVOKE\s+ALL\s+ON\s+FUNCTION\s+private\.audit_staff_access_change_v1\(\)\s+FROM\s+PUBLIC(?:,|\s)/
    );
    expect(migrationSql).toContain('ON public.staff_members');
    expect(migrationSql).toContain(
      'EXECUTE FUNCTION private.audit_staff_access_change_v1()'
    );
    expect(migrationSql).not.toContain(
      'GRANT EXECUTE ON FUNCTION private.audit_staff_access_change_v1()'
    );

    const triggerSql =
      migrationSql.match(
        /CREATE TRIGGER audit_staff_access_change_v1[\s\S]*?;/
      )?.[0] ?? '';
    expect(triggerSql).toContain('AFTER INSERT OR DELETE OR UPDATE');
    expect(triggerSql).not.toContain('UPDATE OF');
  });

  it('uses exhaustive staff classification and normalized effective permission projections', () => {
    const migrationSql = readFileSync(migrationPath, 'utf8');
    const classificationSql =
      migrationSql.match(
        /v_exact_access_fields[\s\S]*?v_forbidden_fields \|\| v_ignored_fields;/
      )?.[0] ?? '';

    expect(classificationSql).not.toBe('');
    for (const field of classifiedStaffMemberFields) {
      expect(classificationSql).toContain(`'${field}'`);
    }
    expect(migrationSql).toContain(
      'private.project_staff_effective_permissions_for_audit_v1'
    );
    expect(migrationSql).toContain('audit_staff_access_classification_invalid');
    expect(migrationSql).toContain('audit_staff_access_unclassified_column');
    expect(migrationSql).toContain('octet_length(v_before_values::text)');
    expect(migrationSql).toContain('staff.invited');
    expect(migrationSql).toContain('staff.access_created');
    expect(migrationSql).toContain('staff.accepted');
    expect(migrationSql).toContain('staff.role_changed');
    expect(migrationSql).toContain('staff.permissions_changed');
    expect(migrationSql).toContain('staff.suspended');
    expect(migrationSql).toContain('staff.reactivated');
    expect(migrationSql).toContain('staff.removed');
    expect(migrationSql).toContain('staff.status_changed');
    expect(migrationSql).toContain('staff.access_changed');
    expect(migrationSql).toContain(
      'audit_staff_access_merchant_reassignment_forbidden'
    );
    expect(migrationSql).toContain(
      'audit_staff_access_id_reassignment_forbidden'
    );
    expect(migrationSql).toContain(
      'audit_staff_access_permissions_shape_invalid'
    );
    expect(migrationSql).toContain('pg_catalog.jsonb_typeof(OLD.permissions)');
    expect(migrationSql).toContain('pg_catalog.jsonb_typeof(NEW.permissions)');
    const removalActionIndex = migrationSql.indexOf(
      "v_action := 'staff.removed';"
    );
    const payloadGuardIndex = migrationSql.indexOf(
      'octet_length(v_before_values::text) > 16384'
    );
    expect(removalActionIndex).toBeGreaterThanOrEqual(0);
    expect(payloadGuardIndex).toBeGreaterThanOrEqual(0);
    expect(removalActionIndex).toBeLessThan(payloadGuardIndex);
    expect(migrationSql).not.toMatch(/to_jsonb\(\s*(?:OLD|NEW)\s*\)/);
  });

  it('redacts oversized legacy permission documents before they can block cleanup', () => {
    const repairSql = readFileSync(boundedProjectionRepairPath, 'utf8');

    expect(repairSql).toContain(
      'CREATE OR REPLACE FUNCTION private.project_staff_effective_permissions_for_audit_v1('
    );
    expect(repairSql).toContain('__audit_projection_redacted__');
    expect(repairSql).toContain('> 4096');
    expect(repairSql).toContain('octet_length(COALESCE(p_custom_permissions');
    expect(repairSql).toContain('octet_length(v_projected_permissions::text)');
    expect(repairSql).not.toContain('to_jsonb(OLD)');
    expect(repairSql).not.toContain('to_jsonb(NEW)');
  });

  it('ships executable lifecycle, attribution, and redaction regressions', () => {
    const regressionDriverSql = readFileSync(sqlRegressionPath, 'utf8');
    const partFileNames = readdirSync(sqlRegressionPartsDirectory, {
      withFileTypes: true,
    })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
      .map((entry) => entry.name)
      .sort();
    const sqlRegression = readStaffAccessSqlRegression();

    for (const partFileName of partFileNames) {
      expect(regressionDriverSql).toContain(
        `\\ir audit_staff_access_changes/${partFileName}`
      );
    }
    expect(sqlRegression).toContain('information_schema.columns');
    expect(sqlRegression).toContain('staff-audit-token-first');
    expect(sqlRegression).toContain('staff-audit-token-rotated');
    expect(sqlRegression).toContain('staff-audit-token-reinvited');
    expect(sqlRegression).toContain('"reports":{"view":true}');
    expect(sqlRegression).toContain('"orders":{"edit":"true","view":"false"}');
    expect(sqlRegression).toContain('staff.invited');
    expect(sqlRegression).toContain('staff.access_created');
    expect(sqlRegression).toContain('staff.accepted');
    expect(sqlRegression).toContain('public.accept_staff_invite(');
    expect(sqlRegression).toContain('staff.role_changed');
    expect(sqlRegression).toContain('staff.permissions_changed');
    expect(sqlRegression).toContain('staff.suspended');
    expect(sqlRegression).toContain('staff.reactivated');
    expect(sqlRegression).toContain('staff.removed');
    expect(sqlRegression).toContain('staff.status_changed');
    expect(sqlRegression).toContain('staff.access_changed');
    expect(sqlRegression).toContain(
      'audit_staff_access_merchant_reassignment_forbidden'
    );
    expect(sqlRegression).toContain(
      'audit_staff_access_id_reassignment_forbidden'
    );
    expect(sqlRegression).toContain(
      'audit_staff_access_permissions_shape_invalid'
    );
    expect(sqlRegression).toContain("permissions = '[]'::jsonb");
    expect(sqlRegression).toContain("permissions = 'null'::jsonb");
    expect(sqlRegression).toContain('SET permissions = NULL');
    expect(sqlRegression).toContain('SET status = status');
    expect(sqlRegression).toContain(
      "updated_at = updated_at + interval '1 microsecond'"
    );
    expect(sqlRegression).toContain('ROLLBACK TO SAVEPOINT');
    expect(sqlRegression).toContain('audit_staff_access_unclassified_probe');
    expect(sqlRegression).toContain('audit_staff_access_unclassified_column');
    expect(sqlRegression).toContain('IF NOT FOUND OR v_event.action');
    expect(sqlRegression).toContain('target_user_id');
    expect(sqlRegression).toContain('invitation_token');
    expect(sqlRegression).toContain('normalized permission identifier');
    expect(sqlRegression).toContain('oversized staff cleanup');
    expect(sqlRegression).toContain('oversized staff physical delete');
    expect(sqlRegression).toContain('oversized staff merchant cascade');
    expect(sqlRegression).toContain('__audit_projection_redacted__');
  });
});
