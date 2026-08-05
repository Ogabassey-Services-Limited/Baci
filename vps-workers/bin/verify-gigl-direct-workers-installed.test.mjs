import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url));
const verifier = join(directory, 'verify-gigl-direct-workers-installed.sh');
const temporaryDirectories = [];

afterEach(() => {
  for (const path of temporaryDirectories.splice(0)) {
    rmSync(path, { force: true, recursive: true });
  }
});

function fixture({
  duplicateTracking = false,
  includeNotifications = true,
  staleNotificationCommand = false,
  staleTrackingCommand = false,
} = {}) {
  const root = mkdtempSync(join(tmpdir(), 'baci-gigl-readiness-'));
  temporaryDirectories.push(root);
  const remote = join(root, 'workers');
  const fakeBin = join(root, 'bin');
  const crontab = join(root, 'crontab');
  mkdirSync(join(remote, 'bin'), { recursive: true });
  mkdirSync(fakeBin, { recursive: true });

  for (const wrapper of [
    'process-gigl-tracking.sh',
    'process-gigl-tracking-notifications.sh',
  ]) {
    const path = join(remote, 'bin', wrapper);
    writeFileSync(path, '#!/usr/bin/env bash\nexit 0\n');
    chmodSync(path, 0o755);
  }

  const trackingCommand = staleTrackingCommand
    ? `${remote}/bin/process-gigl-tracking.sh`
    : `flock -n ${remote}/locks/gigl-tracking.lock bash -lc 'export NODE_ENV=production && export BACI_WORKER_PROFILE=gigl-tracking && cd ${remote} && timeout --signal=TERM --kill-after=30s 2m ${remote}/bin/process-gigl-tracking.sh'`;
  const lines = [
    `*/5 * * * * ${trackingCommand} >> ${remote}/logs/gigl-tracking.log 2>&1`,
  ];
  if (duplicateTracking) {
    lines.push(
      `0 * * * * ${remote}/bin/process-gigl-tracking.sh >> ${remote}/logs/extra-gigl.log 2>&1`
    );
  }
  if (includeNotifications) {
    const notificationCommand = staleNotificationCommand
      ? `${remote}/bin/process-gigl-tracking-notifications.sh`
      : `flock -n ${remote}/locks/gigl-tracking-notifications.lock bash -lc 'export NODE_ENV=production && export BACI_WORKER_PROFILE=gigl-tracking-notifications && cd ${remote} && timeout --signal=TERM --kill-after=30s 2m ${remote}/bin/process-gigl-tracking-notifications.sh'`;
    lines.push(
      `*/10 * * * * ${notificationCommand} >> ${remote}/logs/gigl-tracking-notifications.log 2>&1`
    );
  }
  writeFileSync(crontab, `${lines.join('\n')}\n`);

  const fakeCrontab = join(fakeBin, 'crontab');
  writeFileSync(fakeCrontab, '#!/usr/bin/env bash\ncat "$FAKE_CRONTAB"\n');
  chmodSync(fakeCrontab, 0o755);
  return { crontab, fakeBin, remote };
}

function verify(options) {
  const { crontab, fakeBin, remote } = fixture(options);
  return spawnSync('bash', [verifier], {
    encoding: 'utf8',
    env: {
      ...process.env,
      FAKE_CRONTAB: crontab,
      PATH: `${fakeBin}:${process.env.PATH}`,
      VPS_WORKER_REMOTE_DIR: remote,
    },
  });
}

describe('GIGL direct-worker deployment gate', () => {
  it('accepts exactly one installed schedule for each direct worker', () => {
    const result = verify();

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /GIGL direct workers are installed/);
  });

  it('blocks deployment when the notification schedule is absent', () => {
    const result = verify({ includeNotifications: false });

    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /tracking 1 total\/1 canonical and notifications 0 total\/0 canonical/
    );
  });

  it('blocks deployment when a direct-worker schedule is duplicated', () => {
    const result = verify({ duplicateTracking: true });

    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /tracking 2 total\/1 canonical and notifications 1 total\/1 canonical/
    );
  });

  it('blocks deployment when the tracking command omits its production runtime contract', () => {
    const result = verify({ staleTrackingCommand: true });

    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /tracking 1 total\/0 canonical and notifications 1 total\/1 canonical/
    );
  });

  it('blocks deployment when the notification command omits its production runtime contract', () => {
    const result = verify({ staleNotificationCommand: true });

    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /tracking 1 total\/1 canonical and notifications 1 total\/0 canonical/
    );
  });
});
