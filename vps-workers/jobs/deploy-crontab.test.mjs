import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const workerRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const releaseHelper = readFileSync(
  join(workerRoot, 'lib', 'prepare-worker-release.sh'),
  'utf8'
);

describe('deploy crontab', () => {
  it('uses the resolved Node binary for systemd services', () => {
    const deployScript = readFileSync(join(workerRoot, 'deploy.sh'), 'utf8');
    const releasePreparationIndex = deployScript.indexOf(
      'prepare_worker_release'
    );
    const triggerServiceIndex = deployScript.indexOf(
      'Installing AI storefront trigger user service'
    );

    assert.match(releaseHelper, /NODE_BIN=\$\(ssh/);
    assert.notEqual(releasePreparationIndex, -1);
    assert.notEqual(triggerServiceIndex, -1);
    assert.ok(releasePreparationIndex < triggerServiceIndex);
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

  it('schedules ordered cache invalidation through the bounded Next drainer', () => {
    const deployScript = readFileSync(join(workerRoot, 'deploy.sh'), 'utf8');

    assert.match(
      deployScript,
      /\*\/2 \* \* \* \* flock -n \$REMOTE_DIR\/locks\/cache-invalidations\.lock/
    );
    assert.match(
      deployScript,
      /run-web-cron\.mjs \/api\/cron\/drain-cache-invalidations/
    );
    assert.doesNotMatch(deployScript, /process-storefront-purge-outbox/);
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

  it('schedules Petrock reconciliation directly every minute with its existing lock and log', () => {
    const deployScript = readFileSync(join(workerRoot, 'deploy.sh'), 'utf8');
    const cronLine = deployScript
      .split('\n')
      .find((line) => line.includes('petrock-reconcile.lock'));

    assert.ok(cronLine);
    assert.match(
      cronLine,
      /^\* \*\s+\* \* \* flock -n \$REMOTE_DIR\/locks\/petrock-reconcile\.lock bash -lc 'export NODE_ENV=production && export BACI_WORKER_PROFILE=petrock-reconciliation && cd \$REMOTE_DIR && timeout --signal=TERM --kill-after=30s 5m \$REMOTE_DIR\/bin\/process-petrock-reconciliation\.sh' >> \$REMOTE_DIR\/logs\/petrock-reconcile\.log 2>&1$/
    );
    assert.doesNotMatch(
      cronLine,
      /run-web-cron|\/api\/cron\/petrock-reconcile/
    );
  });

  it('schedules quiz finalization directly every minute with its existing lock and log', () => {
    const deployScript = readFileSync(join(workerRoot, 'deploy.sh'), 'utf8');
    const cronLine = deployScript
      .split('\n')
      .find((line) => line.includes('quiz-finalize.lock'));

    assert.ok(cronLine);
    assert.match(
      cronLine,
      /^\* \* \* \* \* flock -n \$REMOTE_DIR\/locks\/quiz-finalize\.lock bash -lc 'export NODE_ENV=production && export BACI_WORKER_PROFILE=quiz-finalization && cd \$REMOTE_DIR && timeout --signal=TERM --kill-after=30s 5m \$REMOTE_DIR\/bin\/process-quiz-finalization\.sh' >> \$REMOTE_DIR\/logs\/quiz-finalize\.log 2>&1$/
    );
    assert.doesNotMatch(cronLine, /run-web-cron|\/api\/quiz\/finalize/);
  });

  it('runs the staged direct-worker preflight before promotion and crontab', () => {
    const deployScript = readFileSync(join(workerRoot, 'deploy.sh'), 'utf8');
    const preflightFailureBlock =
      /if ! ssh "\$VPS" "cd '\$STAGING_DIR' && \$NODE_BIN '\$STAGING_DIR\/jobs\/preflight-direct-web-workers\.mjs'"; then[\s\S]*?echo "Direct-worker environment preflight failed; live worker files and crontab were not changed\." >&2[\s\S]*?exit 1[\s\S]*?fi/;
    const preflightMatch = releaseHelper.match(preflightFailureBlock);
    const promotionIndex = releaseHelper.indexOf(
      'Promoting validated worker files'
    );
    const crontabIndex = deployScript.indexOf(
      'Installing crontab entries on VPS'
    );

    assert.ok(preflightMatch);
    assert.notEqual(promotionIndex, -1);
    assert.notEqual(crontabIndex, -1);
    assert.ok(
      releaseHelper.indexOf(preflightMatch[0]) < promotionIndex,
      'the fail-closed preflight must run before live promotion'
    );
    assert.ok(deployScript.indexOf('prepare_worker_release') < crontabIndex);
  });

  it('requires the remote worker checkout to match the deploying commit', () => {
    const deployScript = readFileSync(join(workerRoot, 'deploy.sh'), 'utf8');

    assert.match(deployScript, /APP_SHA=\$\(git rev-parse HEAD\)/);
    assert.match(releaseHelper, /git -C "\$repo_dir" rev-parse --verify HEAD/);
    assert.match(
      releaseHelper,
      /git -C "\$repo_dir" status --porcelain=v1 --untracked-files=all/
    );
    assert.match(
      releaseHelper,
      /Direct-worker checkout is dirty\.[\s\S]*?exit 1/
    );
    assert.match(
      releaseHelper,
      /if \[ "\$actual_sha" != "\$expected_sha" \]; then[\s\S]*?echo "Direct-worker checkout does not match the deploying commit\." >&2[\s\S]*?exit 1[\s\S]*?fi/
    );
    assert.match(
      releaseHelper,
      /apps\/web\/src\/scripts\/process-petrock-reconciliation\.ts/
    );
    assert.match(
      releaseHelper,
      /apps\/web\/src\/scripts\/process-quiz-finalization\.ts/
    );
    assert.match(
      releaseHelper,
      /tsx_bin="\$repo_dir\/apps\/web\/node_modules\/\.bin\/tsx"/
    );
    assert.doesNotMatch(
      releaseHelper,
      /tsx_bin="\$repo_dir\/node_modules\/\.bin\/tsx"/
    );
    assert.doesNotMatch(releaseHelper, /pnpm .*exec tsx/);
    assert.match(
      releaseHelper,
      /Direct-worker checkout is missing \$script_path\.[\s\S]*?exit 1/
    );
    assert.match(
      releaseHelper,
      /Direct-worker checkout is missing the reviewed web toolchain\.[\s\S]*?exit 1/
    );
    assert.match(
      releaseHelper,
      /"\$remote_dir\/bin\/process-petrock-reconciliation\.sh"/
    );
    assert.match(
      releaseHelper,
      /"\$remote_dir\/bin\/process-quiz-finalization\.sh"/
    );
    assert.match(
      releaseHelper,
      /if \[ ! -x "\$wrapper_path" \]; then[\s\S]*?Missing or non-executable direct-worker wrapper: \$wrapper_path[\s\S]*?exit 1/
    );
    assert.ok(
      deployScript.indexOf('prepare_worker_release') <
        deployScript.indexOf('Installing crontab entries on VPS')
    );
  });

  it('prints the required full-checkout path in the environment reminder', () => {
    const deployScript = readFileSync(join(workerRoot, 'deploy.sh'), 'utf8');

    assert.match(deployScript, /BACI_REPO_DIR=\/opt\/baci\/app/);
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

  it('keeps the deployment entrypoint within the repository size limit', () => {
    const deployScript = readFileSync(join(workerRoot, 'deploy.sh'), 'utf8');
    const lineCount = deployScript.endsWith('\n')
      ? deployScript.split('\n').length - 1
      : deployScript.split('\n').length;

    assert.ok(lineCount <= 300);
  });
});
