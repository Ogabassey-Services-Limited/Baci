import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';

const read = (name) => readFile(new URL(name, import.meta.url), 'utf8');

test('watchdog service and terminal scripts are closed and source-bound', async () => {
  const [unit, watchdog, restore, postCommit, quiesce] = await Promise.all([
    read('./baci-cwv-campaign-watchdog@.service'),
    read('./campaign-watchdog.sh'),
    read('./campaign-restore.sh'),
    read('./campaign-restore-post-commit.sh'),
    read('./campaign-quiesce.sh'),
  ]);
  const watchdogMode =
    (await stat(new URL('./campaign-watchdog.sh', import.meta.url))).mode &
    0o777;
  assert.equal(
    watchdogMode,
    0o755,
    'the direct systemd ExecStart watchdog must be executable'
  );
  assert.match(
    unit,
    /(?=[\s\S]*User=root)(?=[\s\S]*RuntimeMaxSec=30m)(?=[\s\S]*Restart=on-failure)(?=[\s\S]*StartLimitIntervalSec=30m)(?=[\s\S]*StartLimitBurst=3)(?=[\s\S]*After=baci-cwv-containerd\.service baci-cwv-docker\.service)(?=[\s\S]*ExecStart=\/srv\/baci-cwv\/source\/@BACI_CWV_SOURCE_SHA@\/campaign-watchdog\.sh %i)(?=[\s\S]*WantedBy=multi-user\.target)/
  );
  assert.match(unit, /TimeoutStopSec=5m/);
  assert.match(
    unit,
    /ReadWritePaths=.*\/srv\/baci-cwv\/allow.*\/srv\/baci-cwv\/campaigns.*\/srv\/baci-cwv\/exact-runs.*\/srv\/baci-cwv\/inventory.*\/srv\/baci-cwv\/listener-release.*\/srv\/baci-cwv\/dedicated-runtime.*\/srv\/baci-cwv\/import.*\/srv\/baci-cwv\/registration-staging.*\/etc\/baci-cwv.*\/var\/lib\/baci-cwv\/prepare.*\/var\/spool\/cron/
  );
  assert.equal(unit.match(/@BACI_CWV_SOURCE_SHA@/g)?.length, 1);
  assert.doesNotMatch(
    unit,
    /\/srv\/baci-cwv\/bin|\/current\/|\bPATH=|\/bin\/(ba)?sh\s+-c/
  );
  const render = (sha) => {
    assert.match(sha, /^[a-f0-9]{40}$/);
    return unit.replace('@BACI_CWV_SOURCE_SHA@', sha);
  };
  assert.match(render('a'.repeat(40)), /source\/a{40}\/campaign-watchdog/);
  assert.throws(() => render('A'.repeat(40)), /match/);
  assert.match(watchdog, /\^\[a-z0-9\]\[a-z0-9-\]\{0,62\}\$/);
  assert.match(
    watchdog,
    /(?=[\s\S]*prepare\|registration\|campaign\|rehearsal)(?=[\s\S]*capture\.sha256)(?=[\s\S]*campaign-restore\.sh)(?=[\s\S]*trap restore_now EXIT HUP INT TERM)(?=[\s\S]*SOURCE_DIGEST)(?=[\s\S]*UTC_DEADLINE)(?=[\s\S]*monotonic)(?=[\s\S]*restored\.json)(?=[\s\S]*restore_and_verify)/
  );
  assert.ok(
    watchdog.indexOf('trap restore_now') < watchdog.indexOf('watchdog.env')
  );
  assert.match(watchdog, /lease-holder\.json/);
  assert.match(watchdog, /leaseHolderPid.*leaseHolderStartTime.*leaseToken/s);
  assert.doesNotMatch(watchdog, /exec 9>"\$LOCK"|flock 9/);
  assert.match(watchdog, /watchdog-ready\.json/);
  assert.match(
    watchdog,
    /schemaVersion.*transactionId.*mode.*captureSha256.*watchdogPid.*leaseHolderPid.*leaseHolderStartTime.*leaseToken.*lockDevice.*lockInode.*lockOwnerPid.*lockHeld/s
  );
  assert.ok(
    watchdog.indexOf('trap restore_now') < watchdog.indexOf('capture.sha256')
  );
  assert.ok(
    watchdog.indexOf('lease-holder.json') < watchdog.indexOf('lock_device=')
  );
  assert.doesNotMatch(watchdog, /eval|\$\{!|bash -c|sh -c|exit "\$status"/);
  assert.match(
    restore,
    /(?=[\s\S]*policyFileSha256)(?=[\s\S]*sourceDigest)(?=[\s\S]*watchdog\.env)(?=[\s\S]*dedicatedRuntime\/dockerService)(?=[\s\S]*dedicatedRuntime\/containerdService)(?=[\s\S]*transactionContainerCount)(?=[\s\S]*dedicatedNetworkPresent)(?=[\s\S]*accountingTablePresent)(?=[\s\S]*ownedFirewallPresent)(?=[\s\S]*samplerActive)(?=[\s\S]*dedicatedServicesActive)(?=[\s\S]*cronSha256)(?=[\s\S]*verify_resource_state)(?=[\s\S]*restore-failed\.json)(?=[\s\S]*trap 'exit 1(?:29|30|43)' (?:HUP|INT|TERM))(?=[\s\S]*reconciled:true)/
  );
  assert.ok(
    restore.indexOf('verify_restored') <
      restore.lastIndexOf('restored.json.tmp')
  );
  assert.doesNotMatch(
    restore,
    /systemctl stop baci-cwv-(?:docker|containerd)\.service/
  );
  assert.doesNotMatch(
    postCommit,
    /systemctl stop baci-cwv-(?:docker|containerd)\.service/
  );
  assert.match(restore, /verify_runtime_quiet/);
  for (const [intent, mutation, applied, journal] of [
    [
      'ownership network-intent',
      'network create',
      'ownership network-applied',
      'journal create-network',
    ],
    [
      'ownership accounting-intent',
      'nft -f',
      'ownership accounting-applied',
      'journal install-accounting-base',
    ],
  ]) {
    const intentIndex = quiesce.indexOf(intent);
    const mutationIndex = quiesce.indexOf(mutation, intentIndex);
    const appliedIndex = quiesce.indexOf(applied, mutationIndex);
    const journalIndex = quiesce.indexOf(journal, appliedIndex);
    assert.ok(
      intentIndex >= 0 &&
        intentIndex < mutationIndex &&
        mutationIndex < appliedIndex &&
        appliedIndex < journalIndex,
      `${mutation} has durable progressive ownership`
    );
  }
  assert.match(
    quiesce,
    /owned_iptables_mutation\(\).*ownership isolation-intent.*\/usr\/sbin\/iptables "\$@".*ownership isolation-applied/s
  );
  assert.doesNotMatch(
    restore,
    /remove_isolation\(\).*receipt_has_action install-isolation \|\| return 0/s
  );
  assert.doesNotMatch(
    restore,
    /remove_dedicated_runtime\(\).*receipt_owns create-network \|\| continue/s
  );
  assert.match(
    postCommit,
    /systemctl disable "baci-cwv-campaign-watchdog@\$\{transaction_id\}\.service"/
  );
  assert.doesNotMatch(
    restore,
    /runtime_socket_observed.*verify_runtime_quiet/s
  );
  assert.match(restore, /MainPID/);
  assert.match(restore, /cgroup/);
  assert.match(restore, /shim/);
  assert.match(
    restore,
    /EXACT_RUN_CLEANUP="\$SCRIPT_DIR\/exact-run-terminal-cleanup\.sh"[\s\S]*\$EXACT_RUN_CLEANUP[\s\S]*remove_isolation/
  );
  assert.match(
    watchdog,
    /restore_until_reconciled\(\)[\s\S]*while ! restore_and_verify; do[\s\S]*sleep[\s\S]*restore_until_reconciled/
  );
});
