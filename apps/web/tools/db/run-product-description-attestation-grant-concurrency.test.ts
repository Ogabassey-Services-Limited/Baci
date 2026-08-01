import type { ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runProductDescriptionAttestationGrantConcurrency } from './run-product-description-attestation-grant-concurrency';

function createFailingSecondSessionSpawn() {
  const children: ReturnType<typeof createFakeChild>[] = [];
  const inputs: string[] = [];
  let invocation = 0;

  const spawnProcess = (() => {
    invocation += 1;
    const callNumber = invocation;
    const child = createFakeChild();
    children.push(child);
    let input = '';

    child.stdin.on('data', (chunk: Buffer) => {
      input += chunk.toString('utf8');
      if (callNumber === 2 && input.includes('A_GRANTED')) {
        queueMicrotask(() => child.stdout.write('A_GRANTED\n'));
      }
    });
    child.stdin.on('end', () => {
      inputs.push(input);
      queueMicrotask(() => {
        if (callNumber === 1 || callNumber === 4) {
          child.exitCode = 0;
          child.emit('close', 0);
        } else if (callNumber === 3) {
          child.stderr.write('second session failed');
          child.exitCode = 1;
          child.emit('close', 1);
        }
      });
    });

    return child as unknown as ChildProcessWithoutNullStreams;
  }) as unknown as typeof spawn;

  return { children, inputs, spawnProcess };
}

function createFakeChild() {
  const child = Object.assign(new EventEmitter(), {
    exitCode: null as number | null,
    kill: vi.fn((signal: NodeJS.Signals) => {
      child.signalCode = signal;
      child.emit('close', null, signal);
      return true;
    }),
    signalCode: null as NodeJS.Signals | null,
    stderr: new PassThrough(),
    stdin: new PassThrough(),
    stdout: new PassThrough(),
  });
  return child;
}

describe('runProductDescriptionAttestationGrantConcurrency', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('rejects an absent database URL before creating sessions', async () => {
    vi.stubEnv('LOCAL_DATABASE_URL', '');
    await expect(
      runProductDescriptionAttestationGrantConcurrency()
    ).rejects.toThrow('LOCAL_DATABASE_URL is required');
  });

  it('rejects a non-disposable database URL before creating sessions', async () => {
    await expect(
      runProductDescriptionAttestationGrantConcurrency({
        databaseUrl:
          'postgresql://postgres:secret@db.example.test:5432/postgres',
      })
    ).rejects.toThrow('Supabase replay database URL is not supported');
  });

  it('terminates the first transaction when second-session setup fails', async () => {
    const { children, inputs, spawnProcess } =
      createFailingSecondSessionSpawn();

    await expect(
      runProductDescriptionAttestationGrantConcurrency({
        databaseUrl: 'postgresql://postgres:local@127.0.0.1:54322/postgres',
        psqlBin: 'psql',
        spawnProcess,
      })
    ).rejects.toThrow('psql closed before B_STARTED');

    expect(children[1]?.kill).toHaveBeenCalledWith('SIGTERM');
    expect(inputs.at(-1)).toContain(
      'DELETE FROM private.product_description_attestation_grants'
    );
  });
});
