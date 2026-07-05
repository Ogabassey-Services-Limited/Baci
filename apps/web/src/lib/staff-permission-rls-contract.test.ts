import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = resolve(
  currentDirectory,
  '../../../../supabase/migrations'
);
const migrationFilePattern = /^\d{14}_.+\.sql$/;
const staffPermissionFunctionPattern =
  /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.check_staff_permission\s*\(/i;

function readLatestStaffPermissionMigration() {
  const migration = readdirSync(migrationsDirectory)
    .filter((file) => migrationFilePattern.test(file))
    .map((file) => ({
      file,
      sql: readFileSync(resolve(migrationsDirectory, file), 'utf8'),
    }))
    .filter(({ sql }) => staffPermissionFunctionPattern.test(sql))
    .sort((a, b) => a.file.localeCompare(b.file))
    .at(-1);

  if (!migration) {
    throw new Error('No check_staff_permission migration found');
  }

  return migration.sql;
}

describe('staff permission RLS helper migration', () => {
  it('honors app-level all and wildcard grants', () => {
    const sql = readLatestStaffPermissionMigration();

    expect(sql).toMatch(staffPermissionFunctionPattern);
    expect(sql).toMatch(/SECURITY\s+DEFINER/i);
    expect(sql).toMatch(/\(v_staff_permissions\s*->\s*'\*'\s*->>\s*'\*'\)/);
    expect(sql).toMatch(/\(v_staff_permissions\s*->\s*'\*'\s*->>\s*p_action\)/);
    expect(sql).toMatch(
      /\(v_staff_permissions\s*->\s*p_resource\s*->>\s*'\*'\)/
    );
    expect(sql).toMatch(
      /\(v_staff_permissions\s*->\s*p_resource\s*->>\s*p_action\)/
    );
    expect(sql).toMatch(
      /\(v_staff_permissions\s*->\s*p_resource\s*->>\s*'all'\)/
    );
    expect(sql).toMatch(
      /\(v_staff_permissions\s*->\s*'full_access'\s*->>\s*'all'\)/
    );
    expect(sql).toMatch(
      /auth\.role\(\)[\s\S]*?<>[\s\S]*?'service_role'[\s\S]*?auth\.uid\(\)[\s\S]*?IS\s+DISTINCT\s+FROM\s+p_user_id/i
    );
  });
});
