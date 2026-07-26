import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import test from 'node:test';
import { makeFakeCommand } from './deploy-with-retry.test-helpers.mjs';
import { runScript } from './deploy-with-retry.run-script.mjs';

// One regression test drives a genuinely hanging deploy through the real
// `timeout` so the kill path itself is covered (the direct-exit fakes below are
// supplemental, per-branch cases). Skip only where neither `timeout` nor
// `gtimeout` exists (a bare macOS dev box); it runs on the Linux CI/deploy
// runners.
const hasTimeoutCmd =
  spawnSync('bash', ['-c', 'command -v timeout || command -v gtimeout'])
    .status === 0;

test('promotes the observed deployment when deploy succeeds first try', () => {
  const fakeCommand = makeFakeCommand('success');

  try {
    const result = runScript(fakeCommand);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Deploy succeeded on attempt 1/);
    assert.match(
      result.stdout,
      /Promoting deployment https:\/\/baci-success\.vercel\.app to production/
    );
    assert.match(
      result.stdout,
      /Promoted https:\/\/baci-success\.vercel\.app to production/
    );
    assert.equal(readFileSync(fakeCommand.attemptsFile, 'utf8').trim(), '1');
    assert.equal(
      readFileSync(fakeCommand.promotedFile, 'utf8').trim(),
      'https://baci-success.vercel.app'
    );
  } finally {
    rmSync(fakeCommand.tempDir, { recursive: true, force: true });
  }
});

test('retries transient deploy failures and promotes the recovered deploy', () => {
  const fakeCommand = makeFakeCommand('retry-success');

  try {
    const result = runScript(fakeCommand);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Deploy failed, retrying/);
    assert.match(result.stdout, /Deploy succeeded on attempt 2/);
    assert.match(
      result.stdout,
      /Promoted https:\/\/baci-retry\.vercel\.app to production/
    );
    assert.equal(readFileSync(fakeCommand.attemptsFile, 'utf8').trim(), '2');
    assert.equal(
      readFileSync(fakeCommand.promotedFile, 'utf8').trim(),
      'https://baci-retry.vercel.app'
    );
  } finally {
    rmSync(fakeCommand.tempDir, { recursive: true, force: true });
  }
});

test('fails loudly when a successful deploy emits no promotable target', () => {
  const fakeCommand = makeFakeCommand('success-without-target');

  try {
    const result = runScript(fakeCommand);

    assert.equal(result.status, 1);
    assert.match(result.stdout, /Deploy succeeded on attempt 1/);
    assert.match(
      result.stderr,
      /no deployment URL\/ID was observed to promote/
    );
    assert.equal(readFileSync(fakeCommand.attemptsFile, 'utf8').trim(), '1');
  } finally {
    rmSync(fakeCommand.tempDir, { recursive: true, force: true });
  }
});

test('rejects a stale earlier target when a later successful attempt emits none', () => {
  const fakeCommand = makeFakeCommand('retry-success-stale-target');

  try {
    const result = runScript(fakeCommand);

    assert.equal(result.status, 1);
    assert.match(result.stdout, /Deploy succeeded on attempt 2/);
    assert.match(
      result.stderr,
      /no deployment URL\/ID was observed to promote/
    );
    // The stale https://baci-stale.vercel.app from the failed first attempt must
    // NOT be promoted — no promote command should have run at all.
    assert.throws(() => readFileSync(fakeCommand.promotedFile, 'utf8'));
    assert.equal(readFileSync(fakeCommand.attemptsFile, 'utf8').trim(), '2');
  } finally {
    rmSync(fakeCommand.tempDir, { recursive: true, force: true });
  }
});

test('promotes the observed deployment before recovering duplicate custom ids', () => {
  const fakeCommand = makeFakeCommand('duplicate-id-after-created');

  try {
    const result = runScript(fakeCommand);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /custom deployment id already exists/);
    assert.match(result.stdout, /promoting existing deployment/);
    assert.match(result.stdout, /recovered success/);
    assert.equal(readFileSync(fakeCommand.attemptsFile, 'utf8').trim(), '2');
    assert.equal(
      readFileSync(fakeCommand.promotedFile, 'utf8').trim(),
      'https://baci-recovered.vercel.app'
    );
  } finally {
    rmSync(fakeCommand.tempDir, { recursive: true, force: true });
  }
});

test('promotes through pnpm exec vercel command prefixes', () => {
  const fakeCommand = makeFakeCommand('duplicate-id-after-created');

  try {
    const result = runScript(fakeCommand, ['pnpm', 'exec', 'vercel', 'deploy']);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /promoting existing deployment/);
    assert.equal(
      readFileSync(fakeCommand.promotedFile, 'utf8').trim(),
      'https://baci-recovered.vercel.app'
    );
  } finally {
    rmSync(fakeCommand.tempDir, { recursive: true, force: true });
  }
});

test('promotes through npx vercel command prefixes', () => {
  const fakeCommand = makeFakeCommand('duplicate-id-after-created');

  try {
    const result = runScript(fakeCommand, ['npx', 'vercel', 'deploy']);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /promoting existing deployment/);
    assert.equal(
      readFileSync(fakeCommand.promotedFile, 'utf8').trim(),
      'https://baci-recovered.vercel.app'
    );
  } finally {
    rmSync(fakeCommand.tempDir, { recursive: true, force: true });
  }
});

test('refuses duplicate custom id recovery without an observed deployment target', () => {
  const fakeCommand = makeFakeCommand('duplicate-id');

  try {
    const result = runScript(fakeCommand);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /no deployment URL or ID was observed/);
    assert.match(result.stdout, /Deploy failed after 2 attempts/);
    assert.equal(readFileSync(fakeCommand.attemptsFile, 'utf8').trim(), '2');
  } finally {
    rmSync(fakeCommand.tempDir, { recursive: true, force: true });
  }
});

test('recovers when a deploy attempt is SIGKILLed (exit 137) after creating the deployment', () => {
  const fakeCommand = makeFakeCommand('killed-137-after-create');

  try {
    // No timeout needed: the fake exits 137 directly, the way `timeout -k` does
    // when it escalates to SIGKILL against a TERM-resistant hung deploy.
    const result = runScript(fakeCommand);

    assert.equal(result.status, 0, result.stderr);
    assert.match(
      result.stdout,
      /Recovered killed deploy by promoting https:\/\/baci-hang\.vercel\.app/
    );
    assert.equal(
      readFileSync(fakeCommand.promotedFile, 'utf8').trim(),
      'https://baci-hang.vercel.app'
    );
    assert.equal(readFileSync(fakeCommand.attemptsFile, 'utf8').trim(), '1');
  } finally {
    rmSync(fakeCommand.tempDir, { recursive: true, force: true });
  }
});

test(
  'recovers a genuinely hung deploy that the real timeout has to kill',
  { skip: hasTimeoutCmd ? false : 'timeout/gtimeout unavailable' },
  () => {
    const fakeCommand = makeFakeCommand('hang-until-killed');

    try {
      // Exercises run_with_timeout end to end: the fake blocks in `sleep` until
      // `timeout` (exit 124, or 137 if it must escalate to KILL) terminates it,
      // and the created deployment is then promoted. Reproduces the exact CLI-57
      // hang the direct-exit fakes only simulate.
      const result = runScript(fakeCommand, ['fake-vercel', 'deploy'], {
        DEPLOY_ATTEMPT_TIMEOUT_SECONDS: '2',
      });

      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /Recovered killed deploy by promoting/);
      assert.equal(
        readFileSync(fakeCommand.promotedFile, 'utf8').trim(),
        'https://baci-hang.vercel.app'
      );
      assert.equal(readFileSync(fakeCommand.attemptsFile, 'utf8').trim(), '1');
    } finally {
      rmSync(fakeCommand.tempDir, { recursive: true, force: true });
    }
  }
);

test('retries (keeps its attempts) when a killed deploy cannot be promoted', () => {
  const fakeCommand = makeFakeCommand('killed-137-promote-fails');

  try {
    // A 137 whose deployment is not promotable (unrelated/OOM kill, not a -k
    // escalation) must NOT be treated as a recovered timeout: the promote fails
    // and the run falls through to its normal retries rather than exiting.
    const result = runScript(fakeCommand);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Could not promote/);
    assert.match(result.stdout, /Deploy failed after 2 attempts/);
    // both attempts ran, and nothing was ever promoted
    assert.equal(readFileSync(fakeCommand.attemptsFile, 'utf8').trim(), '2');
    assert.throws(() => readFileSync(fakeCommand.promotedFile, 'utf8'));
  } finally {
    rmSync(fakeCommand.tempDir, { recursive: true, force: true });
  }
});

test('re-promotes the same deployment on a transient promote failure (no new deploy)', () => {
  const fakeCommand = makeFakeCommand('killed-137-promote-flaky');

  try {
    // The first promote fails transiently and the second succeeds. The captured
    // target is re-promoted rather than a fresh deploy being started, so there
    // is still exactly ONE deploy attempt and no duplicate deployment.
    const result = runScript(fakeCommand, ['fake-vercel', 'deploy'], {
      PROMOTE_ATTEMPTS: '3',
    });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Recovered killed deploy by promoting/);
    assert.equal(
      readFileSync(fakeCommand.promotedFile, 'utf8').trim(),
      'https://baci-hang.vercel.app'
    );
    assert.equal(readFileSync(fakeCommand.attemptsFile, 'utf8').trim(), '1');
  } finally {
    rmSync(fakeCommand.tempDir, { recursive: true, force: true });
  }
});

test('fails after max attempts for unrelated deploy errors', () => {
  const fakeCommand = makeFakeCommand('fatal');

  try {
    const result = runScript(fakeCommand);

    assert.equal(result.status, 1);
    assert.match(result.stdout, /fatal deploy failure/);
    assert.match(result.stdout, /Deploy failed after 2 attempts/);
    assert.equal(readFileSync(fakeCommand.attemptsFile, 'utf8').trim(), '2');
  } finally {
    rmSync(fakeCommand.tempDir, { recursive: true, force: true });
  }
});
