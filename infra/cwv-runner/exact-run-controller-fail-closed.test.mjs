import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const controller = await readFile(
  new URL('./exact-run-controller.sh', import.meta.url),
  'utf8'
);
const hash = (value) => createHash('sha256').update(value).digest('hex');
const canonicalTransaction = (artifacts, binding, capture, schemaVersion = 1) =>
  `${JSON.stringify({ artifacts, campaignId: 'campaign', captureSha256: capture, controllerBindingSha256: binding, generation: 1, schemaVersion })}\n`;

function harness(paths, source, program) {
  const withoutDispatch = source.slice(0, source.indexOf('\n[ "$#" -eq 2 ]'));
  return `${withoutDispatch
    .replace(/^STATE_ROOT=.*$/m, `STATE_ROOT=${paths.state}`)
    .replace(/^CONTROL_ROOT=.*$/m, `CONTROL_ROOT=${paths.control}`)
    .replace(/^ALLOW_ROOT=.*$/m, `ALLOW_ROOT=${paths.allow}`)
    .replace(/^INVENTORY_ROOT=.*$/m, `INVENTORY_ROOT=${paths.inventory}`)
    .replace(/^RELEASE_ROOT=.*$/m, `RELEASE_ROOT=${paths.release}`)
    .replace(/^ENV_FILE=.*$/m, `ENV_FILE=${paths.environment}`)
    .replace(/^SAMPLER_ENV=.*$/m, `SAMPLER_ENV=${paths.sampler}`)
    .replace(
      /^root_file\(\) \{[^\n]*\}/m,
      'root_file() { [ -f "$1" ] && [ ! -L "$1" ]; }'
    )
    .replace(/^root_mode\(\) \{[^\n]*\}/m, 'root_mode() { root_file "$1"; }')
    .replace(
      /^digest\(\).+$/m,
      'digest() { /sbin/sha256sum -- "$1" | /usr/bin/awk \'{print $1}\'; }'
    )
    .replace(
      /boot_id\(\) \{.*?\}; before_controller_deadline/,
      "boot_id() { printf '%s\\n' '11111111-1111-4111-8111-111111111111'; }; before_controller_deadline"
    )
    .replace('/bin/rmdir -- "$staging"', '/bin/rmdir "$staging"')
    .replace('/usr/bin/sync -f "$CONTROL_ROOT"', ':')}
${program}`;
}

async function withPaths(callback) {
  const root = await mkdtemp(path.join(tmpdir(), 'baci-cwv-fail-closed-'));
  const paths = {
    allow: path.join(root, 'allow'),
    control: path.join(root, 'control'),
    environment: path.join(root, 'measurement.env'),
    inventory: path.join(root, 'inventory'),
    marker: path.join(root, 'marker'),
    sampler: path.join(root, 'sampler.env'),
    state: path.join(root, 'state'),
  };
  await Promise.all(
    [paths.allow, paths.control, paths.inventory, paths.state].map((value) =>
      mkdir(value)
    )
  );
  try {
    await callback(paths);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
}

function run(paths, source, program) {
  return spawnSync('/bin/sh', ['-c', harness(paths, source, program)], {
    encoding: 'utf8',
    timeout: 3000,
  });
}

async function writeActiveTransaction(paths, artifacts, schemaVersion = 1) {
  const directory = path.join(paths.control, 'campaign');
  const state = path.join(paths.state, 'campaign');
  const binding = '{}\n';
  const capture = '{"capture":true}\n';
  await Promise.all([mkdir(directory), mkdir(state)]);
  await Promise.all([
    writeFile(path.join(directory, 'binding.json'), binding),
    writeFile(path.join(state, 'capture.json'), capture),
    writeFile(path.join(state, 'capture.sha256'), `${hash(capture)}\n`),
    writeFile(
      path.join(directory, 'active-transaction.json'),
      canonicalTransaction(
        artifacts,
        hash(binding),
        hash(capture),
        schemaVersion
      )
    ),
  ]);
}

test('bugfix: rearm rejects an invalid transaction even when every artifact is null', async () => {
  await withPaths(async (paths) => {
    await writeActiveTransaction(
      paths,
      {
        allow: null,
        environment: null,
        inventory: null,
        release: null,
        samplerEnvironment: null,
      },
      2
    );
    const source = controller.replace(
      '  for receipt in abort-trigger binding release-installed restore-receipt root-runtime transport-observation; do',
      `  : >"${paths.marker}"; return 0\n  for receipt in abort-trigger binding release-installed restore-receipt root-runtime transport-observation; do`
    );
    const result = run(paths, source, 'rearm campaign');
    assert.notEqual(result.status, 0, `${result.stdout}\n${result.stderr}`);
    await assert.rejects(() => readFile(paths.marker));
  });
});

test('bugfix: malformed artifact digest cannot pass when its artifact path is absent', async () => {
  await withPaths(async (paths) => {
    await writeActiveTransaction(paths, {
      allow: 'invalid',
      environment: null,
      inventory: null,
      release: null,
      samplerEnvironment: null,
    });
    const result = run(
      paths,
      controller,
      `ACTIVE_TRANSACTION="${paths.control}/campaign/active-transaction.json"\nverify_artifact allow "$ALLOW_ROOT/active.json" && : >"${paths.marker}"`
    );
    assert.notEqual(result.status, 0, result.stderr);
    await assert.rejects(() => readFile(paths.marker));
  });
});

test('bugfix: begin recovery retains staging when the published challenge is invalid', async () => {
  await withPaths(async (paths) => {
    const directory = path.join(paths.control, 'campaign');
    const staging = path.join(paths.control, '.campaign.begin');
    await Promise.all([mkdir(directory), mkdir(staging)]);
    await Promise.all([
      writeFile(path.join(directory, 'binding.json'), '{}\n'),
      writeFile(path.join(staging, 'binding.json'), '{}\n'),
      writeFile(path.join(directory, 'admission-challenge.json'), '{}\n'),
    ]);
    const source = controller.replace(
      '[ -d "$directory" ] && [ ! -L "$directory" ] && [ "$(/usr/bin/stat -c \'%u:%a\' -- "$directory")" = 0:700 ] && root_mode',
      '[ -d "$directory" ] && [ ! -L "$directory" ] && root_mode'
    );
    const result = run(
      paths,
      source,
      `if recover_begin "${directory}" "${staging}"; then : >"${paths.marker}"; fi`
    );
    assert.equal(result.status, 0, result.stderr);
    await readFile(path.join(staging, 'binding.json'));
    await assert.rejects(() => readFile(paths.marker));
  });
});
