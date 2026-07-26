import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(
  new URL('./inject-prebuilt-env-secret.mjs', import.meta.url),
);

// A representative pulled env file: a sensitive var written empty by `vercel pull`
// plus ordinary quoted vars that must survive untouched.
const PULLED = [
  'AI_CHAT_MODEL="cerebras"',
  'QUIZ_RPC_SERVER_SECRET=""',
  'QUIZ_PHASE="production"',
  '',
].join('\n');

function makeEnvFile(contents = PULLED) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'inject-env-'));
  const file = path.join(dir, '.env.production.local');
  fs.writeFileSync(file, contents);
  return file;
}

function run(args, env = {}) {
  return execFileSync('node', [SCRIPT, ...args], {
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
}

function runExpectFailure(args, env = {}) {
  try {
    run(args, env);
    throw new Error('expected non-zero exit');
  } catch (err) {
    if (err.status === undefined) throw err;
    return { status: err.status, stderr: String(err.stderr ?? '') };
  }
}

test('overwrites the empty sensitive line with the injected value', () => {
  const file = makeEnvFile();
  run(['QUIZ_RPC_SERVER_SECRET', file], {
    QUIZ_RPC_SERVER_SECRET: 'a'.repeat(48),
  });
  const out = fs.readFileSync(file, 'utf8');
  assert.match(out, /^QUIZ_RPC_SERVER_SECRET="a{48}"$/m);
  // Exactly one occurrence — the empty one was removed, not duplicated.
  assert.equal(out.match(/^QUIZ_RPC_SERVER_SECRET=/gm).length, 1);
});

test('leaves every other pulled var byte-for-byte intact', () => {
  const file = makeEnvFile();
  run(['QUIZ_RPC_SERVER_SECRET', file], { QUIZ_RPC_SERVER_SECRET: 'x'.repeat(40) });
  const out = fs.readFileSync(file, 'utf8');
  assert.match(out, /^AI_CHAT_MODEL="cerebras"$/m);
  assert.match(out, /^QUIZ_PHASE="production"$/m);
});

test('is a no-op when the secret is unset (1a deploy path)', () => {
  const file = makeEnvFile();
  const before = fs.readFileSync(file, 'utf8');
  const stdout = run(['QUIZ_RPC_SERVER_SECRET', file], {
    QUIZ_RPC_SERVER_SECRET: '',
  });
  assert.equal(fs.readFileSync(file, 'utf8'), before);
  assert.match(stdout, /leaving .* unchanged/);
});

test('replaces an already-populated value instead of appending', () => {
  const file = makeEnvFile(
    'QUIZ_RPC_SERVER_SECRET="old-value-old-value-old-value-01"\n',
  );
  run(['QUIZ_RPC_SERVER_SECRET', file], { QUIZ_RPC_SERVER_SECRET: 'n'.repeat(36) });
  const out = fs.readFileSync(file, 'utf8');
  assert.equal(out.match(/^QUIZ_RPC_SERVER_SECRET=/gm).length, 1);
  assert.doesNotMatch(out, /old-value/);
});

test('does not accumulate trailing blank lines across runs', () => {
  const file = makeEnvFile();
  run(['QUIZ_RPC_SERVER_SECRET', file], { QUIZ_RPC_SERVER_SECRET: 'y'.repeat(32) });
  run(['QUIZ_RPC_SERVER_SECRET', file], { QUIZ_RPC_SERVER_SECRET: 'z'.repeat(32) });
  const out = fs.readFileSync(file, 'utf8');
  assert.doesNotMatch(out, /\n\n$/);
  assert.equal(out.match(/^QUIZ_RPC_SERVER_SECRET=/gm).length, 1);
});

test('fails loudly rather than corrupt a value containing a double quote', () => {
  const file = makeEnvFile();
  const before = fs.readFileSync(file, 'utf8');
  const { status, stderr } = runExpectFailure(['QUIZ_RPC_SERVER_SECRET', file], {
    QUIZ_RPC_SERVER_SECRET: 'has"quote'.padEnd(40, 'x'),
  });
  assert.equal(status, 1);
  assert.match(stderr, /double-quote|backslash/);
  // File untouched on refusal.
  assert.equal(fs.readFileSync(file, 'utf8'), before);
});

test('fails when the env file is missing', () => {
  const { status, stderr } = runExpectFailure(
    ['QUIZ_RPC_SERVER_SECRET', '/nonexistent/dir/.env.production.local'],
    { QUIZ_RPC_SERVER_SECRET: 'q'.repeat(40) },
  );
  assert.equal(status, 1);
  assert.match(stderr, /does not exist/);
});

test('exits 2 on missing arguments', () => {
  const { status } = runExpectFailure([], {});
  assert.equal(status, 2);
});
