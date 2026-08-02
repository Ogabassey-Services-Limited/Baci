import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const [controller, ownerTransport] = await Promise.all([
  readFile(new URL('./exact-run-controller.sh', import.meta.url), 'utf8'),
  readFile(new URL('./owner-api-transport.mjs', import.meta.url), 'utf8'),
]);
const faultStages = [
  'stop-measurement',
  'remove-allow',
  'remove-inventory',
  'remove-release',
  'remove-environment',
  'remove-sampler-environment',
  'stop-sampler',
  'campaign-restore',
  'restore-receipt',
];
async function runRollbackFault({ stage, mode }) {
  const root = await mkdtemp(path.join(tmpdir(), 'baci-cwv-rollback-'));
  const state = path.join(root, 'state');
  const control = path.join(root, 'control');
  const marker = path.join(root, 'marker');
  const systemctl = path.join(root, 'systemctl');
  const capture = '{"capture":true}\n';
  const captureSha = createHash('sha256').update(capture).digest('hex');
  const harness = `
if [ "\${BACI_CWV_TEST_HARNESS-}" = transaction ]; then
  root_mode() { return 0; }
  verify_active_transaction() { return 0; }
  remove_bound_artifact() { return 0; }
  verify_campaign_restored() { return 0; }
  restore_receipt() { printf 'receipt:%s:%s\\n' "$2" "$3" >"$BACI_CWV_TEST_MARKER"; }
  campaign_id=campaign; capture_sha=${captureSha}; cleanup_armed=1; cleanup_phase=transaction; cleanup_generation=7; cleanup_terminal_sha=${'b'.repeat(64)}
  restore_transaction "$CONTROL_ROOT/campaign" "$cleanup_generation" "$cleanup_terminal_sha"
  cleanup_armed=0
  exit 0
fi
if [ "\${BACI_CWV_TEST_HARNESS-}" = publication ]; then
  root_mode() { return 0; }
  digest() { printf '%s' "$BACI_CWV_TEST_CAPTURE_SHA"; }
  verify_campaign_restored() { printf '%s\\n' quiesced >"$BACI_CWV_TEST_MARKER"; }
  campaign_id=campaign; capture_sha=${captureSha}; cleanup_armed=1; cleanup_phase=quiesced
  write_active_transaction "$CONTROL_ROOT/campaign" "$capture_sha"
  exit 0
fi
`;
  const source = controller
    .replace(/^STATE_ROOT=.*$/m, `STATE_ROOT=${state}`)
    .replace(/^CONTROL_ROOT=.*$/m, `CONTROL_ROOT=${control}`)
    .replaceAll('/bin/systemctl', '"$BACI_CWV_TEST_SYSTEMCTL"')
    .replace('[ "$#" -eq 2 ] || usage', `${harness}\n[ "$#" -eq 2 ] || usage`);
  try {
    await Promise.all([
      mkdir(path.join(state, 'campaign'), { recursive: true }),
      mkdir(path.join(control, 'campaign'), { recursive: true }),
    ]);
    await Promise.all([
      writeFile(path.join(state, 'campaign', 'capture.json'), capture),
      writeFile(
        path.join(state, 'campaign', 'capture.sha256'),
        `${captureSha}\n`
      ),
      writeFile(path.join(control, 'campaign', 'binding.json'), '{}\n'),
      writeFile(systemctl, '#!/bin/sh\nexit 0\n'),
    ]);
    await chmod(systemctl, 0o700);
    const script = path.join(root, 'controller.sh');
    await writeFile(script, source, { mode: 0o700 });
    const result = spawnSync('/bin/sh', [script, '--complete', 'campaign'], {
      encoding: 'utf8',
      env: {
        ...process.env,
        BACI_CWV_TEST_FAULT_ONCE: '1',
        BACI_CWV_TEST_FAULT_STAGE: stage,
        BACI_CWV_TEST_HARNESS: mode,
        BACI_CWV_TEST_CAPTURE_SHA: captureSha,
        BACI_CWV_TEST_MARKER: marker,
        BACI_CWV_TEST_SYSTEMCTL: systemctl,
      },
    });
    const receipt = await readFile(marker, 'utf8').catch(() => '');
    return { receipt, result };
  } finally {
    await rm(root, { force: true, recursive: true });
  }
}
test('artifact cleanup durably deletes each artifact before clearing its digest', () => {
  assert.doesNotMatch(controller, /clear_artifacts/);
  const helper = controller.slice(
    controller.indexOf('remove_bound_artifact()'),
    controller.indexOf('verify_active_transaction()')
  );
  for (const token of [
    'verify_artifact',
    '/bin/rm -f',
    '/usr/bin/sync -f',
    '.artifacts[$key]=null',
  ])
    assert.notEqual(helper.indexOf(token), -1, token);
  assert.ok(
    helper.indexOf('/bin/rm -f') < helper.indexOf('.artifacts[$key]=null')
  );
  assert.ok(
    helper.indexOf('/usr/bin/sync -f') < helper.indexOf('.artifacts[$key]=null')
  );
  const restore = controller.slice(
    controller.indexOf('restore_transaction()'),
    controller.indexOf('cleanup()')
  );
  for (const key of [
    'allow',
    'inventory',
    'release',
    'environment',
    'samplerEnvironment',
  ])
    assert.match(restore, new RegExp(`remove_bound_artifact ${key}`));
});
test('restore validates and reuses a completed campaign restoration', () => {
  assert.match(controller, /verify_campaign_restored\(\)/);
  assert.match(controller, /captureSha256/);
  assert.match(controller, /policyFileSha256 == \$policy/);
  assert.match(controller, /transactionContainerCount == 0/);
  assert.match(controller, /dedicatedNetworkPresent == false/);
  assert.match(controller, /dedicatedServicesActive == false/);
  assert.match(controller, /samplerActive == false/);
  assert.match(
    controller,
    /verify_campaign_restored \|\| "\$SCRIPT_DIR\/campaign-restore\.sh"/
  );
});
test('transport loss comes only from root-owned continuous transition evidence', () => {
  assert.match(
    controller,
    /TRANSITION_EVIDENCE_ROOT=\/srv\/baci-cwv\/evidence/
  );
  assert.match(controller, /exact-run-transition-contract\.mjs/);
  assert.match(controller, /abort-trigger\.json/);
  assert.match(controller, /transport-observation\.json/);
  assert.match(controller, /transition-evidence/);
  assert.doesNotMatch(controller, /transport-lost\.json/);
  const abort = controller.slice(controller.indexOf('abort()'));
  assert.doesNotMatch(
    abort,
    /jobStartHookObserved:false|actionNodeObserved:false|listenerExitKind:"transport-lost"|runnerOffline:true|daemonsOffline:true/
  );
  assert.match(abort, /terminalProcessesSha256/);
  assert.match(abort, /restore-receipt\.json/);
});
test('completion accepts only digest-bound owner handoff metadata', () => {
  assert.match(controller, /completion-trigger\.json/);
  for (const key of [
    'artifactReadbackEvidenceSha256',
    'ownerEvidenceHandoffSha256',
    'ownerStateSha256',
  ])
    assert.match(controller, new RegExp(key));
  assert.match(
    ownerTransport,
    /ownerEvidenceHandoff = \{[^;\n]*runnerIdentitySha256/
  );
  assert.doesNotMatch(controller, /evidence-verified\.json/);
});
test('retains a pre-transaction rollback after quiesce and arms terminal cleanup through restoration', () => {
  const admit = controller.slice(
    controller.indexOf('admit()'),
    controller.indexOf('release()')
  );
  assert.match(
    admit,
    /campaign-quiesce\.sh[\s\S]*cleanup_phase=quiesced[\s\S]*write_active_transaction[\s\S]*cleanup_phase=transaction/
  );
  const cleanup = controller.slice(
    controller.indexOf('cleanup()'),
    controller.indexOf('trap cleanup')
  );
  assert.match(cleanup, /quiesced\).*restore_quiesced_campaign/);
  assert.match(cleanup, /transaction\).*restore_transaction/);
  for (const name of ['complete_run()', 'abort()']) {
    const terminal = controller.slice(
      controller.indexOf(name),
      controller.indexOf(name === 'complete_run()' ? 'abort()' : 'rearm()')
    );
    assert.match(
      terminal,
      /cleanup_armed=1[\s\S]*restore_transaction[\s\S]*cleanup_armed=0/
    );
    assert.doesNotMatch(terminal, /cleanup_armed=0; restore_transaction/);
    assert.match(
      terminal,
      /cleanup_generation=\$generation; cleanup_terminal_sha=\$terminal_sha[\s\S]*restore_transaction "\$directory" "\$cleanup_generation" "\$cleanup_terminal_sha"[\s\S]*cleanup_armed=0/
    );
  }
  const complete = controller.slice(
    controller.indexOf('complete_run()'),
    controller.indexOf('abort()')
  );
  const filter = complete.match(
    /generation=\$\([\s\S]*?'([\s\S]*?)' "\$directory\/completion-trigger\.json"\)/
  )?.[1];
  assert.ok(filter);
  const result = spawnSync(
    '/usr/bin/jq',
    [
      '-er',
      '--arg',
      'admission',
      'admission',
      '--argjson',
      'attempt',
      '1',
      '--argjson',
      'run',
      '2',
      filter,
    ],
    {
      encoding: 'utf8',
      input:
        '{"admissionId":"admission","artifactReadbackEvidenceSha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","attempt":1,"ownerEvidenceHandoffSha256":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","ownerStateSha256":"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc","runId":2,"schemaVersion":1,"stateGeneration":7}\n',
    }
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '7\n');
});
test('provides explicit test failpoints for transaction publication and every restore stage', () => {
  assert.match(
    controller,
    /failpoint\(\) \{[\s\S]*BACI_CWV_TEST_FAULT_STAGE-[\s\S]*BACI_CWV_TEST_FAULT_ONCE-[\s\S]*BACI_CWV_TEST_FAULT_CONSUMED-/
  );
  for (const stage of [
    'transaction-publication',
    'stop-measurement',
    'remove-allow',
    'remove-inventory',
    'remove-release',
    'remove-environment',
    'remove-sampler-environment',
    'stop-sampler',
    'campaign-restore',
    'restore-receipt',
  ])
    assert.match(controller, new RegExp(`failpoint ${stage} \\|\\| return 1`));
});
test('does not disarm a terminal cleanup until it has verified the durable restore receipt', () => {
  const receipt = controller.slice(
    controller.indexOf('restore_receipt()'),
    controller.indexOf('verify_campaign_restored()')
  );
  assert.match(receipt, /write_receipt "\$directory\/restore-receipt\.json"/);
  assert.match(receipt, /write_receipt "\$directory\/restore-receipt\.sha256"/);
  assert.match(
    receipt,
    /root_mode "\$directory\/restore-receipt\.json" 600[\s\S]*root_mode "\$directory\/restore-receipt\.sha256" 600[\s\S]*digest "\$directory\/restore-receipt\.json"/
  );
  const cleanup = controller.slice(
    controller.indexOf('cleanup()'),
    controller.indexOf('trap cleanup')
  );
  assert.match(
    cleanup,
    /restore_transaction "\$CONTROL_ROOT\/\$campaign_id" "\$cleanup_generation" "\$cleanup_terminal_sha"[\s\S]*cleanup_armed=0/
  );
});
test('recovers from a transaction-publication fault with the quiesced rollback still armed', async () => {
  const { receipt, result } = await runRollbackFault({
    mode: 'publication',
    stage: 'transaction-publication',
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 1);
  assert.equal(receipt, 'quiesced\n', `${result.stdout}\n${result.stderr}`);
});
test('retries every one-shot restore fault with the terminal receipt inputs intact', async () => {
  for (const stage of faultStages) {
    const { receipt, result } = await runRollbackFault({
      mode: 'transaction',
      stage,
    });
    assert.equal(result.error, undefined, stage);
    assert.equal(result.status, 1, stage);
    assert.equal(receipt, `receipt:7:${'b'.repeat(64)}\n`, stage);
  }
});
