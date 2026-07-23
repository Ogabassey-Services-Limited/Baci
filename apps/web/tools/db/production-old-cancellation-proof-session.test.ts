import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createProductionOldCancellationProofSession } from './production-old-cancellation-proof-session';

type FakeChildOptions = {
  closeOnKill?: boolean;
};

function fakeChild(options: FakeChildOptions = {}) {
  const child = Object.assign(new EventEmitter(), {
    stderr: new PassThrough(),
    stdin: new PassThrough(),
    stdout: new PassThrough(),
    kill: vi.fn((signal: NodeJS.Signals) => {
      if (options.closeOnKill ?? true) child.emit('close', 0, signal);
      return true;
    }),
  });
  return child;
}

function createSession(
  child: ReturnType<typeof fakeChild>,
  overrides: Partial<
    Parameters<typeof createProductionOldCancellationProofSession>[0]
  > = {}
) {
  const spawnProcess = vi.fn(() => child);
  const session = createProductionOldCancellationProofSession({
    environment: {
      DATABASE_URL: 'postgresql://postgres:url-secret@127.0.0.1:5432/postgres',
      PGDATABASE: 'postgres',
      PGHOST: '127.0.0.1',
      PGPASSWORD: 'pg-secret',
      PGPORT: '5432',
      PGUSER: 'postgres',
      TEST_ENV: 'must-not-reach-child',
    },
    psqlBin: '/opt/homebrew/bin/psql',
    spawnProcess: spawnProcess as never,
    ...overrides,
  });
  return { session, spawnProcess };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('createProductionOldCancellationProofSession', () => {
  it('uses exact non-secret argv and only the passed PG environment', async () => {
    const child = fakeChild();
    let stdin = '';
    child.stdin.on('data', (bytes) => {
      stdin += bytes.toString();
    });
    const { session, spawnProcess } = createSession(child);

    const response = session.exchange(
      'BEGIN;\nSELECT 1;',
      '__BACI_PROOF_STAGE_1__'
    );
    child.stdout.write('1\n__BACI_PROOF_STAGE_1__\n');

    await expect(response).resolves.toBe('1\n');
    expect(spawnProcess).toHaveBeenCalledWith(
      '/opt/homebrew/bin/psql',
      ['-X', '-w', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '--no-readline'],
      {
        env: {
          PGDATABASE: 'postgres',
          PGHOST: '127.0.0.1',
          PGOPTIONS: [
            '-c statement_timeout=15s',
            '-c lock_timeout=3s',
            '-c idle_in_transaction_session_timeout=30s',
            '-c client_min_messages=warning',
          ].join(' '),
          PGPASSWORD: 'pg-secret',
          PGPORT: '5432',
          PGUSER: 'postgres',
        },
        shell: false,
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );
    const spawnArguments = spawnProcess.mock.calls[0] as unknown[];
    expect(JSON.stringify(spawnArguments.slice(0, 2))).not.toContain(
      'url-secret'
    );
    expect(JSON.stringify(spawnArguments[2])).not.toContain('DATABASE_URL');
    expect(JSON.stringify(spawnArguments[2])).not.toContain(
      'must-not-reach-child'
    );
    expect(stdin).toBe('BEGIN;\nSELECT 1;\n\\echo __BACI_PROOF_STAGE_1__\n');

    const closing = session.rollbackAndClose();
    expect(stdin).toContain('ROLLBACK;\n\\q\n');
    child.emit('close', 0);
    await expect(closing).resolves.toBeUndefined();
  });

  it('escalates a timed-out child from SIGTERM to SIGKILL after a bound', async () => {
    vi.useFakeTimers();
    const child = fakeChild({ closeOnKill: false });
    const { session } = createSession(child, {
      executionTimeoutMs: 20,
      terminationGraceMs: 10,
    });
    const response = session.exchange('SELECT 1;', '__BACI_TIMEOUT__');
    const rejection = expect(response).rejects.toThrow(
      /^Production-old cancellation proof failed: timeout$/
    );

    await vi.advanceTimersByTimeAsync(20);
    await rejection;
    expect(child.kill).toHaveBeenNthCalledWith(1, 'SIGTERM');

    await vi.advanceTimersByTimeAsync(10);
    expect(child.kill).toHaveBeenNthCalledWith(2, 'SIGKILL');
    child.emit('close', null, 'SIGKILL');
  });

  it('does not escalate after the child closes on SIGTERM', async () => {
    vi.useFakeTimers();
    const child = fakeChild();
    const { session } = createSession(child, {
      executionTimeoutMs: 20,
      terminationGraceMs: 10,
    });
    const response = session.exchange('SELECT 1;', '__BACI_TIMEOUT_CLOSE__');
    const rejection = expect(response).rejects.toThrow(
      /^Production-old cancellation proof failed: timeout$/
    );

    await vi.advanceTimersByTimeAsync(20);
    await rejection;
    await vi.advanceTimersByTimeAsync(10);
    expect(child.kill).toHaveBeenCalledTimes(1);
  });

  it('sanitizes stdout overflow without exposing child output', async () => {
    const child = fakeChild();
    const { session } = createSession(child, {
      limits: { stderrBytes: 16, stdinBytes: 64, stdoutBytes: 8 },
    });
    const response = session.exchange('BEGIN;', '__BACI_STDOUT_LIMIT__');

    child.stdout.write('secret-output-overflow');

    await expect(response).rejects.toThrow(
      /^Production-old cancellation proof failed: stdout-limit$/
    );
  });

  it('sanitizes stderr overflow without exposing child output', async () => {
    const child = fakeChild();
    const { session } = createSession(child, {
      limits: { stderrBytes: 8, stdinBytes: 64, stdoutBytes: 64 },
    });
    const response = session.exchange('BEGIN;', '__BACI_STDERR_LIMIT__');

    child.stderr.write('postgresql://postgres:stderr-secret@localhost/db');

    await expect(response).rejects.toThrow(
      /^Production-old cancellation proof failed: stderr-limit$/
    );
  });

  it('rejects input over the cumulative stdin bound without exposing it', async () => {
    const child = fakeChild();
    const { session } = createSession(child, {
      limits: { stderrBytes: 64, stdinBytes: 8, stdoutBytes: 64 },
    });

    await expect(
      session.exchange('stdin-secret', '__BACI_STDIN_LIMIT__')
    ).rejects.toThrow(
      /^Production-old cancellation proof failed: stdin-limit$/
    );
  });

  it('sanitizes a synchronous spawn failure', () => {
    expect(() =>
      createProductionOldCancellationProofSession({
        environment: { PGPASSWORD: 'spawn-secret' },
        psqlBin: 'psql',
        spawnProcess: vi.fn(() => {
          throw new Error('spawn-secret');
        }) as never,
      })
    ).toThrow(/^Production-old cancellation proof failed: spawn-error$/);
  });

  it('sanitizes an asynchronous spawn failure', async () => {
    const child = fakeChild();
    const { session } = createSession(child);
    const response = session.exchange('SELECT 1;', '__BACI_SPAWN_ERROR__');

    child.emit('error', new Error('spawn-secret'));

    await expect(response).rejects.toThrow(
      /^Production-old cancellation proof failed: spawn-error$/
    );
  });

  it('sanitizes a stdin stream failure', async () => {
    const child = fakeChild();
    const { session } = createSession(child);
    const response = session.exchange('SELECT 1;', '__BACI_STDIN_ERROR__');

    child.stdin.emit('error', new Error('stdin-secret'));

    await expect(response).rejects.toThrow(
      /^Production-old cancellation proof failed: stdin-error$/
    );
  });

  it('sanitizes a stdin write callback failure', async () => {
    const child = fakeChild();
    child.stdin.write = vi.fn((_input, callback) => {
      callback(new Error('stdin-callback-secret'));
      return false;
    }) as never;
    const { session } = createSession(child);

    await expect(
      session.exchange('SELECT 1;', '__BACI_STDIN_CALLBACK_ERROR__')
    ).rejects.toThrow(
      /^Production-old cancellation proof failed: stdin-error$/
    );
  });

  it('sanitizes a nonzero child exit', async () => {
    const child = fakeChild();
    const { session } = createSession(child);
    const response = session.exchange('SELECT 1;', '__BACI_CHILD_EXIT__');

    child.emit('close', 2);

    await expect(response).rejects.toThrow(
      /^Production-old cancellation proof failed: child-exit$/
    );
  });
});
