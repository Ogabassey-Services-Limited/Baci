import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('./install.sh', import.meta.url), 'utf8');
const acceptanceSource = await readFile(
  new URL('./install-prepare-acceptance.mjs', import.meta.url),
  'utf8'
);
const verifySource = await readFile(
  new URL('./install-verify.mjs', import.meta.url),
  'utf8'
);
function anchor(value, needle) {
  const index = value.indexOf(needle);
  assert.ok(index >= 0, `missing source anchor: ${needle}`);
  return index;
}
function sourceSlice(value, start, end) {
  const startIndex = anchor(value, start);
  const endIndex = value.indexOf(end, startIndex + start.length);
  assert.ok(endIndex >= 0, `missing source anchor: ${end}`);
  return value.slice(startIndex, endIndex);
}

test('bootstrap captures before mutation, journals, completes, and disables concrete units', () => {
  const bootstrap = sourceSlice(
    source,
    'bootstrap() {',
    'assert_bootstrap() {'
  );
  assert.ok(
    anchor(bootstrap, 'install-bootstrap-controller.mjs" begin') <
      anchor(bootstrap, 'install_account')
  );
  assert.match(bootstrap, /install-bootstrap-controller\.mjs" journal/);
  assert.match(bootstrap, /install-bootstrap-controller\.mjs" complete/);
  assert.match(bootstrap, /install_units/);
  assert.match(source, /systemctl disable --now/);
  assert.match(
    source,
    /unit did not become inactive with the expected file state/
  );
  assert.match(source, /baci-cwv-campaign-watchdog@/);
  assert.match(source, /registration-root-request-stream\.mjs/);
  assert.match(source, /atomic_line\(\) \(/);
});

test('bootstrap authorizes and completes a receipt-bound source generation replacement', () => {
  const bootstrap = sourceSlice(
    source,
    'bootstrap() {',
    'assert_bootstrap() {'
  );
  assert.ok(
    anchor(bootstrap, 'replacement-authorize') <
      anchor(bootstrap, 'install_account')
  );
  assert.ok(
    bootstrap.lastIndexOf('replacement-complete') >
      anchor(bootstrap, 'install-bootstrap-controller.mjs" complete')
  );
  assert.match(
    bootstrap,
    /phase" = complete[\s\S]*replacement-intent\.json[\s\S]*replacement-complete/
  );
  const assertion = sourceSlice(
    source,
    'assert_bootstrap() {',
    'lstat_external() {'
  );
  assert.match(assertion, /replacement-intent\.json/);
  assert.match(assertion, /replacement-verify/);
  assert.match(source, /install-bootstrap-replacement-file\.mjs" source/);
  assert.match(source, /install-bootstrap-replacement-file\.mjs" line/);
  assert.match(
    source,
    /BACI_CWV_BOOTSTRAP_REPLACEMENT.*replacement intent required/s
  );
});

test('receipt-authorized file and line replacements validate prior metadata in the replacement helper', () => {
  const installers = [
    sourceSlice(source, 'atomic_line() (', '); ensure_directory()'),
    sourceSlice(source, 'ensure_file() {', '\nassert_sealed_source()'),
  ];

  for (const installer of installers) {
    const replacement = anchor(
      installer,
      'install-bootstrap-replacement-file.mjs"'
    );
    const expectedMetadata = installer.lastIndexOf('root_mode "$destination"');
    assert.ok(
      replacement < expectedMetadata,
      'only unapproved metadata drift may fail after the receipt-bound helper'
    );
    assert.match(
      installer,
      /root_mode "\$destination"[\s\S]*installed (?:file|line) drift/
    );
  }
});

test('installs the watchdog template before the first daemon reload or disable', () => {
  const bootstrap = sourceSlice(
    source,
    'bootstrap() {',
    'assert_bootstrap() {'
  );
  assert.ok(
    anchor(bootstrap, 'render_watchdog "$2"') <
      anchor(bootstrap, 'install_units')
  );
});

test('keeps the watchdog template installable for explicit campaign instances', async () => {
  const watchdogUnit = await readFile(
    new URL('./baci-cwv-campaign-watchdog@.service', import.meta.url),
    'utf8'
  );

  assert.match(watchdogUnit, /\[Install\][\s\S]*WantedBy=multi-user\.target/);
});

test('prepare keeps external bytes opaque until the watchdog and copies no-follow', () => {
  const prepare = sourceSlice(source, 'prepare() {', 'verify() {');
  const identity = anchor(prepare, 'lstat');
  const watchdog = anchor(prepare, 'campaign-quiesce.sh" prepare');
  const copy = anchor(prepare, 'install-input-copy.mjs" copy');
  assert.ok(identity >= 0 && identity < watchdog && watchdog < copy);
  assert.ok(anchor(prepare, 'trap prepare_cleanup') < watchdog);
  assert.match(
    prepare,
    /capture_sha=''; campaign_directory=''; supervisor_pid=''; supervisor_directory=''/
  );
  assert.match(
    prepare,
    /\[ -n "\$capture_sha" \] && \[ -n "\$campaign_directory" \]/
  );
  assert.doesNotMatch(prepare, /\/bin\/cp\s+--\s+"\$input"/);
  assert.doesNotMatch(prepare, /rm -rf/);
  assert.match(source, /--host=unix:\/\/\/run\/baci-cwv\/docker\.sock/);
  assert.match(prepare, /--network=none/);
  assert.match(prepare, /start_prepare_supervisor/);
  assert.match(source, /install-prepare-live-supervisor-cli\.mjs" watch/);
  assert.match(
    source,
    /systemd-run --quiet --scope --collect --slice=cwv-measurement-control\.slice/
  );
  assert.ok(
    anchor(prepare, 'start_prepare_supervisor') <
      anchor(prepare, 'systemctl start baci-cwv-containerd.service')
  );
  assert.ok(
    anchor(prepare, 'target runtime did not stop') <
      anchor(prepare, 'stop_prepare_supervisor')
  );
  const synthetic = anchor(prepare, 'install-prepare-synthetic.mjs');
  const targetLoad = anchor(prepare, 'load --input "$archive"');
  assert.ok(synthetic > 0 && synthetic < targetLoad);
  assert.match(prepare, /import "\$synthetic_archive"/);
  assert.match(prepare, /--network=none --read-only --label/);
  assert.match(prepare, /image rm "\$synthetic_image"/);
  assert.match(prepare, /synthetic runtime did not stop/);
  assert.doesNotMatch(prepare.slice(0, targetLoad), /run .*"\$image_id"/);
  const runtimeManifest = anchor(
    prepare,
    'runner-runtime-manifest-producer-cli.mjs" --write'
  );
  const runtimeValidation = anchor(
    prepare,
    'install-prepare-runtime-receipt.mjs" verify'
  );
  const accepted = anchor(prepare, 'accept-target');
  const published = anchor(prepare, 'install-prepare-acceptance.mjs" publish');
  assert.ok(
    anchor(prepare, 'build-receipt.json" 0600') < runtimeManifest &&
      runtimeManifest < runtimeValidation &&
      runtimeValidation < accepted &&
      accepted < published
  );
  for (const argument of [
    '--archive "$archive"',
    '--image-receipt "$state_directory/runner-runtime-image-receipt.json"',
    '--source-manifest-sha256',
    '--output-directory "$runtime_manifest_directory"',
    '--projection-directory "$state_directory/runner-runtime-projection"',
  ])
    assert.ok(prepare.includes(argument), argument);
  assert.match(
    prepare,
    /--source-manifest "\$ROOT\/source-receipts\/\$\{SCRIPT_DIR##\*\/\}\/manifest\.json"/
  );
  assert.match(
    prepare,
    /ensure_file "\$state_directory\/build-receipt\.json" "\$state_directory\/runner-runtime-image-receipt\.json" 0400 root:root/
  );
  assert.match(prepare, />"\$state_directory\/runner-runtime-producer\.json"/);
  assert.doesNotMatch(
    prepare.slice(runtimeManifest),
    /jq[^\n]*runner-runtime-producer\.json/
  );
  assert.ok(
    anchor(
      prepare,
      'journal "$ROOT/campaigns" "$transaction" start-dedicated-unit baci-cwv-containerd.service'
    ) < anchor(prepare, 'systemctl start baci-cwv-containerd.service')
  );
  assert.ok(
    anchor(
      prepare,
      'journal "$ROOT/campaigns" "$transaction" start-dedicated-unit baci-cwv-docker.service'
    ) < anchor(prepare, 'systemctl start baci-cwv-docker.service')
  );
  assert.match(acceptanceSource, /image-id\.sha256/);
  assert.ok(
    anchor(prepare, 'install-prepare-content-cleanup-cli.mjs" capture') <
      anchor(prepare, 'systemctl start baci-cwv-containerd.service')
  );
  assert.ok(
    anchor(prepare, 'install-prepare-content-cleanup-cli.mjs" activate') <
      anchor(prepare, 'systemctl start baci-cwv-containerd.service')
  );
});

test('verify is nonmutating and emits a canonical service-state digest', () => {
  const verify = sourceSlice(source, 'verify() {', '\nroot_required\n');
  assert.match(verify, /install-verify\.mjs/);
  assert.match(verify, /BOOTSTRAP_ROOT/);
  assert.match(verify, /PREPARE_ROOT/);
  assert.doesNotMatch(
    verify,
    /(?:\/usr\/bin\/install|\/bin\/(?:mv|rm)|systemctl\s+(?:start|stop|enable|disable)|docker\s+(?:load|run|rm))/
  );
  for (const value of [
    'readRunnerRuntimeReceipt',
    'readRunnerRuntimeManifest',
    'runner-runtime-context.json',
    'runner-runtime-manifest.json',
    'runner-runtime-image-receipt.json',
    'runtimeManifestSha256',
    "join(receiptRoot, 'runner-runtime')",
    'verifyRunnerRuntimeProjection',
  ])
    assert.ok(verifySource.includes(value), value);
});

test('registration accepts no caller authority and seals the command preparer runtime', () => {
  assert.match(
    source,
    /registration-terminal-receipt\.mjs registration-terminal-evidence\.mjs registration-terminal-lease-recovery\.mjs registration-command-prepare\.mjs registration-command-retry-block\.mjs registration-command-store\.mjs registration-retry-block\.mjs registration-runtime-contract\.mjs/
  );
  assert.match(
    source,
    /--register-token-stdin\) \[ "\$#" -eq 1 \] \|\| die 'invalid registration arguments'; root_runtime_controller register-token-stdin ;;/
  );
});
