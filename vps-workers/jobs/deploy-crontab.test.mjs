import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const workerRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('deploy crontab', () => {
  it('schedules the agentic commerce health cron through run-web-cron', () => {
    const deployScript = readFileSync(join(workerRoot, 'deploy.sh'), 'utf8');

    assert.match(
      deployScript,
      /\*\/15 \* \* \* \* flock -n \$REMOTE_DIR\/locks\/agentic-commerce-health\.lock/
    );
    assert.match(
      deployScript,
      /\$NODE_BIN \$REMOTE_DIR\/jobs\/run-web-cron\.mjs \/api\/cron\/agentic-commerce-health/
    );
    assert.match(
      deployScript,
      />> \$REMOTE_DIR\/logs\/agentic-commerce-health\.log 2>&1/
    );
  });
});
