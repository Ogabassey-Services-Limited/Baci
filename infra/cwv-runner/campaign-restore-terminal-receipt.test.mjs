import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(
  new URL('./campaign-restore-terminal-receipt.sh', import.meta.url),
  'utf8'
);
const capture = 'a'.repeat(64);
const invoke = (candidate) =>
  spawnSync(
    '/bin/sh',
    [
      '-c',
      `capture_sha='${capture}'\n${source}\nvalid_deferred_terminal "$1"`,
      '--',
      candidate,
    ],
    { encoding: 'utf8' }
  );

test('accepts a canonical pre-seal retry terminal only for its captured campaign', () => {
  const candidate = JSON.stringify({
    captureSha256: capture,
    disposition: 'retry-block',
    schemaVersion: 1,
  });
  assert.equal(invoke(candidate).status, 0);
});

test('rejects a mismatched or widened pre-seal retry terminal', () => {
  for (const candidate of [
    JSON.stringify({
      captureSha256: 'b'.repeat(64),
      disposition: 'retry-block',
      schemaVersion: 1,
    }),
    JSON.stringify({
      captureSha256: capture,
      disposition: 'retry-block',
      schemaVersion: 1,
      widened: true,
    }),
  ])
    assert.notEqual(invoke(candidate).status, 0);
});
