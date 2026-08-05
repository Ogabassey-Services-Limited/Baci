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
});
