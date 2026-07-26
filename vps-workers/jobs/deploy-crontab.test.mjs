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

  it('schedules the gateway paid-order reconcile drain hourly through run-web-cron', () => {
    const deployScript = readFileSync(join(workerRoot, 'deploy.sh'), 'utf8');

    assert.match(
      deployScript,
      /20 \*\s+\* \* \* flock -n \$REMOTE_DIR\/locks\/reconcile-gateway-paid-orders\.lock/
    );
    assert.match(
      deployScript,
      /\$NODE_BIN \$REMOTE_DIR\/jobs\/run-web-cron\.mjs \/api\/cron\/reconcile-gateway-paid-orders/
    );
    assert.match(
      deployScript,
      />> \$REMOTE_DIR\/logs\/reconcile-gateway-paid-orders\.log 2>&1/
    );
  });

  it('schedules the order notification outbox cron through run-web-cron', () => {
    const deployScript = readFileSync(join(workerRoot, 'deploy.sh'), 'utf8');

    assert.match(
      deployScript,
      /\*\/5 \* \* \* \* flock -n \$REMOTE_DIR\/locks\/order-notifications\.lock/
    );
    assert.match(
      deployScript,
      /\$NODE_BIN \$REMOTE_DIR\/jobs\/run-web-cron\.mjs \/api\/cron\/order-notifications\?batchSize=5/
    );
    assert.match(
      deployScript,
      />> \$REMOTE_DIR\/logs\/order-notifications\.log 2>&1/
    );
  });

  it('schedules the agentic commerce health cron through run-web-cron', () => {
    const deployScript = readFileSync(join(workerRoot, 'deploy.sh'), 'utf8');

    assert.match(
      deployScript,
      /\*\/15 \* \* \* \* flock -n \$REMOTE_DIR\/locks\/ollama-workload\.lock flock -n \$REMOTE_DIR\/locks\/agentic-commerce-health\.lock/
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

  it('schedules the merchant signup policy health check every five minutes', () => {
    const deployScript = readFileSync(join(workerRoot, 'deploy.sh'), 'utf8');

    assert.match(
      deployScript,
      /\*\/5 \*\s+\* \* \* flock -n \$REMOTE_DIR\/locks\/merchant-signup-health\.lock/
    );
    assert.match(
      deployScript,
      /\$NODE_BIN \$REMOTE_DIR\/jobs\/run-web-cron\.mjs \/api\/cron\/merchant-signup-health/
    );
    assert.match(
      deployScript,
      />> \$REMOTE_DIR\/logs\/merchant-signup-health\.log 2>&1/
    );
  });

  it('schedules the storefront update nudge daily through run-web-cron', () => {
    const deployScript = readFileSync(join(workerRoot, 'deploy.sh'), 'utf8');

    assert.match(
      deployScript,
      /0 10 {3}\* \* \* flock -n \$REMOTE_DIR\/locks\/storefront-update-nudge\.lock/
    );
    assert.match(
      deployScript,
      /\$NODE_BIN \$REMOTE_DIR\/jobs\/run-web-cron\.mjs \/api\/cron\/storefront-update-nudge/
    );
    assert.match(
      deployScript,
      />> \$REMOTE_DIR\/logs\/storefront-update-nudge\.log 2>&1/
    );
  });

  it('schedules the Petrock catalog sync nightly through run-web-cron', () => {
    const deployScript = readFileSync(join(workerRoot, 'deploy.sh'), 'utf8');

    assert.match(
      deployScript,
      /15 2\s+\* \* \* flock -n \$REMOTE_DIR\/locks\/sync-petrock-catalog\.lock/
    );
    assert.match(
      deployScript,
      /run-web-cron\.mjs \/api\/cron\/sync-petrock-catalog/
    );
  });

  it('schedules Petrock reconciliation every minute through run-web-cron', () => {
    const deployScript = readFileSync(join(workerRoot, 'deploy.sh'), 'utf8');

    assert.match(
      deployScript,
      /\* \*\s+\* \* \* flock -n \$REMOTE_DIR\/locks\/petrock-reconcile\.lock/
    );
    assert.match(
      deployScript,
      /run-web-cron\.mjs \/api\/cron\/petrock-reconcile/
    );
  });

  it('schedules the iOS live-build sync daily backstop through run-web-cron', () => {
    const deployScript = readFileSync(join(workerRoot, 'deploy.sh'), 'utf8');

    assert.match(
      deployScript,
      /30 9\s+\* \* \* flock -n \$REMOTE_DIR\/locks\/ios-live-build-sync\.lock/
    );
    assert.match(
      deployScript,
      /\$NODE_BIN \$REMOTE_DIR\/jobs\/run-web-cron\.mjs \/api\/cron\/ios-live-build-sync/
    );
    assert.match(
      deployScript,
      />> \$REMOTE_DIR\/logs\/ios-live-build-sync\.log 2>&1/
    );
  });

  it('schedules the Android live-build sync daily backstop through run-web-cron', () => {
    const deployScript = readFileSync(join(workerRoot, 'deploy.sh'), 'utf8');
    const androidCronLine = deployScript
      .split('\n')
      .find((line) => line.includes('/api/cron/android-live-build-sync'));

    assert.ok(androidCronLine);
    assert.match(
      androidCronLine,
      /^45 9\s+\* \* \* flock -n \$REMOTE_DIR\/locks\/android-live-build-sync\.lock bash -lc 'cd \$REMOTE_DIR && \$NODE_BIN \$REMOTE_DIR\/jobs\/run-web-cron\.mjs \/api\/cron\/android-live-build-sync' >> \$REMOTE_DIR\/logs\/android-live-build-sync\.log 2>&1$/
    );
  });

  it('refreshes the GIGL service-centre directory outside checkout', () => {
    const deployScript = readFileSync(join(workerRoot, 'deploy.sh'), 'utf8');

    assert.match(
      deployScript,
      /15 4\s+\* \* \* flock -n \$REMOTE_DIR\/locks\/sync-gigl-service-centres\.lock/
    );
    assert.match(
      deployScript,
      /\$NODE_BIN \$REMOTE_DIR\/jobs\/sync-gigl-service-centres\.mjs/
    );
    assert.match(deployScript, /GIGL_BASE_URL=\.\.\./);
    assert.match(deployScript, /GIGL_EMAIL=\.\.\./);
    assert.match(deployScript, /GIGL_PASSWORD=\.\.\./);
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

  it('keeps import job processing as an hourly fallback sweep', () => {
    const deployScript = readFileSync(join(workerRoot, 'deploy.sh'), 'utf8');

    assert.match(
      deployScript,
      /17\s+\*\s+\*\s+\*\s+\* flock -n \$REMOTE_DIR\/locks\/process-import-jobs\.lock/
    );
    assert.match(deployScript, /\$REMOTE_DIR\/bin\/process-import-jobs\.sh/);
    assert.doesNotMatch(
      deployScript,
      /2-59\/5 \* \* \* \* flock -n \$REMOTE_DIR\/locks\/process-import-jobs\.lock/
    );
  });

  it('installs event workers and one-minute flock-guarded recovery sweeps', () => {
    const deployScript = readFileSync(join(workerRoot, 'deploy.sh'), 'utf8');

    assert.match(deployScript, /install-event-pipeline-services\.sh/);
    assert.match(
      deployScript,
      /^\* \* \* \* \* flock -n \$REMOTE_DIR\/locks\/process-domain-events\.lock bash -lc 'export NODE_ENV=production && export BACI_WORKER_PROFILE=event-pipeline && cd \$REMOTE_DIR && \$REMOTE_DIR\/bin\/process-domain-events\.sh --once' >> \$REMOTE_DIR\/logs\/process-domain-events\.log 2>&1$/m
    );
    assert.match(
      deployScript,
      /^\* \* \* \* \* flock -n \$REMOTE_DIR\/locks\/process-event-deliveries\.lock bash -lc 'export NODE_ENV=production && export BACI_WORKER_PROFILE=event-pipeline && cd \$REMOTE_DIR && \$REMOTE_DIR\/bin\/process-event-deliveries\.sh --once' >> \$REMOTE_DIR\/logs\/process-event-deliveries\.log 2>&1$/m
    );
  });
});
