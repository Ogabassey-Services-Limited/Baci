import type { ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { runMobileMerchantProvisioningConcurrency } from './run-mobile-merchant-provisioning-concurrency';

const harnessSource = readFileSync(
  join(
    process.cwd(),
    'tools/db/run-mobile-merchant-provisioning-concurrency.ts'
  ),
  'utf8'
);

function createControlledPsqlSpawn(): {
  inputs: string[];
  spawnProcess: typeof spawn;
} {
  const inputs: string[] = [];
  let invocation = 0;

  const spawnProcess = (() => {
    invocation += 1;
    const callNumber = invocation;
    const child = Object.assign(new EventEmitter(), {
      kill: () => true,
      stderr: new PassThrough(),
      stdin: new PassThrough(),
      stdout: new PassThrough(),
    });
    let input = '';

    child.stdin.on('data', (chunk: Buffer) => {
      input += chunk.toString('utf8');
      if (input.includes('\\echo A_PROVISIONED')) {
        child.stdout.write('A_PROVISIONED\n');
      }
      if (input.includes('\\echo B_STARTED')) {
        child.stdout.write('B_STARTED\n');
      }
    });
    child.stdin.on('end', () => {
      inputs.push(input);
      if (callNumber === 2) {
        child.stdout.write('merchant-a|concurrent-a|t\n');
      } else if (callNumber === 3) {
        child.stdout.write('merchant-a|concurrent-a|f\n');
      } else if (callNumber === 4) {
        child.stdout.write('1|1|1\n');
      }
      child.emit('close', 0);
    });

    return child as unknown as ChildProcessWithoutNullStreams;
  }) as unknown as typeof spawn;

  return { inputs, spawnProcess };
}

describe('runMobileMerchantProvisioningConcurrency', () => {
  it('rejects a missing or non-loopback database before spawning sessions', async () => {
    await expect(
      runMobileMerchantProvisioningConcurrency({ databaseUrl: undefined })
    ).rejects.toThrow('LOCAL_DATABASE_URL is required');
    await expect(
      runMobileMerchantProvisioningConcurrency({
        databaseUrl:
          'postgresql://postgres:secret@db.example.test:5432/postgres',
      })
    ).rejects.toThrow('Supabase replay database URL is not supported');
  });

  it('coordinates two authenticated sessions with markers and no timing sleeps', () => {
    expect(harnessSource).toContain('SET LOCAL ROLE authenticated');
    expect(harnessSource).toContain('A_PROVISIONED');
    expect(harnessSource).toContain('B_STARTED');
    expect(harnessSource).toContain('provision_mobile_merchant_v2');
    expect(harnessSource).not.toMatch(/\bsetTimeout\s*\(/);
    expect(harnessSource).not.toMatch(/\bsleep\s*\(/i);
  });

  it('asserts one merchant, platform domain, and owner staff row', () => {
    expect(harnessSource).toContain('merchant_count');
    expect(harnessSource).toContain('domain_count');
    expect(harnessSource).toContain('staff_count');
    expect(harnessSource).toContain('created_true_count');
  });

  it('deletes the provisioned merchant under its user audit actor', async () => {
    const { inputs, spawnProcess } = createControlledPsqlSpawn();

    await runMobileMerchantProvisioningConcurrency({
      databaseUrl: 'postgresql://postgres:local@127.0.0.1:54322/postgres',
      psqlBin: 'psql',
      spawnProcess,
    });

    const setupSql = inputs[0] ?? '';
    const cleanupSql = inputs.at(-1) ?? '';
    const userId = setupSql.match(
      /INSERT INTO auth\.users \(id, email\) VALUES \('([^']+)'/
    )?.[1];

    expect(userId).toBeDefined();
    expect(cleanupSql).toContain('BEGIN;');
    expect(cleanupSql).toContain("'app.audit_actor_user_id'");
    expect(cleanupSql).toContain(`'${userId}'`);
    expect(cleanupSql).toMatch(
      /app\.audit_actor_user_id[\s\S]*DELETE FROM public\.merchants/
    );
    expect(cleanupSql).toContain('COMMIT;');
  });
});
