import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { canonicalReplayFixtureJson } from './canonical-replay-fixture-json';

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

describe('canonicalReplayFixtureJson', () => {
  it('sorts object keys recursively, preserves arrays, and emits exactly one LF', () => {
    expect(
      canonicalReplayFixtureJson({
        z: 1,
        a: { y: 2, b: 1 },
        rows: [{ z: 2, a: 1 }],
      })
    ).toBe('{"a":{"b":1,"y":2},"rows":[{"a":1,"z":2}],"z":1}\n');
  });

  it('preserves __proto__ and sorts integer-like keys lexicographically', () => {
    const adversarial = JSON.parse(
      '{"2":"two","10":"ten","__proto__":{"safe":true},"a":1}'
    );

    expect(canonicalReplayFixtureJson(adversarial)).toBe(
      '{"10":"ten","2":"two","__proto__":{"safe":true},"a":1}\n'
    );
    expect((Object.prototype as { safe?: boolean }).safe).toBeUndefined();
  });

  it('permits safe identifiers and paths whose names mention secrets or roles', () => {
    expect(() =>
      canonicalReplayFixtureJson({
        names: [
          'register_push_token_rpc',
          'anonymousMerchantSecretProjectionWithheld',
          'lock_domain_purchase_rpc_service_role',
        ],
        path: 'supabase/migrations/20260708090000_lock_domain_purchase_rpc_service_role.sql',
      })
    ).not.toThrow();
  });

  it('permits only the exact structured semantic-log marker names', () => {
    expect(() =>
      canonicalReplayFixtureJson({
        markers: [
          '→ applying:',
          '✓ applied:',
          '✓ already applied:',
          'Migrations summary:',
        ],
      })
    ).not.toThrow();
  });

  it.each([
    'Bearer eyJhbGciOiJIUzI1NiJ9.payload.signature',
    'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.signaturebytes',
    'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.',
    'sbp_1234567890abcdefghijklmnopqrstuvwxyz',
    'postgresql://postgres:real-password@db.example.test:5432/postgres',
    '-----BEGIN PRIVATE KEY-----\nsecret-material\n-----END PRIVATE KEY-----',
    '2026-07-15T00:00:00Z → applying: raw_migration_log\nrunner-prefix',
    '→ applying: 20260714225500_release_wallet_credit_push.sql',
    '2026-07-15T00:00:00Z runner-name ✓ applied: raw_migration_log',
    '[runner] raw command output',
    ['sk_live_', '51ActualCredentialMaterial'].join(''),
  ])('rejects secret or raw-log value material: %s', (unsafeValue) => {
    expect(() => canonicalReplayFixtureJson({ value: unsafeValue })).toThrow(
      /secret|credential|raw log/i
    );
  });

  it('rejects secret or raw-log material used as an object key', () => {
    expect(() =>
      canonicalReplayFixtureJson({
        'Bearer eyJhbGciOiJIUzI1NiJ9.payload.signature': 'hidden-in-key',
      })
    ).toThrow(/secret|credential|raw log/i);
  });

  it('rejects non-JSON values instead of silently dropping them', () => {
    expect(() => canonicalReplayFixtureJson({ missing: undefined })).toThrow(
      /JSON/i
    );
    expect(() =>
      canonicalReplayFixtureJson({ value: Number.POSITIVE_INFINITY })
    ).toThrow(/JSON/i);
  });

  it('rejects sparse, custom-property, symbol, and accessor arrays', () => {
    const sparse = new Array<unknown>(2);
    sparse[1] = 'present';
    const custom = ['present'] as unknown[] & { extra?: string };
    custom.extra = 'not-an-index';
    const symbolic = ['present'];
    Object.defineProperty(symbolic, Symbol('hidden'), { value: 'secret' });
    const accessor: unknown[] = [];
    Object.defineProperty(accessor, '0', {
      enumerable: true,
      get: () => 'computed',
    });

    for (const value of [sparse, custom, symbolic, accessor]) {
      expect(() => canonicalReplayFixtureJson(value)).toThrow(/JSON.*array/i);
    }
  });

  it('round-trips both canonical fixtures byte-for-byte with bound hashes', async () => {
    const fixturesDirectory = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      'fixtures'
    );
    const provenancePath = path.resolve(
      fixturesDirectory,
      'production-effect-provenance.json'
    );
    const aliasPath = path.resolve(
      fixturesDirectory,
      'migration-name-alias-deploy-repair.json'
    );
    const provenanceBytes = await readFile(provenancePath, 'utf8');
    const aliasBytes = await readFile(aliasPath, 'utf8');

    expect(canonicalReplayFixtureJson(JSON.parse(provenanceBytes))).toBe(
      provenanceBytes
    );
    expect(canonicalReplayFixtureJson(JSON.parse(aliasBytes))).toBe(aliasBytes);
    expect(sha256(provenanceBytes)).toBe(
      '1f1e4e3112a0010dbed91a25a8185d38fcfd4cf56d2d2b60ca76306bbbb100e1'
    );
    expect(sha256(aliasBytes)).toBe(
      'ba97d2e25bb8d2f43e0a4fdfdb1fa37586fd9c7397458fa8dc0c0c5858288ade'
    );
  });

  it('keeps the fixture string policy while sharing canonical JSON behavior', () => {
    expect(
      canonicalReplayFixtureJson({
        z: 1,
        a: { y: 2, b: 1 },
      })
    ).toBe('{"a":{"b":1,"y":2},"z":1}\n');
    expect(() =>
      canonicalReplayFixtureJson({ body: 'BEGIN\nRETURN NEW;\nEND' })
    ).toThrow(/secret|credential|raw log/i);
  });
});
