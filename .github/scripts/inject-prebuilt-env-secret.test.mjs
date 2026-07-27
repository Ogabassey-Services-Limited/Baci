import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createPrivateKey } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import nextEnv from '@next/env';

const { loadEnvConfig, resetEnv } = nextEnv;
const SCRIPT = fileURLToPath(
  new URL('./inject-prebuilt-env-secret.mjs', import.meta.url),
);
const DEPLOY_WORKFLOW = fileURLToPath(new URL('../workflows/deploy.yml', import.meta.url));
const KEY = 'QUIZ_RPC_SERVER_SECRET';
const STANDIN = 'build-time-presence-stand-in-not-used-at-runtime-000000000000';
const JWK_KEY = 'SUPABASE_AGENTIC_JWT_PRIVATE_JWK';
const GENERATE_ES256_JWK_STANDIN = '--generate-es256-jwk-standin';
const GENERATED_ES256_JWK_STANDIN_KID = 'baci-build-only-es256-jwk-standin';

// A pulled env file where the sensitive var exists in Vercel (written empty by
// `vercel pull`) alongside ordinary quoted vars that must survive untouched.
const PULLED_WITH_KEY = [
  'AI_CHAT_MODEL="cerebras"',
  `${KEY}=""`,
  'QUIZ_PHASE="production"',
  '',
].join('\n');

// A pulled env file where the sensitive var is genuinely absent from Vercel.
const PULLED_WITHOUT_KEY = ['AI_CHAT_MODEL="cerebras"', 'QUIZ_PHASE="production"', ''].join(
  '\n',
);

function makeEnvFile(contents = PULLED_WITH_KEY) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'inject-env-'));
  const file = path.join(dir, '.env.production.local');
  fs.writeFileSync(file, contents);
  return file;
}

function makePulledJwkEnvFile(value = '""') {
  return makeEnvFile(
    [
      'AI_CHAT_MODEL="cerebras"',
      `${JWK_KEY}=${value}`,
      'QUIZ_PHASE="production"',
      '',
    ].join('\n'),
  );
}

function run(args, env = {}) {
  return execFileSync('node', [SCRIPT, ...args], {
    env: { ...process.env, [KEY]: '', [JWK_KEY]: '', ...env },
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

function parseSingleQuotedValue(file, key) {
  const line = fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .find((entry) => entry.startsWith(`${key}=`));
  assert.ok(line);
  assert.match(line, new RegExp(`^${key}='.*'$`));
  return line.slice(`${key}='`.length, -1);
}

function assertGeneratedEs256PrivateJwk(serializedJwk) {
  const jwk = JSON.parse(serializedJwk);
  assert.equal(jwk.alg, 'ES256');
  assert.equal(jwk.crv, 'P-256');
  assert.equal(jwk.kid, GENERATED_ES256_JWK_STANDIN_KID);
  assert.equal(jwk.kty, 'EC');
  for (const field of ['d', 'x', 'y']) {
    assert.match(jwk[field], /^[A-Za-z0-9_-]+$/);
  }
  assert.doesNotThrow(() => createPrivateKey({ key: jwk, format: 'jwk' }));
}

test('injects the real value, overwriting the empty sensitive line', () => {
  const file = makeEnvFile();
  run([KEY, file], { [KEY]: 'a'.repeat(48) });
  const out = fs.readFileSync(file, 'utf8');
  assert.match(out, /^QUIZ_RPC_SERVER_SECRET="a{48}"$/m);
  assert.equal(out.match(/^QUIZ_RPC_SERVER_SECRET=/gm).length, 1);
});

test('real value wins over the stand-in when both are provided', () => {
  const file = makeEnvFile();
  run([KEY, file, STANDIN], { [KEY]: 'r'.repeat(40) });
  const out = fs.readFileSync(file, 'utf8');
  assert.match(out, /^QUIZ_RPC_SERVER_SECRET="r{40}"$/m);
});

test('real value is injected even when the key is absent from the file', () => {
  const file = makeEnvFile(PULLED_WITHOUT_KEY);
  run([KEY, file], { [KEY]: 'r'.repeat(40) });
  const out = fs.readFileSync(file, 'utf8');
  assert.match(out, /^QUIZ_RPC_SERVER_SECRET="r{40}"$/m);
});

test('stand-in is injected when one explicitly blank sensitive entry is present', () => {
  const file = makeEnvFile(PULLED_WITH_KEY);
  const stdout = run([KEY, file, STANDIN]);
  const out = fs.readFileSync(file, 'utf8');
  assert.match(out, new RegExp(`^QUIZ_RPC_SERVER_SECRET="${STANDIN}"$`, 'm'));
  assert.match(stdout, /build-time stand-in/);
});

test('stand-in is refused when the sensitive var is absent from Vercel', () => {
  const file = makeEnvFile(PULLED_WITHOUT_KEY);
  const before = fs.readFileSync(file, 'utf8');
  const { status, stderr } = runExpectFailure([KEY, file, STANDIN]);
  assert.equal(status, 1);
  assert.match(stderr, /absent|missing/i);
  assert.equal(fs.readFileSync(file, 'utf8'), before);
});

test('generated JWK stand-in refuses a nonblank pulled value', () => {
  const file = makePulledJwkEnvFile('"opaque-pulled-value"');
  const before = fs.readFileSync(file, 'utf8');
  const { status, stderr } = runExpectFailure([
    JWK_KEY,
    file,
    GENERATE_ES256_JWK_STANDIN,
  ]);
  assert.equal(status, 1);
  assert.match(stderr, /explicitly blank|opaque|nonblank/i);
  assert.equal(fs.readFileSync(file, 'utf8'), before);
});

test('generated JWK stand-in leaves an absent optional key unchanged', () => {
  const file = makeEnvFile(PULLED_WITHOUT_KEY);
  const before = fs.readFileSync(file, 'utf8');
  const stdout = run([JWK_KEY, file, GENERATE_ES256_JWK_STANDIN]);

  assert.equal(fs.readFileSync(file, 'utf8'), before);
  assert.match(stdout, /absent.*legacy signing-secret fallback/i);
});

test('generated JWK stand-in accepts only explicit blank dotenv forms', () => {
  const generatedValues = [];

  for (const blankValue of ['', "''", '""']) {
    const file = makePulledJwkEnvFile(blankValue);
    const stdout = run([JWK_KEY, file, GENERATE_ES256_JWK_STANDIN]);
    const generatedValue = parseSingleQuotedValue(file, JWK_KEY);
    assertGeneratedEs256PrivateJwk(generatedValue);
    assert.equal(stdout.includes(generatedValue), false);
    generatedValues.push(generatedValue);
  }

  assert.notEqual(generatedValues[0], generatedValues[1]);
});

test('writes a generated JWK that @next/env reads unchanged for build validation', () => {
  const file = makePulledJwkEnvFile();
  const originalValue = process.env[JWK_KEY];

  try {
    run([JWK_KEY, file, GENERATE_ES256_JWK_STANDIN]);
    const generatedValue = parseSingleQuotedValue(file, JWK_KEY);
    delete process.env[JWK_KEY];
    loadEnvConfig(path.dirname(file), false, console, true);
    assert.equal(process.env[JWK_KEY], generatedValue);
    assertGeneratedEs256PrivateJwk(process.env[JWK_KEY]);
  } finally {
    resetEnv();
    if (originalValue === undefined) delete process.env[JWK_KEY];
    else process.env[JWK_KEY] = originalValue;
  }
});

test('configured process value wins over an opaque pulled JWK and is not logged', () => {
  const file = makePulledJwkEnvFile('"opaque-pulled-value"');
  const runtimeValue = JSON.stringify({ kid: 'runtime-owned-kid', source: 'vercel-runtime' });
  const runtimeOutput = run([JWK_KEY, file, GENERATE_ES256_JWK_STANDIN], {
    [JWK_KEY]: runtimeValue,
  });
  assert.equal(parseSingleQuotedValue(file, JWK_KEY), runtimeValue);
  assert.equal(runtimeOutput.includes(runtimeValue), false);
  assert.doesNotMatch(runtimeOutput, /generated ES256 build-time stand-in/);
});

test('workflow generates the JWK internally and keeps runtime injection Vercel-owned', () => {
  const workflow = fs.readFileSync(DEPLOY_WORKFLOW, 'utf8');
  const stepStart = workflow.indexOf(
    '      - name: Ensure build-time presence of runtime-only scoped Supabase JWT key',
  );
  const buildStart = workflow.indexOf('      - name: Build for Vercel', stepStart);
  assert.ok(stepStart >= 0);
  assert.ok(buildStart > stepStart);

  const step = workflow.slice(stepStart, buildStart);
  assert.match(step, new RegExp(GENERATE_ES256_JWK_STANDIN));
  assert.doesNotMatch(step, /public Supabase documentation example/);
  assert.doesNotMatch(step, /"d"\s*:/);
  assert.doesNotMatch(step, /"kty"\s*:\s*"EC"/);
  assert.doesNotMatch(step, /^\s+env:/m);
  assert.doesNotMatch(step, /\$\{\{\s*secrets\./);
});

test('refuses a value containing a dollar sign because dotenv-expand can mangle it', () => {
  const file = makeEnvFile();
  const before = fs.readFileSync(file, 'utf8');
  const { status, stderr } = runExpectFailure([KEY, file], {
    [KEY]: 'abc$HOME'.padEnd(40, 'x'),
  });
  assert.equal(status, 1);
  assert.match(stderr, /dollar/i);
  assert.equal(fs.readFileSync(file, 'utf8'), before);
});

test('leaves every other pulled var byte-for-byte intact', () => {
  const file = makeEnvFile();
  run([KEY, file], { [KEY]: 'x'.repeat(40) });
  const out = fs.readFileSync(file, 'utf8');
  assert.match(out, /^AI_CHAT_MODEL="cerebras"$/m);
  assert.match(out, /^QUIZ_PHASE="production"$/m);
});

test('is a no-op when neither real value nor stand-in is provided', () => {
  const file = makeEnvFile();
  const before = fs.readFileSync(file, 'utf8');
  const stdout = run([KEY, file]);
  assert.equal(fs.readFileSync(file, 'utf8'), before);
  assert.match(stdout, /leaving .* unchanged/);
});

test('does not accumulate trailing blank lines across runs', () => {
  const file = makeEnvFile();
  run([KEY, file], { [KEY]: 'y'.repeat(32) });
  run([KEY, file], { [KEY]: 'z'.repeat(32) });
  const out = fs.readFileSync(file, 'utf8');
  assert.doesNotMatch(out, /\n\n$/);
  assert.equal(out.match(/^QUIZ_RPC_SERVER_SECRET=/gm).length, 1);
});

test('single-quotes compact JSON containing double quotes', () => {
  const jsonValue = '{"safe":"json"}';
  const file = makeEnvFile();
  run([KEY, file], { [KEY]: jsonValue });
  assert.equal(parseSingleQuotedValue(file, KEY), jsonValue);
});

test('fails when a value contains an apostrophe or backslash', () => {
  const file = makeEnvFile();
  const before = fs.readFileSync(file, 'utf8');
  const { status, stderr } = runExpectFailure([KEY, file], {
    [KEY]: "has'apostrophe",
  });
  assert.equal(status, 1);
  assert.match(stderr, /apostrophe|backslash/);
  assert.equal(fs.readFileSync(file, 'utf8'), before);
});

test('fails when the env file is missing', () => {
  const { status, stderr } = runExpectFailure(
    [KEY, '/nonexistent/dir/.env.production.local'],
    { [KEY]: 'q'.repeat(40) },
  );
  assert.equal(status, 1);
  assert.match(stderr, /does not exist/);
});

test('exits 2 on missing arguments', () => {
  const { status } = runExpectFailure([], {});
  assert.equal(status, 2);
});
