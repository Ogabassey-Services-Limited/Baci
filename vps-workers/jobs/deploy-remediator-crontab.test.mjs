import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const workerRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('remediation deploy crontab', () => {
  it('serializes Vercel and Sentry remediation behind one global Codex lock', () => {
    const deployScript = readFileSync(join(workerRoot, 'deploy.sh'), 'utf8');

    assert.match(
      deployScript,
      /vercel-error-remediator\.lock flock -n \$REMOTE_DIR\/locks\/error-remediator-global\.lock/
    );
    assert.match(
      deployScript,
      /sentry-mobile-error-remediator\.lock flock -n \$REMOTE_DIR\/locks\/error-remediator-global\.lock/
    );
  });

  it('builds and configures the capability-free Codex container backend', () => {
    const deployScript = readFileSync(join(workerRoot, 'deploy.sh'), 'utf8');

    assert.match(
      deployScript,
      /docker build -f \$STAGING_DIR\/Dockerfile\.codex-remediator -t \$CODEX_REMEDIATOR_IMAGE \$STAGING_DIR/
    );
    assert.equal(
      deployScript.match(
        /export BACI_CODEX_DOCKER_IMAGE=\$CODEX_REMEDIATOR_IMAGE/g
      )?.length,
      2
    );
    assert.match(deployScript, /CODEX_CONTAINER_BIN=.*find/);
    assert.ok(
      deployScript.indexOf('prepare_worker_release') <
        deployScript.indexOf('CODEX_CONTAINER_BIN=$(ssh')
    );
    assert.equal(
      deployScript.match(/BACI_CODEX_CONTAINER_BIN=\$CODEX_CONTAINER_BIN/g)
        ?.length,
      2
    );
  });
});
