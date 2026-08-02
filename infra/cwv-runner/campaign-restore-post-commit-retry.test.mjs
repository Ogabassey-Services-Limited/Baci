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
const postCommitSource = await fs.readFile(
  new URL('./campaign-restore-post-commit.sh', import.meta.url),
  'utf8'
);
const extract = (content, start, end) => {
  const from = content.indexOf(start);
  const to = content.indexOf(end, from);
  assert.ok(from >= 0 && to > from, `missing ${start}..${end}`);
  return content.slice(from, to);
};
const fileExists = (file) =>
  fs
    .access(file)
    .then(() => true)
    .catch(() => false);
const sha = 'a'.repeat(64);
const marker = (cleanup) =>
  JSON.stringify({
    captureSha256: sha,
    cleanup,
    mode: 'registration',
    policyFileSha256: sha,
    reconciled: true,
    schemaVersion: 1,
    sourceDigest: sha,
  });
const lease = JSON.stringify({
  captureSha256: sha,
  holderPid: 999999,
  holderStartTime: 123,
  lockDevice: 1,
  lockHeld: true,
  lockInode: 2,
  mode: 'registration',
  schemaVersion: 1,
  token: 'c'.repeat(64),
  transactionId: 'tx',
});
async function releaseLease({
  cooperative,
  holderPresent = false,
  staleRelease = false,
}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cwv-lease-release-'));
  const directory = path.join(root, 'tx');
  const holder = path.join(root, 'holder');
  const signalLog = path.join(root, 'signals');
  const kill = path.join(root, 'kill');
  const stat = path.join(root, 'stat');
  const sleep = path.join(root, 'sleep');
  const sync = path.join(root, 'sync');
  const runner = path.join(root, 'release.sh');
  const leaseFile = path.join(directory, 'lease-holder.json');
  const releaseFile = path.join(directory, 'lease-release.json');
  const releaseSnapshot = path.join(root, 'lease-release.snapshot');
  try {
    await fs.mkdir(directory, { mode: 0o700 });
    await fs.writeFile(leaseFile, lease);
    await fs.chmod(leaseFile, 0o600);
    if (staleRelease) {
      await fs.writeFile(
        releaseFile,
        staleRelease === 'malformed'
          ? '{}'
          : JSON.stringify({
              schemaVersion: 1,
              token: 'c'.repeat(64),
              transactionId: 'tx',
            })
      );
      await fs.chmod(releaseFile, 0o600);
      await fs.rm(leaseFile);
    }
    if (holderPresent) {
      await fs.mkdir(holder);
      await fs.writeFile(
        path.join(holder, 'stat'),
        '999999 (holder) S 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 123\n'
      );
    }
    await writeExecutable(kill, `printf '%s\\n' "$*" >>'${signalLog}'`);
    await writeExecutable(stat, "printf '0:600\\n'");
    await writeExecutable(sync, ':');
    await writeExecutable(
      sleep,
      cooperative
        ? `cp '${releaseFile}' '${releaseSnapshot}'\nrm -f '${leaseFile}'`
        : ':'
    );
    const release = extract(
      postCommitSource,
      'release_lease_holder() {',
      'post_commit_cleanup() {'
    )
      .replaceAll('/usr/bin/stat', `/bin/sh ${stat}`)
      .replaceAll('/usr/bin/sync', `/bin/sh ${sync}`)
      .replaceAll('/bin/sleep', `/bin/sh ${sleep}`)
      .replaceAll('/bin/kill', `/bin/sh ${kill}`)
      .replaceAll('"/proc/$holder_pid/stat"', `"${holder}/stat"`)
      .replaceAll('"/proc/$holder_pid"', `"${holder}"`)
      .replaceAll('/bin/mv -T', '/bin/mv');
    await fs.writeFile(
      runner,
      `#!/bin/sh\nset -eu\ndirectory='${directory}'\ntransaction_id=tx\nmode=registration\ncapture_sha='${sha}'\n${release}\nrelease_lease_holder`
    );
    await fs.chmod(runner, 0o755);
    return {
      result: spawnSync('/bin/sh', [runner], { encoding: 'utf8' }),
      receiptPresent: await fileExists(leaseFile),
      release: await fs.readFile(releaseSnapshot, 'utf8').catch(() => ''),
      signals: await fs.readFile(signalLog, 'utf8').catch(() => ''),
      staleReleasePresent: await fileExists(releaseFile),
    };
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

async function writeExecutable(file, body) {
  await fs.writeFile(file, `#!/bin/sh\nset -eu\n${body}\n`);
  await fs.chmod(file, 0o755);
}

async function scenario(failure, watchdogAction = '') {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cwv-post-commit-'));
  const directory = path.join(root, 'tx');
  const systemctl = path.join(root, 'systemctl');
  const systemctlLog = path.join(root, 'systemctl.log');
  const remove = path.join(root, 'rm');
  const sync = path.join(root, 'sync');
  const sleep = path.join(root, 'sleep');
  const stat = path.join(root, 'stat');
  const runner = path.join(root, 'retry.sh');
  const flag = path.join(root, 'fail-once');
  const environment = path.join(directory, 'watchdog.env');
  await fs.mkdir(directory, { mode: 0o700 });
  await fs.writeFile(environment, 'receipt-bound\n');
  await fs.writeFile(
    path.join(directory, 'restore-post-commit-failed.json'),
    marker({
      environmentRemoved: false,
      leaseHolderReleased: false,
      receiptCleared: false,
      watchdogDisabled: false,
    })
  );
  await fs.chmod(
    path.join(directory, 'restore-post-commit-failed.json'),
    0o600
  );
  await fs.writeFile(
    path.join(directory, 'lease-holder.json'),
    failure === 'lease' ? '{}' : lease
  );
  await fs.chmod(path.join(directory, 'lease-holder.json'), 0o600);
  await fs.writeFile(flag, '1');
  await writeExecutable(
    systemctl,
    failure === 'watchdog'
      ? `printf '%s\\n' "$*" >>'${systemctlLog}'\nif [ "$1" = disable ] && [ -e '${flag}' ]; then /bin/rm '${flag}'; exit 1; fi\nexit 0`
      : `printf '%s\\n' "$*" >>'${systemctlLog}'`
  );
  await writeExecutable(
    remove,
    failure === 'environment'
      ? `if [ "${'$'}3" = '${environment}' ] && [ -e '${flag}' ]; then /bin/rm '${flag}'; exit 1; fi\nexec /bin/rm "${'$'}@"`
      : 'exec /bin/rm "$@"'
  );
  await writeExecutable(stat, "printf '0:600\\n'");
  await writeExecutable(sync, ':');
  await writeExecutable(
    sleep,
    `rm -f '${path.join(directory, 'lease-holder.json')}'`
  );
  const functions = postCommitSource
    .replaceAll('/bin/systemctl', `/bin/sh ${systemctl}`)
    .replaceAll('/bin/rm', `/bin/sh ${remove}`)
    .replaceAll('/usr/bin/stat', `/bin/sh ${stat}`)
    .replaceAll('/usr/bin/sync', `/bin/sh ${sync}`)
    .replaceAll('/bin/sleep', `/bin/sh ${sleep}`)
    .replaceAll('/bin/mv -T', '/bin/mv');
  const script = [
    '#!/bin/sh',
    'set -eu',
    `directory='${directory}'`,
    "transaction_id='tx'",
    "mode='registration'",
    `capture_sha='${sha}'`,
    `policy_file_sha='${sha}'`,
    `source_digest='${sha}'`,
    `environment_file='${environment}'`,
    'reconciled_retry=true',
    functions,
    `retry_reconciled_cleanup ${watchdogAction}`,
  ].join('\n');
  await fs.writeFile(runner, script);
  await fs.chmod(runner, 0o755);

  const first = spawnSync('/bin/sh', [runner], { encoding: 'utf8' });
  assert.equal(first.status, 1, `${first.stdout}\n${first.stderr}`);
  const failureReceipt = path.join(
    directory,
    'restore-post-commit-failed.json'
  );
  assert.equal(
    await fs.access(failureReceipt).then(
      () => true,
      () => false
    ),
    true,
    first.stderr
  );
  assert.equal(JSON.parse(await fs.readFile(failureReceipt)).reconciled, true);
  if (failure === 'lease') {
    await fs.writeFile(path.join(directory, 'lease-holder.json'), lease);
    await fs.chmod(path.join(directory, 'lease-holder.json'), 0o600);
  }
  const second = spawnSync('/bin/sh', [runner], { encoding: 'utf8' });
  assert.equal(second.status, 0, `${second.stdout}\n${second.stderr}`);
  await assert.rejects(
    fs.readFile(path.join(directory, 'restore-post-commit-failed.json'))
  );
  await assert.rejects(fs.readFile(environment));
  const systemctlCalls = await fs.readFile(systemctlLog, 'utf8');
  if (watchdogAction) assert.match(systemctlCalls, /disable --now /);
  else assert.doesNotMatch(systemctlCalls, /--now/);
}

for (const failure of ['lease', 'watchdog', 'environment'])
  test(`retries a transient ${failure} post-commit cleanup failure`, () =>
    scenario(failure));

test('external terminal retry stops and disables the watchdog', () =>
  scenario('watchdog', '--stop-watchdog'));

test('a reconciled receipt without a post-commit failure remains terminal', () => {
  assert.match(
    source,
    /\[ -e "\$directory\/restore-post-commit-failed\.json" \] \|\| \{[^}]*exit 73;/
  );
});

test('waits for cooperative lease receipt removal before any signal fallback', async () => {
  const { release, result, receiptPresent } = await releaseLease({
    cooperative: true,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(receiptPresent, false);
  assert.deepEqual(JSON.parse(release), {
    schemaVersion: 1,
    token: 'c'.repeat(64),
    transactionId: 'tx',
  });
  assert.match(
    postCommitSource,
    />"\$temporary" && \/bin\/chmod 0600 "\$temporary" && \/usr\/bin\/sync -f "\$temporary" && \/bin\/mv -T "\$temporary" "\$directory\/lease-release\.json" && \/usr\/bin\/sync -f "\$directory" \|\| return 1/
  );
  assert.doesNotMatch(result.stderr, /kill/);
});

test('fails closed when a stale lease receipt remains after the bounded wait', async () => {
  const { result } = await releaseLease({ cooperative: false });
  assert.equal(result.status, 1, result.stderr);
});

test('does not signal a reused lease-holder PID after cooperative release times out', async () => {
  const { result, signals } = await releaseLease({
    cooperative: false,
    holderPresent: true,
  });
  assert.equal(result.status, 1, result.stderr);
  assert.equal(signals, '');
});

test('removes an exact stale release request after its lease holder has exited', async () => {
  const malformed = await releaseLease({
    cooperative: false,
    staleRelease: 'malformed',
  });
  assert.equal(malformed.result.status, 1, malformed.result.stderr);
  assert.equal(malformed.staleReleasePresent, true);
  const { result, staleReleasePresent } = await releaseLease({
    cooperative: false,
    staleRelease: true,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(staleReleasePresent, false);
});
