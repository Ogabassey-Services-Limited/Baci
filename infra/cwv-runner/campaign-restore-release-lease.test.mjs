import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const source = await fs.readFile(
  new URL('./campaign-restore.sh', import.meta.url),
  'utf8'
);
const sha = 'a'.repeat(64);
const extract = (start, end) =>
  source.slice(
    source.indexOf(start),
    source.indexOf(end, source.indexOf(start))
  );
const restored = JSON.stringify({
  captureSha256: sha,
  mode: 'registration',
  policyFileSha256: sha,
  progress: {},
  reconciled: true,
  registrationTerminal: {
    captureSha256: sha,
    disposition: 'retry-block',
    schemaVersion: 1,
  },
  residualState: {
    accountingTablePresent: false,
    cronSha256: sha,
    dedicatedNetworkPresent: false,
    dedicatedServicesActive: false,
    ownedFirewallPresent: false,
    samplerActive: false,
    transactionContainerCount: 0,
  },
  schemaVersion: 1,
  sourceDigest: sha,
});

async function runReleaseBranch() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cwv-release-branch-'));
  const directory = path.join(root, 'tx');
  const runner = path.join(root, 'release.sh');
  const calls = path.join(root, 'calls');
  await fs.mkdir(directory);
  await fs.writeFile(path.join(directory, 'restored.json'), restored);
  const branch = extract(
    `if [ "\${terminal_action:-restore}" = --release-lease ]; then`,
    `if [ "\${restored_already:-false}" = true ]; then`
  ).replaceAll(
    '/usr/bin/stat -c \'%u:%a\' -- "$directory/restored.json"',
    "printf '0:600\\n'"
  );
  await fs.writeFile(
    runner,
    [
      '#!/bin/sh',
      'set -eu',
      `directory='${directory}'`,
      'transaction_id=tx mode=registration terminal_action=--release-lease',
      'reconciled_retry=false',
      `capture_sha='${sha}' policy_file_sha='${sha}' source_digest='${sha}'`,
      'valid_deferred_terminal() { return 0; }',
      `post_commit_cleanup() { printf '%s\\n' "$*" >'${calls}'; }`,
      branch,
    ].join('\n')
  );
  const result = spawnSync('/bin/sh', [runner], { encoding: 'utf8' });
  const invoked = await fs.readFile(calls, 'utf8').catch(() => '');
  await fs.rm(root, { force: true, recursive: true });
  return { invoked, result };
}

test('external terminal release invokes retryable cleanup with watchdog-stop authority', async () => {
  const { invoked, result } = await runReleaseBranch();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(invoked, '--stop-watchdog\n');
});

test('terminal cleanup retry recovers source digest after watchdog environment removal', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cwv-release-digest-'));
  const directory = path.join(root, 'tx');
  const runner = path.join(root, 'digest.sh');
  await fs.mkdir(directory);
  await fs.writeFile(
    path.join(directory, 'restore-post-commit-failed.json'),
    JSON.stringify({ sourceDigest: sha })
  );
  const resolution = extract(
    'environment_file="$directory/watchdog.env"',
    'actual_source_digest='
  ).replaceAll('/usr/bin/stat', "printf '0:600\\n'; :");
  await fs.writeFile(
    runner,
    `#!/bin/sh\nset -eu\ndirectory='${directory}'\nterminal_action=--release-lease\nreconciled_retry=false\n${resolution}\n[ "$source_digest" = '${sha}' ]`
  );
  const result = spawnSync('/bin/sh', [runner], { encoding: 'utf8' });
  await fs.rm(root, { force: true, recursive: true });
  assert.equal(result.status, 0, result.stderr);
});
