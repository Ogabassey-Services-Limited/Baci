import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const script = new URL('./retire-ollama.sh', import.meta.url);

test('acquires one operation lock before both production scan and apply', async () => {
  const source = await readFile(script, 'utf8');
  assert.match(source, /--scan\) root; retirement_lock; scan/);
  assert.match(source, /--apply\) root; retirement_lock; apply/);
  assert.match(source, /flock=\/usr\/bin\/flock/);
});

test('refuses a scan while apply holds the reviewed receipt lock', async (t) => {
  if (process.platform !== 'linux') {
    t.skip('the production flock contract executes on Linux');
    return;
  }

  const directory = await mkdtemp(join(tmpdir(), 'baci-retire-lock-'));
  const lock = join(directory, 'operation.lock');
  const ready = join(directory, 'apply-ready');
  const scanMarker = join(directory, 'scan-ran');
  const environment = {
    ...process.env,
    RETIRE_OLLAMA_TEST_BIN: '/usr/bin',
    RETIRE_OLLAMA_FLOCK: '/usr/bin/flock',
    RETIRE_OLLAMA_LOCK: lock,
  };
  const apply = spawn(
    'sh',
    [
      '-c',
      `. "$1"; root() { :; }; apply() { : >"$2"; sleep 10; }; main --apply`,
      `${script.pathname}.source`,
      script.pathname,
      ready,
    ],
    { env: environment, stdio: ['ignore', 'ignore', 'pipe'] }
  );

  try {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      try {
        await readFile(ready);
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    }
    await readFile(ready);
    await assert.rejects(
      execFileAsync(
        'sh',
        [
          '-c',
          `. "$1"; root() { :; }; scan() { : >"$2"; }; main --scan`,
          `${script.pathname}.source`,
          script.pathname,
          scanMarker,
        ],
        { env: environment }
      ),
      (error) =>
        error.code === 75 &&
        /another retirement operation owns the lock/.test(error.stderr)
    );
    await assert.rejects(readFile(scanMarker));
  } finally {
    apply.kill('SIGTERM');
    await new Promise((resolve) => apply.once('close', resolve));
    await rm(directory, { recursive: true, force: true });
  }
});
