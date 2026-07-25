import assert from 'node:assert/strict';
import { readFileSync, rmSync } from 'node:fs';
import test from 'node:test';
import { makeFakeCommand } from './deploy-with-retry.test-helpers.mjs';
import { runScript } from './deploy-with-retry.run-script.mjs';

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
