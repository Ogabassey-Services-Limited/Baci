import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const hook = await readFile(
  new URL('./job-start-hook.sh', import.meta.url),
  'utf8'
);
const INJECTED_WATCHDOG_TIMEOUT_MS = 1_000;
const HARNESS_TIMEOUT_MS = 5_000;

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function nodeProgram() {
  const match = hook.match(/<<'HOOK_NODE'\n([\s\S]+)\nHOOK_NODE\n?$/);
  assert.ok(match, 'hook must contain one closed inline Node program');
  return match[1].replace(
    'const WATCHDOG_TIMEOUT_MS = 5_000;',
    `const WATCHDOG_TIMEOUT_MS = ${INJECTED_WATCHDOG_TIMEOUT_MS};`
  );
}

function run(program, environment = {}) {
  return spawnSync(process.execPath, ['--input-type=module', '-'], {
    encoding: 'utf8',
    env: { PATH: process.env.PATH, ...environment },
    input: program,
    timeout: HARNESS_TIMEOUT_MS,
  });
}

test('terminates blocked synchronous validation within the finite watchdog', () => {
  const program = nodeProgram();
  const blocked = program.replace(
    'const start = monotonicSeconds();',
    'for (;;) {}\nconst start = monotonicSeconds();'
  );
  assert.notEqual(
    blocked,
    program,
    'fixture must block inside worker validation'
  );

  const result = run(blocked);

  assert.equal(result.error, undefined);
  assert.equal(result.status, 124);
  assert.match(hook, /const WATCHDOG_TIMEOUT_MS = 5_000;/);
  assert.match(
    program,
    new RegExp(`const WATCHDOG_TIMEOUT_MS = ${INJECTED_WATCHDOG_TIMEOUT_MS};`)
  );
  assert.match(program, /new Worker\(/);
  assert.ok(program.indexOf('setTimeout(') < program.indexOf('new Worker('));
  assert.match(program, /worker\.terminate\(\)/);
  assert.match(program, /process\.exit\(124\)/);
  assert.doesNotMatch(program, /finish - start/);
});

test('preserves the positive receipt after worker validation completes', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'baci-cwv-hook-'));
  try {
    const policyPath = path.join(root, 'policy.json');
    const allowPath = path.join(root, 'admission.json');
    const eventPath = path.join(root, 'event.json');
    const policyText = JSON.stringify({
      repositoryAuthority: { hookTimeoutSeconds: 5 },
    });
    const admissionId = 'a'.repeat(64);
    const expectedSha = 'b'.repeat(40);
    const allow = {
      admissionId,
      campaignId: 'campaign-001',
      expectedSha,
      expiresMonotonicSeconds: 105,
      kind: 'allow',
      policyFileSha256: createHash('sha256').update(policyText).digest('hex'),
      repository: { id: 1100488586, name: 'ogabasseyy/Baci' },
      run: { attempt: 1, id: 42 },
      runner: { generation: 1, id: 7, name: 'baci-cwv-measurement-01' },
      schemaVersion: 1,
      workflow: {
        id: 7,
        job: 'attest',
        path: '.github/workflows/cwv-runner-attestation.yml',
        ref: 'refs/heads/main',
      },
    };
    const allowText = `${canonical(allow)}\n`;
    await Promise.all([
      writeFile(policyPath, policyText),
      writeFile(allowPath, allowText),
      writeFile(
        eventPath,
        JSON.stringify({ inputs: { admission_id: admissionId } })
      ),
    ]);
    await Promise.all([chmod(policyPath, 0o444), chmod(allowPath, 0o440)]);

    const uid = process.getuid?.() ?? 0;
    const gid = process.getgid?.() ?? 0;
    const program = nodeProgram()
      .replace(
        "const ALLOW_PATH = '/run/baci-cwv-admission/active.json';",
        `const ALLOW_PATH = ${JSON.stringify(allowPath)};`
      )
      .replace(
        "const POLICY_PATH = '/opt/baci-cwv/policy.json';",
        `const POLICY_PATH = ${JSON.stringify(policyPath)};`
      )
      .replace(
        'readClosed(POLICY_PATH, 262_144, 0, 0, 0o444)',
        `readClosed(POLICY_PATH, 262_144, ${uid}, ${gid}, 0o444)`
      )
      .replace(
        'readClosed(ALLOW_PATH, 32_768, 0, 10_001, 0o440)',
        `readClosed(ALLOW_PATH, 32_768, ${uid}, ${gid}, 0o440)`
      )
      .replace(
        / {2}function monotonicSeconds\(\) \{[\s\S]+?\n {2}\}/,
        '  function monotonicSeconds() { return 100; }'
      )
      .replace(
        "eventPath.startsWith('/github/workflow/')",
        `eventPath.startsWith(${JSON.stringify(root)})`
      );
    const environment = {
      GITHUB_EVENT_PATH: eventPath,
      GITHUB_JOB: 'attest',
      GITHUB_REF: 'refs/heads/main',
      GITHUB_REPOSITORY: 'ogabasseyy/Baci',
      GITHUB_REPOSITORY_ID: '1100488586',
      GITHUB_RUN_ATTEMPT: '1',
      GITHUB_RUN_ID: '42',
      GITHUB_SHA: expectedSha,
      GITHUB_WORKFLOW_REF:
        'ogabasseyy/Baci/.github/workflows/cwv-runner-attestation.yml@refs/heads/main',
      GITHUB_WORKFLOW_SHA: expectedSha,
      RUNNER_ARCH: 'X64',
      RUNNER_NAME: 'baci-cwv-measurement-01',
      RUNNER_OS: 'Linux',
    };

    const result = run(program, environment);

    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {
      ok: true,
      receipt: createHash('sha256').update(allowText).digest('hex'),
    });
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test('reads admission, policy, and event bytes from their opened descriptors', () => {
  const program = nodeProgram();

  assert.match(
    program,
    /openSync\(path, constants\.O_RDONLY \| constants\.O_NOFOLLOW\)/
  );
  assert.match(program, /fstatSync\(descriptor/);
  assert.match(program, /readFileSync\(descriptor, 'utf8'\)/);
  assert.match(program, /closeSync\(descriptor\)/);
  assert.doesNotMatch(program, /lstatSync/);
  assert.doesNotMatch(program, /readFileSync\(eventPath/);
});
