import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const sha = 'a'.repeat(64);

async function writeTool(file, body) {
  await fs.writeFile(file, `#!/bin/sh\nset -eu\n${body}\n`);
  await fs.chmod(file, 0o755);
}

test('real restore defers lease release until the external terminal handoff', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cwv-real-defer-'));
  const sourceDirectory = path.join(root, 'source');
  const fixed = path.join(root, 'fixed');
  const stateRoot = path.join(root, 'campaigns');
  const directory = path.join(stateRoot, 'tx');
  const log = path.join(root, 'systemctl.log');
  const terminal = JSON.stringify({
    captureSha256: sha,
    disposition: 'retry-block',
    schemaVersion: 1,
  });
  const environment = [
    'TRANSACTION_ID=tx',
    'MODE=registration',
    `CAPTURE_SHA=${sha}`,
    `SOURCE_DIGEST=${sha}`,
    'ONE=1',
    'TWO=2',
    'THREE=3',
  ].join('\n');
  try {
    await fs.mkdir(path.join(root, 'sealed'), { recursive: true });
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    await fs.mkdir(sourceDirectory);
    await fs.mkdir(fixed);
    await Promise.all(
      [
        'campaign-restore-post-commit.sh',
        'campaign-restore-terminal-receipt.sh',
        'policy.json',
      ].map(async (name) =>
        fs.copyFile(
          new URL(`./${name}`, import.meta.url),
          path.join(sourceDirectory, name)
        )
      )
    );
    await fs.writeFile(
      path.join(sourceDirectory, 'campaign-restore-post-commit.sh'),
      (
        await fs.readFile(
          new URL('./campaign-restore-post-commit.sh', import.meta.url),
          'utf8'
        )
      )
        .replaceAll('/usr/bin/stat', '$FIXED/stat')
        .replaceAll('/usr/bin/sync', '$FIXED/sync')
        .replaceAll('/bin/mv -T', '$FIXED/mv')
        .replaceAll('/bin/sleep', '$FIXED/sleep')
        .replaceAll('/bin/systemctl', '$FIXED/systemctl')
    );
    await fs.writeFile(path.join(root, 'sealed', 'policy.sha256'), `${sha}\n`);
    await fs.writeFile(
      path.join(directory, 'capture.json'),
      JSON.stringify({
        mode: 'registration',
        priorState: {
          cron: {
            archivePath: path.join(directory, 'crontab.before'),
            archiveSha256: sha,
            serviceActive: false,
            serviceEnabled: false,
            sha256: sha,
          },
          network: { ipForward: '0' },
          resources: { containers: [], runners: [], slices: [], timers: [] },
        },
      })
    );
    await fs.writeFile(path.join(directory, 'crontab.before'), '# baseline\n');
    await fs.writeFile(
      path.join(directory, 'watchdog.env'),
      `${environment}\n`
    );
    await fs.writeFile(
      path.join(directory, 'lease-holder.json'),
      JSON.stringify({
        captureSha256: sha,
        holderPid: 2,
        holderStartTime: 2,
        lockDevice: 1,
        lockHeld: true,
        lockInode: 2,
        mode: 'registration',
        schemaVersion: 1,
        token: 'c'.repeat(64),
        transactionId: 'tx',
      })
    );
    await Promise.all([
      fs.chmod(path.join(directory, 'watchdog.env'), 0o600),
      fs.chmod(path.join(directory, 'lease-holder.json'), 0o600),
    ]);
    await writeTool(
      path.join(fixed, 'node'),
      `case "${'$'}*" in *--input-type=module*) printf '%s' '{"phase":null}' ;;
      *campaign-state.mjs*) case "${'$'}2" in verify-capture) printf registration ;; phase) : ;; *) exit 1 ;; esac ;;
      *campaign-source-closure.mjs*) printf '${sha}' ;;
      *policy.schema.mjs*) case "${'$'}3" in */dockerSocket|*/containerdSocket) printf '%s' '${root}/missing.sock' ;; */networkName) printf baci ;; */bridgeName) printf br-baci ;; */dockerService) printf docker.service ;; */containerdService) printf containerd.service ;; */family) printf inet ;; */table) printf baci ;; */adminAccount) printf baci ;; */ownedInputChainPrefix) printf input- ;; */ownedForwardChainPrefix) printf forward- ;; */ruleCommentPrefix) printf baci- ;; *) exit 1 ;; esac ;;
      *) exit 1 ;; esac`
    );
    await writeTool(
      path.join(fixed, 'stat'),
      `last=''; for value in "${'$'}@"; do last="${'$'}value"; done
      case "${'$'}last" in '${stateRoot}'|'${directory}') printf '0:700\\n' ;; *) printf '0:600\\n' ;; esac`
    );
    await writeTool(
      path.join(fixed, 'sha256sum'),
      `printf '${sha}  %s\\n' "${'$'}{1:--}"`
    );
    await writeTool(path.join(fixed, 'sync'), ':');
    await writeTool(path.join(fixed, 'flock'), ':');
    await writeTool(path.join(fixed, 'id'), 'printf 0');
    await writeTool(
      path.join(fixed, 'mv'),
      `[ "\${1:-}" = -T ] && shift; exec /bin/mv "$@"`
    );
    await writeTool(
      path.join(fixed, 'sleep'),
      `rm -f '${path.join(directory, 'lease-holder.json')}'`
    );
    await writeTool(
      path.join(fixed, 'systemctl'),
      `printf '%s\\n' "${'$'}*" >>'${log}'
      case "${'$'}1" in show) case "${'$'}*" in *MainPID*) printf 0 ;; esac ;; is-active|is-enabled) exit 1 ;; esac`
    );
    await writeTool(path.join(fixed, 'docker'), 'exit 1');
    await writeTool(path.join(fixed, 'nft'), 'exit 1');
    await writeTool(path.join(fixed, 'iptables-save'), ':');
    await writeTool(path.join(fixed, 'ip'), 'exit 1');
    await writeTool(
      path.join(fixed, 'crontab'),
      'case "$*" in *" -l") printf "# baseline\\n" ;; esac'
    );
    await fs.writeFile(path.join(fixed, 'ip-forward'), '0\n');
    const executable = (
      await fs.readFile(
        new URL('./campaign-restore.sh', import.meta.url),
        'utf8'
      )
    )
      .replace(
        'readonly STATE_ROOT=/srv/baci-cwv/campaigns',
        `readonly STATE_ROOT='${stateRoot}'`
      )
      .replace('umask 077', `umask 077\nFIXED='${fixed}'`)
      .replaceAll('/usr/bin/node', '$FIXED/node')
      .replaceAll('/usr/bin/stat', '$FIXED/stat')
      .replaceAll('/usr/bin/sha256sum', '$FIXED/sha256sum')
      .replaceAll('/usr/bin/sync', '$FIXED/sync')
      .replaceAll('/usr/bin/flock', '$FIXED/flock')
      .replaceAll('/usr/bin/id', '$FIXED/id')
      .replaceAll('/bin/mv -T', '$FIXED/mv')
      .replaceAll('/bin/sleep', '$FIXED/sleep')
      .replaceAll('/bin/systemctl', '$FIXED/systemctl')
      .replaceAll('/usr/bin/docker', '$FIXED/docker')
      .replaceAll('/usr/sbin/nft', '$FIXED/nft')
      .replaceAll('/usr/sbin/iptables-save', '$FIXED/iptables-save')
      .replaceAll('/usr/sbin/ip', '$FIXED/ip')
      .replaceAll('/usr/bin/crontab', '$FIXED/crontab')
      .replaceAll(
        '/bin/cat /proc/sys/net/ipv4/ip_forward',
        '/bin/cat "$FIXED/ip-forward"'
      );
    const restore = path.join(sourceDirectory, 'campaign-restore.sh');
    await fs.writeFile(restore, executable);
    await fs.chmod(restore, 0o755);
    const defer = spawnSync(
      '/bin/sh',
      [restore, 'tx', sha, '--defer-lease-release', terminal],
      { encoding: 'utf8' }
    );
    assert.equal(defer.status, 0, `${defer.stdout}\n${defer.stderr}`);
    const firstReceipt = JSON.parse(
      await fs.readFile(path.join(directory, 'restored.json'))
    );
    assert.equal(firstReceipt.reconciled, true);
    assert.deepEqual(firstReceipt.registrationTerminal, JSON.parse(terminal));
    await assert.doesNotReject(fs.access(path.join(directory, 'watchdog.env')));
    await assert.doesNotReject(
      fs.access(path.join(directory, 'lease-holder.json'))
    );
    assert.doesNotMatch(await fs.readFile(log, 'utf8'), /campaign-watchdog/);

    const release = spawnSync(
      '/bin/sh',
      [restore, 'tx', sha, '--release-lease'],
      { encoding: 'utf8' }
    );
    assert.equal(release.status, 0, `${release.stdout}\n${release.stderr}`);
    await assert.doesNotReject(
      fs.access(path.join(directory, 'restored.json'))
    );
    await assert.rejects(fs.access(path.join(directory, 'watchdog.env')));
    await assert.rejects(fs.access(path.join(directory, 'lease-holder.json')));
    assert.match(
      await fs.readFile(log, 'utf8'),
      /disable --now baci-cwv-campaign-watchdog@tx\.service/
    );
  } finally {
    await fs.rm(root, { force: true, recursive: true });
  }
});
