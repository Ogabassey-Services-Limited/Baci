import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(
  new URL('./sync-cloudflare-vercel-production-env.sh', import.meta.url),
);
const API_TOKEN = 'api-token-that-must-never-be-logged';
const ZONE_ID = 'zone-id-that-must-never-be-logged';
const EXPECTED_KEYS = ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ZONE_ID'];

function makeRuntime() {
  const directory = mkdtempSync(join(tmpdir(), 'sync-cloudflare-vercel-env-'));
  const callsFile = join(directory, 'calls.jsonl');
  const stdinDirectory = join(directory, 'stdin');
  const wrapper = join(directory, 'fake-pinned-vercel.cjs');
  mkdirSync(stdinDirectory);

  writeFileSync(
    wrapper,
    `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
const key = args[2];
const value = fs.readFileSync(0, 'utf8');
fs.appendFileSync(process.env.FAKE_CALLS_FILE, JSON.stringify(args) + '\\n');
fs.writeFileSync(path.join(process.env.FAKE_STDIN_DIRECTORY, key), value);
process.stdout.write(value);
process.stderr.write(value);
if (process.env.FAKE_FAIL_KEY === key) process.exit(1);
`,
    { mode: 0o755 },
  );

  return { callsFile, directory, stdinDirectory, wrapper };
}

function run(runtime, env = {}) {
  return spawnSync(SCRIPT, [runtime.wrapper], {
    encoding: 'utf8',
    env: {
      ...process.env,
      CLOUDFLARE_API_TOKEN: API_TOKEN,
      CLOUDFLARE_ZONE_ID: ZONE_ID,
      FAKE_CALLS_FILE: runtime.callsFile,
      FAKE_STDIN_DIRECTORY: runtime.stdinDirectory,
      ...env,
    },
  });
}

function readCalls(runtime) {
  if (!readdirSync(runtime.directory).includes('calls.jsonl')) return [];
  return readFileSync(runtime.callsFile, 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
}

test('syncs both production credentials with exact argv and stdin-only values', () => {
  const runtime = makeRuntime();

  try {
    const result = run(runtime);

    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(
      readCalls(runtime),
      EXPECTED_KEYS.map((key) => [
        'env',
        'add',
        key,
        'production',
        '--sensitive',
        '--force',
        '--yes',
      ]),
    );
    assert.equal(
      readFileSync(join(runtime.stdinDirectory, 'CLOUDFLARE_API_TOKEN'), 'utf8'),
      API_TOKEN,
    );
    assert.equal(
      readFileSync(join(runtime.stdinDirectory, 'CLOUDFLARE_ZONE_ID'), 'utf8'),
      ZONE_ID,
    );
    assert.doesNotMatch(`${result.stdout}${result.stderr}`, new RegExp(API_TOKEN));
    assert.doesNotMatch(`${result.stdout}${result.stderr}`, new RegExp(ZONE_ID));
  } finally {
    rmSync(runtime.directory, { recursive: true, force: true });
  }
});

test('rejects blank credentials before calling Vercel', () => {
  const runtime = makeRuntime();

  try {
    const result = run(runtime, { CLOUDFLARE_ZONE_ID: '   ' });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /CLOUDFLARE_ZONE_ID.*non-blank/);
    assert.deepEqual(readCalls(runtime), []);
  } finally {
    rmSync(runtime.directory, { recursive: true, force: true });
  }
});

test('stops after the first Vercel mutation failure', () => {
  const runtime = makeRuntime();

  try {
    const result = run(runtime, { FAKE_FAIL_KEY: 'CLOUDFLARE_API_TOKEN' });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Failed to synchronize CLOUDFLARE_API_TOKEN/);
    assert.deepEqual(readCalls(runtime), [
      [
        'env',
        'add',
        'CLOUDFLARE_API_TOKEN',
        'production',
        '--sensitive',
        '--force',
        '--yes',
      ],
    ]);
    assert.deepEqual(readdirSync(runtime.stdinDirectory), ['CLOUDFLARE_API_TOKEN']);
  } finally {
    rmSync(runtime.directory, { recursive: true, force: true });
  }
});
