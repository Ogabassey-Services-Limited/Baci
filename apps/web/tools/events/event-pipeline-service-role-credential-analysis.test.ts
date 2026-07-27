import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { serviceRoleCredentialAuthority } from './event-pipeline-service-role-credential-analysis';

const b0WorkerPath = 'vps-workers/jobs/drain-cache-invalidations.mjs';
const b0WorkerSource = readFileSync(
  join(process.cwd(), '../../vps-workers/jobs/drain-cache-invalidations.mjs'),
  'utf8'
);
const b0OnlyLedgers = {
  approvedB0ReaderHashes:
    serviceRoleCredentialAuthority.ledgers.approvedB0ReaderHashes,
  approvedTask6ReaderHashes: {},
  preExistingReaderHashes: {},
  testSupportReaderHashes: {},
};

describe('serviceRoleCredentialAuthority', () => {
  it('accepts only the byte-approved B0 worker source', () => {
    const findings = serviceRoleCredentialAuthority.findings(
      new Map([[b0WorkerPath, b0WorkerSource]]),
      b0OnlyLedgers
    );

    expect(findings).toEqual([]);
  });

  it('rejects B0 worker hash drift, a missing worker, and an unclassified reader', () => {
    const drift = serviceRoleCredentialAuthority.findings(
      new Map([[b0WorkerPath, `${b0WorkerSource}\n// drift`]]),
      b0OnlyLedgers
    );
    const missing = serviceRoleCredentialAuthority.findings(
      new Map(),
      b0OnlyLedgers
    );
    const unclassified = serviceRoleCredentialAuthority.findings(
      new Map([
        [b0WorkerPath, b0WorkerSource],
        [
          'vps-workers/jobs/rogue-reader.mjs',
          'process.env.SUPABASE_SERVICE_ROLE_KEY',
        ],
      ]),
      b0OnlyLedgers
    );

    expect(drift).toContain(
      `${b0WorkerPath}: B0 approved service-role credential reader hash drift`
    );
    expect(missing).toContain(
      `${b0WorkerPath}: classified service-role credential reader is missing`
    );
    expect(unclassified).toContain(
      'vps-workers/jobs/rogue-reader.mjs: unclassified production service-role credential read'
    );
  });

  it.each([
    'process.env.SUPABASE_SERVICE_ROLE_KEY',
    "process.env['SUPABASE_' + 'SERVICE_ROLE_KEY']",
    "const key = 'SUPABASE_SERVICE_ROLE_KEY'; process.env[key]",
    "Reflect.get(process.env, 'SUPABASE_' + 'SERVICE_ROLE_KEY')",
    'const { SUPABASE_SERVICE_ROLE_KEY: key } = process.env; use(key)',
    "const { ['SUPABASE_SERVICE_ROLE_KEY']: key } = process.env; use(key)",
    "const name = 'SUPABASE_SERVICE_ROLE_KEY'; const { [name]: key } = process.env; use(key)",
  ])('detects a service-role credential read: %s', (source) => {
    expect(
      serviceRoleCredentialAuthority.readsCredential('worker.ts', source)
    ).toBe(true);
  });

  it('ignores string literals and comments without a credential read', () => {
    expect(
      serviceRoleCredentialAuthority.readsCredential(
        'worker.ts',
        "// SUPABASE_SERVICE_ROLE_KEY\nthrow new Error('SUPABASE_SERVICE_ROLE_KEY')"
      )
    ).toBe(false);
  });

  it('detects a service-role credential read inside JSX', () => {
    expect(
      serviceRoleCredentialAuthority.readsCredential(
        'worker.jsx',
        'export const View = () => condition ? <div /> : <div data-key={process.env.SUPABASE_SERVICE_ROLE_KEY} />;'
      )
    ).toBe(true);
  });

  it('fails closed for an unclassified production reader and hash drift', () => {
    const source = 'process.env.SUPABASE_SERVICE_ROLE_KEY';
    const sources = new Map([
      ['unclassified.ts', source],
      ['allowed.ts', source],
    ]);
    expect(
      serviceRoleCredentialAuthority.findings(sources, {
        approvedTask6ReaderHashes: {},
        preExistingReaderHashes: {
          'allowed.ts': createHash('sha256').update('different').digest('hex'),
        },
        testSupportReaderHashes: {},
      })
    ).toEqual([
      'allowed.ts: pre-existing service-role credential reader hash drift',
      'unclassified.ts: unclassified production service-role credential read',
    ]);
  });

  it('ignores test and spec modules across supported extensions', () => {
    const sources = new Map([
      ['worker.test.ts', 'process.env.SUPABASE_SERVICE_ROLE_KEY'],
      ['worker.spec.tsx', 'process.env.SUPABASE_SERVICE_ROLE_KEY'],
      ['worker.test.mjs', 'process.env.SUPABASE_SERVICE_ROLE_KEY'],
    ]);
    expect(
      serviceRoleCredentialAuthority.findings(sources, {
        approvedTask6ReaderHashes: {},
        preExistingReaderHashes: {},
        testSupportReaderHashes: {},
      })
    ).toEqual([]);
  });
});
