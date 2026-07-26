import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { lstat, readFile } from 'node:fs/promises';
import test from 'node:test';

import { bootstrapFileSpecs } from './install-bootstrap-plan.mjs';

const root = new URL('./', import.meta.url);
const read = (name) => readFile(new URL(name, root), 'utf8');
const sources = [
  'baci-cwv-containerd.service',
  'baci-cwv-docker.service',
  'baci-cwv-host-sampler.service',
  'baci-cwv-host-sampler.timer',
  'baci-cwv-measurement.service',
  'cwv-measurement-control.slice',
  'cwv-measurement.slice',
  'containerd.toml',
  'daemon.json',
  'install.test.mjs',
  'install-control-surface.test.mjs',
];
const exactRunSources = [
  'exact-run-accounting.mjs',
  'exact-run-contract-cli.mjs',
  'exact-run-contract.mjs',
  'normal-release.mjs',
  'exact-run-controller.sh',
  'exact-run-live-sample-contract.mjs',
  'exact-run-process-contract.mjs',
  'exact-run-rearm-contract.mjs',
  'exact-run-terminal-cleanup.sh',
  'exact-run-transition-contract.mjs',
  'job-start-hook.sh',
];
const campaignQuiesceSources = [
  'archive-index.mjs',
  'campaign-lease-holder.sh',
  'campaign-source-closure.mjs',
  'install-prepare-content-safety.mjs',
  'rootfs-source-membership.mjs',
  'rootfs-source-membership-input.mjs',
  'source-tree-projection.mjs',
];

test('installer has a fixed, root-only, sealed-source control surface', async () => {
  // biome-ignore format: exact static contract stays compact
  const [script, metadata] = await Promise.all([read('install.sh'), lstat(new URL('install.sh', root))]);
  assert.equal(metadata.mode & 0o777, 0o755);
  // biome-ignore format: exact static contract stays compact
  for (const token of '--bootstrap-control|--prepare|--verify|must run from sealed exact source|owner frozen input digest mismatch|baci-cwv-containerd.service|baci-cwv-docker.service'.split('|')) assert.ok(script.includes(token), token);
  // biome-ignore format: exact static contract stays compact
  for (const forbidden of 'docker build|buildx|docker pull|/var/run/docker.sock|/var/lib/docker'.split('|')) assert.ok(!script.includes(forbidden), forbidden);
  // biome-ignore format: exact static contract stays compact
  assert.match(script, /root_runtime_controller\(\) \{\n {2}assert_bootstrap\n {2}exec \/usr\/bin\/node "\$SCRIPT_DIR\/root-runtime-executor\.mjs" "\$@"/);
  assert.match(
    script,
    /--register-token-stdin\) \[ "\$#" -eq 1 \] \|\| die 'invalid registration arguments'; root_runtime_controller register-token-stdin/
  );
  assert.match(
    script,
    /--probe-isolation\) \[ "\$#" -eq 2 \] \|\| die 'invalid isolation probe arguments'; root_runtime_controller probe-isolation "\$2"/
  );
  assert.match(
    script,
    /--probe-runtime-identity\) \[ "\$#" -eq 1 \] \|\| die 'invalid runtime identity probe arguments'; root_runtime_controller probe-runtime-identity/
  );
  assert.match(script, /job-start-hook\.sh.*0550.*root:baci-cwv/);
  assert.match(
    script,
    /install-account-identity\.sh"; regular "\$exec_account" \|\| die 'runner identity verifier required'/
  );
  assert.match(script, /watchdog unit drift/);
  assert.match(script, /watchdog unit install refused/);
  assert.match(script, /sealed credential must be root-only/);
  assert.doesNotMatch(script, /mv -f -- "\$temporary" "\$target"/);
  for (const name of sources) {
    const entry = await lstat(new URL(name, root));
    assert.ok(entry.isFile(), name);
    assert.equal(entry.mode & 0o777, 0o644, `${name} unsafe source mode`);
  }
});

test('runner identity verifier rejects collisions and requires a locked singleton', async () => {
  const source = await read('install-account-identity.sh');
  for (const token of [
    'runner group collision',
    'runner account collision',
    'runner supplementary group drift',
    'runner account must be locked',
    '/nonexistent',
    '/usr/sbin/nologin',
    'getent group',
    'getent passwd',
    '$4 == gid',
  ])
    assert.ok(source.includes(token), token);
  assert.doesNotMatch(source, /usermod --unlock|passwd -u/);
});

test('installs the closed exact-run helper execution tree, not only its plan inventory', async () => {
  const script = await read('install.sh');
  for (const name of exactRunSources) {
    assert.match(script, new RegExp(`\\b${name.replace('.', '\\.')}`));
    const entry = await lstat(new URL(name, root));
    assert.equal(entry.isFile(), true, name);
  }
});

test('installs every helper required by the campaign quiesce source closure', async () => {
  const script = await read('install.sh');
  for (const name of campaignQuiesceSources) {
    assert.match(script, new RegExp(`\\b${name.replace('.', '\\.')}`));
    const entry = await lstat(new URL(name, root));
    assert.equal(entry.isFile(), true, name);
  }
});

test('keeps the sealed installer helper inventory identical to the bootstrap plan', async () => {
  const script = await read('install.sh');
  const matches = [
    ...script.matchAll(
      /for name in ([^\n]+); do(?:\n\s+| )ensure_file "\$SCRIPT_DIR\/\$name" "\$ROOT\/sealed\/\$name" 0500/g
    ),
  ];
  assert.ok(matches.length, 'sealed helper install loop');
  const planned = bootstrapFileSpecs('d'.repeat(40))
    .filter(
      ({ destination, mode }) =>
        destination.startsWith('/srv/baci-cwv/sealed/') && mode === '0500'
    )
    .map(({ source }) => source);
  const direct = [
    ...script.matchAll(
      /ensure_file "\$SCRIPT_DIR\/([a-z0-9._-]+)" "\$ROOT\/sealed\/\1" 0500/g
    ),
  ].map((match) => match[1]);
  assert.deepEqual(
    matches
      .flatMap((match) => match[1].split(' '))
      .concat(direct)
      .sort(),
    planned.sort()
  );
});

test('exact-run installed helper modules and controller syntax are directly executable', () => {
  const directory = new URL('./', import.meta.url);
  const imports = exactRunSources.filter(
    (name) => name.endsWith('.mjs') && name !== 'exact-run-contract-cli.mjs'
  );
  const result = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '--eval',
      imports.map((name) => `await import('./${name}');`).join(''),
    ],
    { cwd: directory.pathname, encoding: 'utf8' }
  );
  assert.equal(result.status, 0, result.stderr);
  const cli = spawnSync(process.execPath, ['exact-run-contract-cli.mjs'], {
    cwd: directory.pathname,
    encoding: 'utf8',
  });
  assert.equal(cli.status, 1);
  assert.match(cli.stderr, /closed exact-run contract invocation required/);
  for (const file of ['exact-run-controller.sh', 'job-start-hook.sh']) {
    const shell = spawnSync('/bin/sh', ['-n', file], {
      cwd: directory.pathname,
      encoding: 'utf8',
    });
    assert.equal(shell.status, 0, `${file}: ${shell.stderr}`);
  }
});
