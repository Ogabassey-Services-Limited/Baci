import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const workerRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('deploy crontab', () => {
  it('uses the resolved Node binary for systemd services', () => {
    const deployScript = readFileSync(join(workerRoot, 'deploy.sh'), 'utf8');
    const nodeResolutionIndex = deployScript.indexOf('NODE_BIN=$(ssh');
    const triggerServiceIndex = deployScript.indexOf(
      'Installing AI storefront trigger user service'
    );

    assert.notEqual(nodeResolutionIndex, -1);
    assert.notEqual(triggerServiceIndex, -1);
    assert.ok(nodeResolutionIndex < triggerServiceIndex);
    assert.doesNotMatch(deployScript, /ExecStart=\/usr\/bin\/node/);
    assert.match(
      deployScript,
      /ExecStart=\$NODE_BIN \$REMOTE_DIR\/jobs\/ai-storefront-trigger-server\.mjs/
    );
  });

  it('schedules the agentic commerce health cron as a direct VPS script', () => {
    const deployScript = readFileSync(join(workerRoot, 'deploy.sh'), 'utf8');

    assert.match(
      deployScript,
      /\*\/15 \* \* \* \* flock -n \$REMOTE_DIR\/locks\/ollama-workload\.lock flock -n \$REMOTE_DIR\/locks\/agentic-commerce-health\.lock/
    );
    assert.match(
      deployScript,
      /export NODE_ENV=production && cd \$REMOTE_DIR && \$REMOTE_DIR\/bin\/agentic-commerce-health\.sh/
    );
    assert.match(
      deployScript,
      />> \$REMOTE_DIR\/logs\/agentic-commerce-health\.log 2>&1/
    );
  });

  it('serializes the AI storefront worker behind the shared workload lock', () => {
    const deployScript = readFileSync(join(workerRoot, 'deploy.sh'), 'utf8');

    assert.match(
      deployScript,
      /\*\/10 \* \* \* \* flock -n \$REMOTE_DIR\/locks\/ollama-workload\.lock flock -n \$REMOTE_DIR\/locks\/ai-storefront-jobs\.lock/
    );
    assert.match(
      deployScript,
      /export NODE_ENV=production && export BACI_WORKER_PROFILE=ai-storefront-jobs/
    );
  });

  it('schedules the Supabase retention cleanup worker', () => {
    const deployScript = readFileSync(join(workerRoot, 'deploy.sh'), 'utf8');

    assert.match(
      deployScript,
      /20 3\s+\* \* \* flock -n \$REMOTE_DIR\/locks\/supabase-retention-cleanup\.lock/
    );
    assert.match(
      deployScript,
      /\$NODE_BIN \$REMOTE_DIR\/jobs\/supabase-retention-cleanup\.mjs/
    );
    assert.match(
      deployScript,
      />> \$REMOTE_DIR\/logs\/supabase-retention-cleanup\.log 2>&1/
    );
  });

  it('schedules hourly cleanup for expired agentic request records', () => {
    const deployScript = readFileSync(join(workerRoot, 'deploy.sh'), 'utf8');

    assert.match(
      deployScript,
      /10\s+\*\s+\*\s+\*\s+\* flock -n \$REMOTE_DIR\/locks\/cleanup-agentic-request-records\.lock/
    );
    assert.match(
      deployScript,
      /\$NODE_BIN \$REMOTE_DIR\/jobs\/cleanup-agentic-request-records\.mjs/
    );
    assert.match(
      deployScript,
      />> \$REMOTE_DIR\/logs\/cleanup-agentic-request-records\.log 2>&1/
    );
  });

  it('schedules abandoned order cleanup as a direct VPS worker', () => {
    const deployScript = readFileSync(join(workerRoot, 'deploy.sh'), 'utf8');

    assert.match(
      deployScript,
      /0 1\s+\* \* \* flock -n \$REMOTE_DIR\/locks\/cleanup-orders\.lock/
    );
    assert.match(
      deployScript,
      /\$NODE_BIN \$REMOTE_DIR\/jobs\/cleanup-orders\.mjs/
    );
    assert.doesNotMatch(
      deployScript,
      /jobs\/run-web-cron\.mjs \/api\/cron\/cleanup-orders/
    );
    assert.match(
      deployScript,
      />> \$REMOTE_DIR\/logs\/cleanup-orders\.log 2>&1/
    );
  });

  it('schedules inventory push alerts as a direct repo-backed VPS script', () => {
    const deployScript = readFileSync(join(workerRoot, 'deploy.sh'), 'utf8');

    assert.match(
      deployScript,
      /0 \*\/6\s+\* \* \* flock -n \$REMOTE_DIR\/locks\/inventory-push-alerts\.lock/
    );
    assert.match(
      deployScript,
      /export NODE_ENV=production && cd \$REMOTE_DIR && \$REMOTE_DIR\/bin\/inventory-push-alerts\.sh/
    );
    assert.doesNotMatch(
      deployScript,
      /jobs\/run-web-cron\.mjs \/api\/inventory\/push-alerts/
    );
    assert.match(
      deployScript,
      />> \$REMOTE_DIR\/logs\/inventory-push-alerts\.log 2>&1/
    );
  });

  it('gates scheduled blog publishing before invoking the web cron', () => {
    const deployScript = readFileSync(join(workerRoot, 'deploy.sh'), 'utf8');

    assert.match(
      deployScript,
      /\*\/15 \* \* \* \* flock -n \$REMOTE_DIR\/locks\/publish-scheduled-posts\.lock/
    );
    assert.match(
      deployScript,
      /\$NODE_BIN \$REMOTE_DIR\/jobs\/publish-scheduled-posts-if-due\.mjs/
    );
    assert.doesNotMatch(
      deployScript,
      /jobs\/run-web-cron\.mjs \/api\/cron\/publish-scheduled-posts/
    );
    assert.match(
      deployScript,
      />> \$REMOTE_DIR\/logs\/publish-scheduled-posts\.log 2>&1/
    );
  });
});
