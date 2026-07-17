import { describe, expect, it } from 'vitest';
import { linkedMigrationLedgerSchema } from './linked-migration-ledger-schema';

const sha256 = 'b'.repeat(64);

function validFixture() {
  const rows = Array.from({ length: 439 }, (_, index) => {
    const version =
      index === 438 ? '20260714225500' : String(index + 1).padStart(14, '0');
    const name = `migration_${index + 1}`;
    const localPaths =
      index < 422 ? [`supabase/migrations/${version}_${name}.sql`] : [];
    if (index < 2) {
      localPaths.push(`supabase/migrations/${version}_${name}_duplicate.sql`);
    }
    return {
      version,
      name,
      localPaths,
      localSha256: localPaths.map(() => sha256),
    };
  });
  return {
    schemaVersion: 1,
    baseSha: '9e3d1b14b1931a5e441fc23f0e5417c188056e47',
    linkedRowCount: 439,
    linkedTailVersion: '20260714225500',
    localFileCount: 424,
    localUniqueVersionCount: 422,
    rows,
  };
}

describe('linkedMigrationLedgerSchema', () => {
  it('accepts the exact frozen row, file, unique-version, and tail counts', () => {
    expect(linkedMigrationLedgerSchema.parse(validFixture()).rows).toHaveLength(
      439
    );
  });

  it('rejects row-count and tail drift', () => {
    const countDrift = validFixture();
    countDrift.rows.pop();
    expect(() => linkedMigrationLedgerSchema.parse(countDrift)).toThrow();

    const tailDrift = validFixture();
    tailDrift.rows[438].version = '20260714225459';
    expect(() => linkedMigrationLedgerSchema.parse(tailDrift)).toThrow();
  });

  it('rejects local path/hash cardinality and registry-count drift', () => {
    const cardinality = validFixture();
    cardinality.rows[0].localSha256.pop();
    expect(() => linkedMigrationLedgerSchema.parse(cardinality)).toThrow();

    const countDrift = validFixture();
    countDrift.rows[0].localPaths.pop();
    countDrift.rows[0].localSha256.pop();
    expect(() => linkedMigrationLedgerSchema.parse(countDrift)).toThrow();
  });

  it('requires every local path version to match its linked row', () => {
    const fixture = validFixture();
    fixture.rows[2].localPaths[0] = fixture.rows[2].localPaths[0].replace(
      fixture.rows[2].version,
      '99999999999999'
    );

    expect(() => linkedMigrationLedgerSchema.parse(fixture)).toThrow();
  });

  it('rejects duplicate linked versions, unsafe paths, and unknown keys', () => {
    const duplicate = validFixture();
    duplicate.rows[1].version = duplicate.rows[0].version;
    expect(() => linkedMigrationLedgerSchema.parse(duplicate)).toThrow();

    const unsafe = validFixture();
    unsafe.rows[0].localPaths[0] = '../secret.sql';
    expect(() => linkedMigrationLedgerSchema.parse(unsafe)).toThrow();

    const unknown = validFixture();
    Object.assign(unknown.rows[0], { rawSql: 'select 1' });
    expect(() => linkedMigrationLedgerSchema.parse(unknown)).toThrow();
  });
});
