import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const controller = await readFile(
  new URL('./exact-run-controller.sh', import.meta.url),
  'utf8'
);
const abort = controller.slice(
  controller.indexOf('\nabort()'),
  controller.indexOf('\nrearm()')
);

test('bugfix: abort records a terminal pre-release proof without reading a release receipt', () => {
  assert.match(abort, /pre-release-abort\.json/);
  assert.match(
    abort,
    /artifacts\.release[\s\S]*pre-release-abort\.json[\s\S]*copy_receipt "\$RELEASE_ROOT\/release\.json"/
  );
  assert.match(
    abort,
    /pre-release-abort\.json[\s\S]*restore_transaction "\$directory"/
  );
});

test('bugfix: abort keeps cleanup armed until root runtime evidence is durable', () => {
  assert.match(
    abort,
    /write_pre_release_runtime "\$directory"[\s\S]*cleanup_armed=0/
  );
  assert.match(
    abort,
    /write_root_runtime "\$directory" "\$directory\/transport-observation\.json"[\s\S]*cleanup_armed=0/
  );
  for (const helper of [
    'write_root_runtime()',
    'write_pre_release_runtime()',
  ]) {
    const source = controller.slice(
      controller.indexOf(helper),
      controller.indexOf(helper) + 900
    );
    assert.match(source, /write_receipt "\$directory\/root-runtime\.json"/);
    assert.match(source, /write_receipt "\$directory\/root-runtime\.sha256"/);
    assert.match(source, /root_mode "\$directory\/root-runtime\.json" 600/);
  }
});

test('bugfix: begin validates and durably stages a binding before publishing campaign identity', () => {
  const begin = controller.slice(
    controller.indexOf('\nbegin()'),
    controller.indexOf('\ninspect_held_container()')
  );
  assert.match(begin, /staging="\$CONTROL_ROOT\/\.\$id\.begin-\$\$"/);
  for (const operation of [
    '/usr/bin/sync -f "$staging/binding.json"',
    '/usr/bin/sync -f "$staging"',
    '/bin/mv -T "$staging" "$directory"',
  ])
    assert.match(
      begin,
      new RegExp(operation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    );
  assert.ok(
    begin.indexOf('.campaignId == $id') <
      begin.indexOf('/bin/mv -T "$staging" "$directory"')
  );
});

test('bugfix: begin response loss recovers only the identical published binding and challenge', () => {
  const begin = controller.slice(
    controller.indexOf('\nbegin()'),
    controller.indexOf('\ninspect_held_container()')
  );
  const recovery = controller.slice(
    controller.indexOf('\nrecover_begin()'),
    controller.indexOf('\nbegin()')
  );
  assert.match(begin, /recover_begin/);
  assert.match(recovery, /digest "\$staging\/binding\.json"/);
  assert.match(recovery, /digest "\$directory\/binding\.json"/);
  assert.match(
    recovery,
    /root_mode "\$directory\/admission-challenge\.json" 600/
  );
  assert.match(recovery, /\/bin\/cat "\$directory\/admission-challenge\.json"/);
  assert.doesNotMatch(
    begin,
    /\/bin\/mv -T "\$staging" "\$directory"[\s\S]*\/bin\/mv -T "\$staging" "\$directory"/
  );
});

test('bugfix: begin recovery rejects a challenge from an earlier boot epoch', () => {
  const begin = controller.slice(
    controller.indexOf('\nbegin()'),
    controller.indexOf('\ninspect_held_container()')
  );
  const recovery = controller.slice(
    controller.indexOf('\nrecover_begin()'),
    controller.indexOf('\nbegin()')
  );
  assert.match(controller, /boot_id\(\).*\/proc\/sys\/kernel\/random\/boot_id/);
  assert.match(recovery, /--arg boot "\$boot"/);
  assert.match(recovery, /\.bootId == \$boot/);
  assert.match(begin, /create-challenge[^\n]*"\$boot"/);
});

test('bugfix: pre-release abort validates one exact bound generation and retains its terminal digest', () => {
  const abort = controller.slice(
    controller.indexOf('\nabort()'),
    controller.indexOf('\nrearm()')
  );
  assert.match(abort, /validate_terminal_trigger/);
  assert.match(abort, /cleanup_generation=\$generation/);
  assert.doesNotMatch(abort, /cleanup_generation=1/);
  const receipt = controller.slice(
    controller.indexOf('\nrestore_receipt()'),
    controller.indexOf('\nwrite_root_runtime()')
  );
  assert.match(receipt, /terminalProcessesSha256:\$terminal/);
  const runtime = controller.slice(
    controller.indexOf('\nwrite_root_runtime()'),
    controller.indexOf('\nverify_campaign_restored()')
  );
  assert.doesNotMatch(runtime, /del\(\.terminalProcessesSha256\)/);
});

test('bugfix: abort trigger extraction returns its validated state generation', async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), 'baci-cwv-abort-trigger-')
  );
  const trigger = path.join(directory, 'abort-trigger.json');
  const filter = controller.match(
    /validate_terminal_trigger\(\).*?'([^']+)' "\$directory\/abort-trigger\.json"/
  )?.[1];
  assert.ok(filter);
  try {
    await writeFile(
      trigger,
      '{"admissionId":"admission","attempt":1,"runId":2,"schemaVersion":1,"stateGeneration":7}\n'
    );
    const result = spawnSync(
      '/usr/bin/jq',
      [
        '-er',
        '--arg',
        'admission',
        'admission',
        '--arg',
        'binding',
        'binding',
        '--arg',
        'active',
        'binding',
        '--argjson',
        'attempt',
        '1',
        '--argjson',
        'run',
        '2',
        filter,
        trigger,
      ],
      { encoding: 'utf8' }
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, '7\n');
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test('bugfix: checksum producer failures cannot be masked by a successful parser', () => {
  const helper = controller.match(/^digest\(\).+$/m)?.[0];
  assert.ok(helper);
  const faultingHelper = helper.replace('/usr/bin/sha256sum', '/usr/bin/false');
  const result = spawnSync(
    '/bin/sh',
    ['-c', `${faultingHelper}\ndigest /unreadable`],
    { encoding: 'utf8' }
  );
  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, '');
  assert.equal(
    controller.match(/\/usr\/bin\/sha256sum/g)?.length,
    1,
    'every checksum call must use the failure-preserving helper'
  );
  assert.doesNotMatch(controller, /sha256sum[^\n]*\|[^\n]*cut/);
});

test('bugfix: release verifies the active transaction before every mutation', () => {
  const release = controller.slice(
    controller.indexOf('\nrelease()'),
    controller.indexOf('\ncomplete_run()')
  );
  const verification = release.indexOf('verify_active_transaction "$id"');
  assert.notEqual(verification, -1);
  for (const mutation of [
    'cleanup_armed=1',
    '/usr/bin/dd of="$directory/inventory.json"',
    'create-final-allow',
    'bind_artifact "$directory" allow',
    'install_json "$directory/allow.json"',
    'bind_artifact "$directory" inventory',
    'install_json "$directory/inventory-receipt.json"',
    'bind_artifact "$directory" release',
    'install_json "$directory/release.json"',
  ])
    assert.ok(verification < release.indexOf(mutation), mutation);
});

test('bugfix: release atomically publishes the one group-readable active admission', () => {
  const helper = controller.slice(
    controller.indexOf('install_json()'),
    controller.indexOf('\n\ncanonical_json()')
  );
  const release = controller.slice(
    controller.indexOf('\nrelease()'),
    controller.indexOf('\ncomplete_run()')
  );
  assert.match(
    helper,
    /temporary="\$destination\.tmp-\$\$"[\s\S]*chown "root:\$group" "\$temporary"[\s\S]*chmod "\$mode" "\$temporary"[\s\S]*sync -f "\$temporary"[\s\S]*mv -T "\$temporary" "\$destination"[\s\S]*sync -f "\$\(\/usr\/bin\/dirname -- "\$destination"\)"/
  );
  assert.match(
    release,
    /install_json "\$directory\/allow\.json" "\$ALLOW_ROOT\/active\.json" 0440 baci-cwv/
  );
});

test('bugfix: release checks the policy controller deadline before every terminal poll', () => {
  const release = controller.slice(
    controller.indexOf('\nrelease()'),
    controller.indexOf('\ncomplete_run()')
  );
  assert.match(
    release,
    /policy \/repositoryAuthority\/controllerTimeoutSeconds/
  );
  assert.match(release, /terminal_deadline/);
  assert.match(
    release,
    /while \/bin\/systemctl is-active[^\n]*before_controller_deadline "\$terminal_deadline"/
  );
  assert.match(
    release,
    /\/usr\/bin\/timeout --signal=TERM --kill-after=1s "\$\(\(terminal_deadline - \$\(monotonic\)\)\)s" \/usr\/bin\/docker --host/
  );
  const helper = controller.match(
    /before_controller_deadline\(\) \{[^}]+\}/
  )?.[0];
  assert.ok(helper);
  const result = spawnSync(
    '/bin/sh',
    [
      '-c',
      `monotonic() { printf '%s\\n' 10; }\n${helper}\nbefore_controller_deadline 10`,
    ],
    { encoding: 'utf8' }
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /controller timeout/);
});
