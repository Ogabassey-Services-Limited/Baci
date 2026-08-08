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
if (process.env.FAKE_FAIL_UPDATE_KEY === key && args[1] === 'update') {
  process.stdout.write(JSON.stringify({
    status: 'error',
    reason: process.env.FAKE_UPDATE_FAILURE_REASON || 'env_not_found',
  }));
  process.stderr.write(value);
  process.exit(1);
}
process.stdout.write(value);
process.stderr.write(value);
if (process.env.FAKE_FAIL_ADD_KEY === key && args[1] === 'add') process.exit(1);
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

test('updates existing production credentials with stdin-only sensitive values', () => {
  const runtime = makeRuntime();

  try {
    const result = run(runtime);

    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(
      readCalls(runtime),
      EXPECTED_KEYS.map((key) => [
        'env',
        'update',
        key,
        'production',
        '--sensitive',
        '--yes',
        '--non-interactive',
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

test('creates a production credential only when update reports it missing', () => {
  const runtime = makeRuntime();

  try {
    const result = run(runtime, {
      FAKE_FAIL_UPDATE_KEY: 'CLOUDFLARE_API_TOKEN',
    });

    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(readCalls(runtime), [
      [
        'env',
        'update',
        'CLOUDFLARE_API_TOKEN',
        'production',
        '--sensitive',
        '--yes',
        '--non-interactive',
      ],
      [
        'env',
        'add',
        'CLOUDFLARE_API_TOKEN',
        'production',
        '--sensitive',
        '--yes',
        '--non-interactive',
      ],
      [
        'env',
        'update',
        'CLOUDFLARE_ZONE_ID',
        'production',
        '--sensitive',
        '--yes',
        '--non-interactive',
      ],
    ]);
  } finally {
    rmSync(runtime.directory, { recursive: true, force: true });
  }
});

test('stops without creating when update reports a generic failure', () => {
  const runtime = makeRuntime();

  try {
    const result = run(runtime, {
      FAKE_FAIL_UPDATE_KEY: 'CLOUDFLARE_API_TOKEN',
      FAKE_UPDATE_FAILURE_REASON: 'not_authorized',
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Failed to update CLOUDFLARE_API_TOKEN/);
    assert.deepEqual(readCalls(runtime), [
      [
        'env',
        'update',
        'CLOUDFLARE_API_TOKEN',
        'production',
        '--sensitive',
        '--yes',
        '--non-interactive',
      ],
    ]);
  } finally {
    rmSync(runtime.directory, { recursive: true, force: true });
  }
});

test('stops when both update and create fail for a credential', () => {
  const runtime = makeRuntime();

  try {
    const result = run(runtime, {
      FAKE_FAIL_ADD_KEY: 'CLOUDFLARE_API_TOKEN',
      FAKE_FAIL_UPDATE_KEY: 'CLOUDFLARE_API_TOKEN',
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Failed to synchronize CLOUDFLARE_API_TOKEN/);
    assert.deepEqual(readCalls(runtime), [
      [
        'env',
        'update',
        'CLOUDFLARE_API_TOKEN',
        'production',
        '--sensitive',
        '--yes',
        '--non-interactive',
      ],
      [
        'env',
        'add',
        'CLOUDFLARE_API_TOKEN',
        'production',
        '--sensitive',
        '--yes',
        '--non-interactive',
      ],
    ]);
  } finally {
    rmSync(runtime.directory, { recursive: true, force: true });
  }
});
