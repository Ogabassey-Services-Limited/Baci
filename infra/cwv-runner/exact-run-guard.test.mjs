// biome-ignore-all format: compact guard matrix stays below the repository file limit
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  ACTIVE_STATUSES,
  createChallenge,
  validateAdmission,
  validateDispatchRun,
  validateHookContext,
  validateInventoryReceipt,
  validateProcessInventory,
  validateReconciliation,
  validateRelease,
} from './exact-run-contract.mjs';

const controller = await readFile(new URL('./exact-run-controller.sh', import.meta.url), 'utf8');
const hook = await readFile(new URL('./job-start-hook.sh', import.meta.url), 'utf8');
const wrapper = await readFile(new URL('./measurement-service-wrapper.sh', import.meta.url), 'utf8');
const hostAuthority = await readFile(new URL('./host-idle-process-authority.mjs', import.meta.url), 'utf8');
const sha = (character) => character.repeat(64);
const bootId = '11111111-1111-4111-8111-111111111111';
const binding = Object.freeze({
  admissionId: sha('a'),
  campaignId: 'campaign-001',
  expectedSha: 'b'.repeat(40),
  policyFileSha256: sha('c'),
  repository: { id: 1100488586, name: 'ogabasseyy/Baci' },
  run: { attempt: 1, id: 42 },
  workflow: {
    id: 7,
    job: 'attest',
    path: '.github/workflows/cwv-runner-attestation.yml',
    ref: 'refs/heads/main',
  },
});
const runner = Object.freeze({
  architecture: 'X64',
  busy: false,
  id: 99,
  labels: ['Linux', 'X64', 'baci-cwv-measurement', 'self-hosted'],
  name: 'baci-cwv-measurement-01',
  os: 'linux',
  status: 'offline',
});
const requiredRunner = Object.freeze({ generation: 1, id: runner.id, name: runner.name });
function admission(challenge) {
  return {
    schemaVersion: 1,
    kind: 'admission',
    admissionId: binding.admissionId,
    campaignId: binding.campaignId,
    challengeNonce: challenge.nonce,
    ownerAudit: { capturedAt: '2026-07-21T20:00:00Z' },
    policyFileSha256: binding.policyFileSha256,
    reconciliation: {
      activeRunCount: 1,
      digest: sha('d'),
      stateGeneration: 3,
    },
    repository: binding.repository,
    run: {
      actor: 'ogabasseyy',
      admissionId: binding.admissionId,
      attempt: 1,
      displayTitle: `CWV Runner Attestation ${binding.admissionId}`,
      event: 'workflow_dispatch',
      id: 42,
      status: 'queued',
    },
    workflow: {
      headSha: binding.expectedSha,
      id: binding.workflow.id,
      job: binding.workflow.job,
      path: binding.workflow.path,
      ref: binding.workflow.ref,
    },
  };
}
function inventory(challenge, overrides = {}) {
  return {
    schemaVersion: 1,
    kind: 'runner-inventory',
    admissionId: binding.admissionId,
    campaignId: binding.campaignId,
    challengeNonce: challenge.nonce,
    holdDigest: sha('e'),
    ownerAudit: { capturedAt: '2026-07-21T20:00:03Z' },
    pages: [
      { number: 1, next: null, runners: [runner], totalCount: 1 },
    ],
    policyFileSha256: binding.policyFileSha256,
    repository: binding.repository,
    run: binding.run,
    ...overrides,
  };
}
const digest = (value) => createHash('sha256').update(value).digest('hex');
async function abortFixture({ campaign, foreign = false }) {
  const root = await mkdtemp(path.join(tmpdir(), 'baci-cwv-cleanup-'));
  const paths = Object.fromEntries(['state', 'control', 'allow', 'inventory', 'release', 'run'].map((name) => [name, path.join(root, name)]));
  await Promise.all(Object.values(paths).map((value) => mkdir(value, { recursive: true })));
  const activeCampaign = 'campaign-a'; const capture = '{"capture":true}\n'; const captureSha = digest(capture);
  const directory = path.join(paths.control, activeCampaign); const state = path.join(paths.state, activeCampaign);
  await Promise.all([mkdir(directory), mkdir(state)]);
  await Promise.all([writeFile(path.join(directory, 'binding.json'), '{}\n'), writeFile(path.join(state, 'capture.json'), capture), writeFile(path.join(state, 'capture.sha256'), `${captureSha}\n`), writeFile(path.join(paths.allow, 'active.json'), '{"other":true}\n')]);
  await Promise.all([path.join(directory, 'binding.json'), path.join(state, 'capture.json'), path.join(state, 'capture.sha256')].map((value) => chmod(value, 0o600)));
  const binding = { artifacts: { allow: '0'.repeat(64), environment: null, inventory: null, release: null, samplerEnvironment: null }, campaignId: activeCampaign, captureSha256: captureSha, controllerBindingSha256: digest('{}\n'), generation: 1, schemaVersion: 1 };
  await writeFile(path.join(directory, 'active-transaction.json'), `${JSON.stringify(binding)}\n`, { mode: 0o600 });
  const marker = path.join(root, 'systemctl-called'); await writeFile(path.join(root, 'systemctl'), `#!/bin/sh\ntouch ${marker}\n`, { mode: 0o700 });
  let source = controller.replace(/root_file\(\) \{[^\n]*\}/, 'root_file() { [ -f "$1" ] && [ ! -L "$1" ]; }').replace(/root_mode\(\) \{[^\n]*\}/, 'root_mode() { root_file "$1"; }').replace(/^digest\(\).*$/m, `digest() { '${process.execPath}' -e 'const c=require("node:crypto"),f=require("node:fs");process.stdout.write(c.createHash("sha256").update(f.readFileSync(process.argv[1])).digest("hex")+"\\n")' "$1"; }`).replace(/\[ "\$\(\/usr\/bin\/id -u\)" -eq 0 \] \|\| \{ printf '%s\\n' 'root required' >&2; exit 77; \}/, 'true').replaceAll('/bin/systemctl', path.join(root, 'systemctl'));
  const artifactMarker = path.join(root, 'verify-artifact-called'); assert.match(source, /^verify_artifact\(\) \{$/m); source = source.replace(/^verify_artifact\(\) \{$/m, `verify_artifact() { : >"${artifactMarker}";`);
  for (const [name, value] of Object.entries({ STATE_ROOT: paths.state, CONTROL_ROOT: paths.control, ALLOW_ROOT: paths.allow, INVENTORY_ROOT: paths.inventory, RELEASE_ROOT: paths.release, ENV_FILE: path.join(root, 'measurement.env'), SAMPLER_ENV: path.join(paths.run, 'host-sampler.env') })) source = source.replace(new RegExp(`^${name}=.*$`, 'm'), `${name}=${value}`);
  const script = path.join(root, 'controller.sh'); await writeFile(script, source, { mode: 0o700 });
  const result = spawnSync('/bin/sh', [script, '--abort', foreign ? 'campaign-b' : campaign], { encoding: 'utf8', timeout: 3000 });
  const verified = await readFile(artifactMarker).then(() => true, () => false); await assert.rejects(() => readFile(marker)); await rm(root, { force: true, recursive: true }); return { result, verified };
}
test('controller protocol is closed, offline-first, and cleanup-first', () => {
  assert.match(controller, /usage: exact-run-controller\.sh <--begin\|--admit\|--release\|--complete\|--abort> <campaign-id>/);
  for (const mode of ['--begin', '--admit', '--release', '--complete', '--abort'])
    assert.match(controller, new RegExp(mode));
  assert.match(controller, /--begin\) begin "\$campaign_id" <&0/);
  assert.match(controller, /--admit\) admit "\$campaign_id" <&0/);
  assert.match(controller, /--release\) release "\$campaign_id" <&0/);
  assert.ok(controller.indexOf('trap cleanup') < controller.indexOf('campaign-quiesce.sh'));
  const sequence = [
    'validate-admission', 'campaign-quiesce.sh', 'install-admission',
    'write-prestart-environment', 'systemctl start baci-cwv-measurement.service',
    'inspect-held-container', 'install-classifier', 'live-sample.json',
    'validate-inventory', 'release.json', 'acknowledged',
  ];
  const transition = controller.slice(controller.indexOf('# Closed transition order:'));
  for (let index = 1; index < sequence.length; index += 1)
    assert.ok(transition.indexOf(sequence[index - 1]) < transition.indexOf(sequence[index]), `${sequence[index - 1]} before ${sequence[index]}`);
  assert.doesNotMatch(controller, /\b(?:curl|wget|gh)\b|api\.github\.com|GITHUB_TOKEN/);
  const cleanup = controller.slice(controller.indexOf('restore_transaction()'), controller.indexOf('trap cleanup'));
  assert.match(cleanup, /systemctl stop baci-cwv-measurement\.service[\s\S]*\$ALLOW_ROOT\/active\.json[\s\S]*\$INVENTORY_ROOT\/active\.json[\s\S]*\$RELEASE_ROOT\/release\.json[\s\S]*\$ENV_FILE[\s\S]*\$SAMPLER_ENV[\s\S]*campaign-restore\.sh[\s\S]*verify_campaign_restored/);
  assert.match(controller, /BACI_CWV_CAMPAIGN_ID[\s\S]*BACI_CWV_CAPTURE_SHA256[\s\S]*BACI_CWV_LISTENER_RELEASE_NOT_BEFORE_MONOTONIC_SECONDS[\s\S]*BACI_CWV_LISTENER_RELEASE_DEADLINE_MONOTONIC_SECONDS/);
});
test('admission uses its independent root challenge and exact run binding', () => {
  const challenge = createChallenge({
    binding,
    bootId,
    kind: 'admission',
    nonce: sha('1'),
    nowMonotonicSeconds: 100,
    ttlSeconds: 30,
  });
  const accepted = validateAdmission({
    binding,
    bootId,
    challenge,
    document: admission(challenge),
    nowMonotonicSeconds: 129,
  });
  assert.equal(accepted.expiresMonotonicSeconds, 159);
  assert.throws(
    () => validateAdmission({ binding, bootId, challenge, document: admission(challenge), nowMonotonicSeconds: 131 }),
    /expired/
  );
  const hostile = admission(challenge);
  hostile.ownerMonotonicSeconds = 100;
  assert.throws(
    () => validateAdmission({ binding, bootId, challenge, document: hostile, nowMonotonicSeconds: 101 }),
    /keys/
  );
});
test('dispatch and reconciliation require exact main SHA, admission, and sole active run', () => {
  assert.deepEqual(ACTIVE_STATUSES, ['queued', 'in_progress', 'requested', 'waiting', 'pending']);
  const run = admission(createChallenge({ binding, bootId, kind: 'admission', nonce: sha('1'), nowMonotonicSeconds: 1, ttlSeconds: 30 })).run;
  const complete = { ...run, headBranch: 'main', headSha: binding.expectedSha, workflowId: 7, workflowPath: binding.workflow.path };
  assert.equal(validateDispatchRun({ binding, run: complete }).id, 42);
  assert.equal(validateReconciliation({ binding, runs: [complete] }).activeRunCount, 1);
  assert.throws(() => validateReconciliation({ binding, runs: [complete, { ...complete, id: 43 }] }), /sole active/);
  assert.throws(() => validateDispatchRun({ binding, run: { ...complete, headSha: '0'.repeat(40) } }), /binding/);
});
test('inventory validation covers every canonical page and all runner states', () => {
  const challenge = createChallenge({ binding, bootId, kind: 'inventory', nonce: sha('2'), nowMonotonicSeconds: 200, ttlSeconds: 5 });
  const accepted = validateInventoryReceipt({
    binding,
    bootId,
    challenge,
    document: inventory(challenge),
    holdDigest: sha('e'),
    nowMonotonicSeconds: 204,
    requiredRunner,
    ttlSeconds: 5,
  });
  assert.equal(accepted.runner.id, runner.id);
  assert.equal(accepted.runner.generation, requiredRunner.generation);
  assert.equal(accepted.expiresMonotonicSeconds, 209);

  const duplicateLabel = inventory(challenge);
  duplicateLabel.pages[0] = { number: 1, next: null, runners: [runner, { ...runner, id: 100 }], totalCount: 2 };
  assert.throws(() => validateInventoryReceipt({ binding, bootId, challenge, document: duplicateLabel, holdDigest: sha('e'), nowMonotonicSeconds: 201, requiredRunner, ttlSeconds: 5 }), /dedicated label/);
  const skipped = inventory(challenge);
  skipped.pages = [{ number: 1, next: '/repos/ogabasseyy/Baci/actions/runners?per_page=100&page=2', runners: [], totalCount: 1 }, { number: 3, next: null, runners: [runner], totalCount: 1 }];
  assert.throws(() => validateInventoryReceipt({ binding, bootId, challenge, document: skipped, holdDigest: sha('e'), nowMonotonicSeconds: 201, requiredRunner, ttlSeconds: 5 }), /page/);
  const external = inventory(challenge);
  external.pages = [{ number: 1, next: '/repos/ogabasseyy/Baci/actions/runners?per_page=100&page=2', runners: [], totalCount: 1 }, { number: 2, next: null, runners: [runner], totalCount: 1 }];
  external.pages[0].next = 'https://example.test/actions/runners?per_page=100&page=2';
  assert.throws(() => validateInventoryReceipt({ binding, bootId, challenge, document: external, holdDigest: sha('e'), nowMonotonicSeconds: 201, requiredRunner, ttlSeconds: 5 }), /page/);
  const overflow = inventory(challenge);
  overflow.pages = Array.from({ length: 101 }, (_, index) => ({ number: index + 1, next: index === 100 ? null : `/repos/ogabasseyy/Baci/actions/runners?per_page=100&page=${index + 2}`, runners: [], totalCount: 0 }));
  assert.throws(() => validateInventoryReceipt({ binding, bootId, challenge, document: overflow, holdDigest: sha('e'), nowMonotonicSeconds: 201, requiredRunner, ttlSeconds: 5 }), /page limit/);
  for (const hostile of [{ ...runner, generation: 1 }, { ...runner, architecture: 'ARM64' }, { ...runner, labels: ['Linux', 'baci-cwv-measurement', 'self-hosted'] }])
    assert.throws(() => validateInventoryReceipt({ binding, bootId, challenge, document: inventory(challenge, { pages: [{ number: 1, next: null, runners: [hostile], totalCount: 1 }] }), holdDigest: sha('e'), nowMonotonicSeconds: 201, requiredRunner, ttlSeconds: 5 }), /runner/);
  for (const hostile of [{ ...requiredRunner, generation: 2 }, { ...requiredRunner, id: 100 }, { ...requiredRunner, name: 'other' }])
    assert.throws(() => validateInventoryReceipt({ binding, bootId, challenge, document: inventory(challenge), holdDigest: sha('e'), nowMonotonicSeconds: 201, requiredRunner: hostile, ttlSeconds: 5 }), /runner/);
});
test('release uses only root-local receipt expiry and exact hold evidence', () => {
  const challenge = createChallenge({ binding, bootId, kind: 'inventory', nonce: sha('2'), nowMonotonicSeconds: 200, ttlSeconds: 5 });
  const receipt = validateInventoryReceipt({ binding, bootId, challenge, document: inventory(challenge), holdDigest: sha('e'), nowMonotonicSeconds: 204, requiredRunner, ttlSeconds: 5 });
  const release = validateRelease({
    binding,
    classifierDigest: sha('3'),
    holdDigest: sha('e'),
    inventoryReceipt: receipt,
    liveSampleDigest: sha('4'),
    nowMonotonicSeconds: 208,
  });
  assert.equal(release.ready, true);
  for (const nowMonotonicSeconds of [Number.NaN, 208.5, Number.MAX_SAFE_INTEGER + 1])
    assert.throws(() => validateRelease({ binding, classifierDigest: sha('3'), holdDigest: sha('e'), inventoryReceipt: receipt, liveSampleDigest: sha('4'), nowMonotonicSeconds }), /release time must be an integer/);
  assert.throws(() => validateRelease({ binding, classifierDigest: sha('3'), holdDigest: sha('e'), inventoryReceipt: { ...receipt, runner: { ...receipt.runner, generation: 2 } }, liveSampleDigest: sha('4'), nowMonotonicSeconds: 208 }), /runner generation/);
  assert.throws(() => validateRelease({ binding, classifierDigest: sha('3'), holdDigest: sha('e'), inventoryReceipt: receipt, liveSampleDigest: sha('4'), nowMonotonicSeconds: 210 }), /expired/);
});
test('terminal process inventory remains empty and every nonterminal phase needs the sealed map', () => {
  assert.doesNotThrow(() => validateProcessInventory({ busy: false, expectedRunId: 42, phase: 'terminal', processes: [] }));
  assert.throws(() => validateProcessInventory({ busy: true, expectedRunId: 42, phase: 'terminal', processes: [] }), /terminal/);
  assert.throws(() => validateProcessInventory({ busy: false, expectedRunId: 42, phase: 'listener-idle', processes: [] }), /process map/);
});
test('controller seals a host-observed terminal inventory after nonterminal container samples', () => {
  const release = controller.slice(controller.indexOf('release()'), controller.indexOf('complete_run()')); assert.match(controller, /validate_process_sample\(\)[\s\S]*validate-process/);
  assert.doesNotMatch(controller, /printf '%s\\n' '\[\]' >"\$directory\/process-list\.json"/);
  assert.match(release, /while \/bin\/systemctl is-active[\s\S]*process-inventory\.mjs[\s\S]*validate_process_sample[\s\S]*\[ "\$phase" != terminal \][\s\S]*done[\s\S]*until "\$SCRIPT_DIR\/exact-run-terminal-cleanup\.sh" --observe-terminal[\s\S]*before_controller_deadline/);
  assert.match(release, /exact-run-terminal-cleanup\.sh" --observe-terminal "\$id" >"\$directory\/processes\.json"[\s\S]*validate_process_sample[\s\S]*\[ "\$phase" = terminal \]/);
});
test('terminal completion emits canonical empty inventory and a receipt-bound restore identity', () => {
  assert.match(controller, /--complete\|--abort/);
  assert.match(controller, /(?=[\s\S]*terminal-processes\.json)(?=[\s\S]*processes:\[\])(?=[\s\S]*restore-receipt\.json)/);
  assert.match(controller, /canonical_json[\s\S]*completion-trigger\.json/);
  assert.match(controller, /write_receipt "\$directory\/terminal-processes\.json"/);
});
test('controller, process authority, wrapper, and host share the canonical measurement cgroup', () => {
  assert.match(controller, /PROCESS_MAP=\/srv\/baci-cwv\/receipts\/image-process-map\.json/);
  assert.match(controller, /process-identity\.json/);
  assert.match(controller, /validate-process.*\$PROCESS_MAP.*process-identity\.json.*process-list\.json/);
  assert.match(controller, /\{cgroupPath:\$cgroupPath,cpuset:\$cpuset,generation:1,processMapSha256:\$processMapSha256,runnerContainerId:\$runnerContainerId\}/);
  assert.match(controller, /measurement_cgroup_path=\/cwv-measurement\.slice\/docker-\$container_id\.scope/);
  assert.match(controller, /\[ "\$cgroup_path" = "\$measurement_cgroup_path" \]/);
  assert.match(wrapper, /--cgroup-parent=cwv-measurement\.slice/);
  assert.match(hostAuthority, /\/cwv-measurement\.slice\/docker-\$\{runtime\.runnerContainerId\}\.scope/);
  assert.match(hostAuthority, /\/cwv-measurement-control\.slice/);
});
test('cleanup refuses a foreign or drifted transaction before touching active state', () => {
  assert.match(controller, /ACTIVE_TRANSACTION=\$CONTROL_ROOT\/\$campaign_id\/active-transaction\.json/);
  assert.match(controller, /transaction\) restore_transaction "\$CONTROL_ROOT\/\$campaign_id"/); assert.match(controller, /restore_transaction\(\)[\s\S]*verify_active_transaction "\$campaign_id" \|\| return 1/);
  assert.match(controller, /campaignId == \$campaign and \.generation == 1/);
  assert.match(controller, /wc -l < "\$ACTIVE_TRANSACTION"/);
  assert.match(controller, /controllerBindingSha256.*captureSha256/);
  assert.match(controller, /verify_artifact allow "\$ALLOW_ROOT\/active\.json"/);
  assert.match(controller, /verify_artifact inventory "\$INVENTORY_ROOT\/active\.json"/);
  assert.match(controller, /verify_artifact release "\$RELEASE_ROOT\/release\.json"/);
  assert.match(controller, /verify_artifact environment "\$ENV_FILE"/);
  assert.match(controller, /verify_artifact samplerEnvironment "\$SAMPLER_ENV"/);
  assert.match(controller, /\[ "\$expected" = null \] && \[ ! -e "\$path" \]/);
  assert.match(controller, /remove_bound_artifact.*\.artifacts\[\$key\]=null/);
  assert.match(controller, /campaign-restore\.sh.*\$capture_sha/);
  assert.doesNotMatch(controller, /rm -rf -- "\$CONTROL_ROOT/);
});
test('abort cannot stop or delete state for a foreign campaign or a drifted receipt', async () => {
  for (const value of [{ campaign: 'campaign-a', foreign: true }, { campaign: 'campaign-a' }]) {
    const { result, verified } = await abortFixture(value);
    assert.equal(result.error, undefined);
    assert.equal(result.status, 1);
    assert.equal(verified, !value.foreign);
  }
});
test('job hook selects only named context and validates the raw-policy-bound finite five-second allow record', () => {
  const environment = {
    GITHUB_JOB: 'attest', GITHUB_REF: 'refs/heads/main', GITHUB_REPOSITORY: 'ogabasseyy/Baci', GITHUB_REPOSITORY_ID: '1100488586', GITHUB_RUN_ATTEMPT: '1', GITHUB_RUN_ID: '42',
    GITHUB_SHA: binding.expectedSha, GITHUB_WORKFLOW_REF: `ogabasseyy/Baci/${binding.workflow.path}@refs/heads/main`, GITHUB_WORKFLOW_SHA: binding.expectedSha, UNRELATED_SECRET: 'must-not-be-read',
  };
  const allow = { ...binding, expiresMonotonicSeconds: 305, kind: 'allow', runner: requiredRunner, schemaVersion: 1 };
  const result = validateHookContext({ allow, environment, event: { inputs: { admission_id: binding.admissionId }, extra: 'ignored' }, nowMonotonicSeconds: 304 });
  assert.equal(result.ok, true);
  assert.throws(() => validateHookContext({ allow, environment: { ...environment, GITHUB_RUN_ID: '43' }, event: { inputs: { admission_id: binding.admissionId } }, nowMonotonicSeconds: 304 }), /binding/);
  assert.throws(() => validateHookContext({ allow, environment, event: { inputs: { admission_id: binding.admissionId } }, nowMonotonicSeconds: 306 }), /expired/);
  assert.match(hook, /GITHUB_REPOSITORY GITHUB_REPOSITORY_ID GITHUB_WORKFLOW_REF GITHUB_WORKFLOW_SHA GITHUB_REF GITHUB_SHA GITHUB_RUN_ID GITHUB_RUN_ATTEMPT GITHUB_JOB RUNNER_NAME RUNNER_OS RUNNER_ARCH/);
  assert.doesNotMatch(hook, /\bprintenv\b|\benv\s|\bset\s*[|>]|\bexport\s+-p\b|cat.*GITHUB_EVENT_PATH/);
  assert.match(hook, /hookTimeoutSeconds/);
  assert.match(hook, /Number\.isFinite\(allow\.expiresMonotonicSeconds\)/); assert.match(hook, /createHash\('sha256'\)\.update\(policyText\)\.digest\('hex'\).*allow\.policyFileSha256/);
  assert.match(hook, /'runner'/); assert.match(hook, /allow\.runner\.name !== 'baci-cwv-measurement-01'/); assert.match(hook, /allow\.runner\.name !== process\.env\.RUNNER_NAME/);
  assert.ok(hook.indexOf("createHash('sha256').update(policyText).digest('hex')") < hook.indexOf('const finish'));
});
