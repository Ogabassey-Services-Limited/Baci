import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  copyFile,
  readFile,
  rm,
  symlink,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

import {
  fixtureImageId,
  runFixture,
  runtimeFixture,
} from './container-attestation-fixture.mjs';

const scriptUrl = new URL('./container-attest.sh', import.meta.url);
const runtimeUrl = new URL('./container-attest-runtime.mjs', import.meta.url);
const contractUrl = new URL('./identity-contract.json', import.meta.url);

const source = () => readFile(scriptUrl, 'utf8');
const runtimeSource = () => readFile(runtimeUrl, 'utf8');

function collectFunction(shell) {
  const start = shell.indexOf('collect() {');
  const end = shell.indexOf(`\n\ncase "\${1-}" in`, start);
  assert.ok(start >= 0 && end > start, 'runtime collector is present');
  return shell.slice(start, end);
}

test('runtime identity collector is an exact, closed interface', async () => {
  const shell = await source();

  assert.match(shell, /case "\$\{1-\}" in\n {2}--identity-runtime\)/);
  assert.match(
    shell,
    /\[ "\$#" -eq 1 \] \|\| die 'invalid runtime identity arguments'/
  );
  assert.match(
    shell,
    /PATH=\/usr\/local\/sbin:\/usr\/local\/bin:\/usr\/sbin:\/usr\/bin:\/sbin:\/bin/
  );
  assert.match(shell, /LC_ALL=C\.UTF-8/);
  assert.match(shell, /TZ=Etc\/UTC/);
  assert.match(shell, /timeout 15s/);
  assert.doesNotMatch(shell, /\beval\b|\bprintenv\b|\/proc\/[^\s]*environ/i);
});

test('fixture uses the shipped canonical helper and bounds the child collector', async () => {
  const fixture = await readFile(
    new URL('./container-attestation-fixture.mjs', import.meta.url),
    'utf8'
  );
  assert.match(
    fixture,
    /import \{ canonicalJson \} from '\.\/canonical-json\.mjs'/
  );
  assert.match(
    fixture,
    /new URL\('\.\/canonical-json\.mjs', import\.meta\.url\)/
  );
  assert.match(fixture, /timeout: 15_000/);
});

test('runtime collector reads the canonical image authority and companion digest', async () => {
  const shell = await source();

  assert.match(shell, /^readonly IMAGE_FILE=\/srv\/baci-cwv\/image-id$/m);
  assert.match(
    shell,
    /^readonly IMAGE_SHA_FILE=\/srv\/baci-cwv\/image-id\.sha256$/m
  );
  assert.doesNotMatch(shell, /\/srv\/baci-cwv\/sealed\/image-id/);
  assert.match(shell, /sha256sum -- "\$IMAGE_FILE"/);
  assert.match(shell, /runtime image id receipt drift/);
});

test('runtime collector turns image authority failures into a controlled refusal', async () => {
  const shell = await source();
  const result = spawnSync(
    '/bin/sh',
    [
      '-ceu',
      `die() { /usr/bin/printf '%s\\n' "$1" >&2; exit 65; }
image_id() { return 73; }
${collectFunction(shell)}
collect`,
    ],
    { encoding: 'utf8' }
  );
  assert.equal(result.status, 65, result.stderr);
  assert.match(result.stderr, /runtime image id collection failed/);
});

test('runtime probe is offline and mounts only its reviewed image and binary projection', async () => {
  const shell = await source();

  assert.match(shell, /readonly SOCKET=unix:\/\/\/run\/baci-cwv\/docker\.sock/);
  assert.match(shell, /docker --host "\$SOCKET" run/);
  assert.match(shell, /--pull=never/);
  assert.match(shell, /--rm/);
  assert.match(shell, /--network=none/);
  assert.match(shell, /--read-only/);
  assert.match(shell, /--cap-drop=ALL/);
  assert.match(shell, /--security-opt=no-new-privileges=true/);
  assert.match(
    shell,
    /readonly PROJECTION=\/srv\/baci-cwv\/sealed\/runtime-runner-binaries/
  );
  assert.match(shell, /--volume="\$PROJECTION:\/opt\/runner:ro"/);
  assert.match(shell, /--entrypoint=\/opt\/node\/bin\/node/);
  assert.match(shell, /\/opt\/baci-cwv\/container-attest-runtime\.mjs/);
  assert.doesNotMatch(
    shell,
    /\.credentials|\.env|hook|admission|token|\/proc|\/sys/i
  );
  assert.doesNotMatch(shell, /--network(?:=|\s+)(?!none\b)/);
});

test('runtime projection collects only exact Chrome, Node, pnpm, and shared runner rows', async () => {
  const collector = await runtimeSource();

  for (const path of [
    '/usr/bin/google-chrome-stable',
    '/opt/node/bin/node',
    '/opt/pnpm/package.json',
    '/opt/runner/identity-contract.json',
  ])
    assert.match(
      collector,
      new RegExp(path.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    );
  assert.match(
    collector,
    /const pnpmProgram = rootFile\(`\/opt\/pnpm\/\$\{packageProjection\.bin\}`\)/
  );
  assert.match(collector, /\[pnpmProgram\.executablePath, '--version'\]/);
  assert.doesNotMatch(collector, /corepack|pnpm(?:\s+--version)/i);
  assert.match(collector, /runtimeRunnerBinaryDigest/);
  assert.match(collector, /runtimeContract\.runnerFiles\.map/);
  assert.match(collector, /\/usr\/bin\/dpkg-query/);
  assert.match(collector, /debianPackage/);
  assert.match(
    collector,
    /import \{ canonicalJson \} from '\.\/canonical-json\.mjs'/
  );
  assert.match(collector, /rootFile\('\/opt\/baci-cwv\/canonical-json\.mjs'\)/);
  assert.doesNotMatch(
    collector,
    /canonicalRuntimeJson|pathToFileURL|execFileSync/
  );
  assert.match(collector, /chromeVersion/);
  assert.match(collector, /node/);
  assert.match(collector, /pnpm/);
  assert.match(collector, /runner/);
  assert.match(collector, /source: 'runtime'/);
  assert.doesNotMatch(collector, /docker|\/run\/baci-cwv|IMAGE_FILE/);
});

test('runtime contract freezes the exact pnpm package entrypoint used at runtime', async () => {
  const contract = JSON.parse(await readFile(contractUrl, 'utf8'));
  assert.deepEqual(contract.builderSources.runtime.pnpm.packageProjection, {
    bin: 'bin/pnpm.cjs',
    name: 'pnpm',
    version: '11.7.0',
  });
});

test('runtime evidence refuses projection drift and emits canonical JSON only', async () => {
  const [shell, collector] = await Promise.all([source(), runtimeSource()]);

  for (const refusal of [
    'projection missing',
    'projection mode drift',
    'runtime runner binary digest mismatch',
  ])
    assert.match(collector, new RegExp(refusal));
  assert.match(shell, /runtime attestation must be canonical/);
  assert.match(shell, /jq -e -cS/);
  assert.match(collector, /createHash\('sha256'\)/);
  assert.doesNotMatch(shell, /docker inspect[^\n]*Config\.Env/i);
});

test('runtime probe targets the in-container collector rather than the host wrapper', async () => {
  const controller = await readFile(
    new URL('./runtime-probe-controller.mjs', import.meta.url),
    'utf8'
  );
  const runtime = controller.slice(
    controller.indexOf('export function runtimeIdentityProbeArgv')
  );
  assert.match(runtime, /--entrypoint=\/opt\/node\/bin\/node/);
  assert.match(runtime, /\/opt\/baci-cwv\/container-attest-runtime\.mjs/);
  assert.doesNotMatch(
    runtime,
    /--entrypoint=\/opt\/baci-cwv\/container-attest\.sh/
  );
});

test('in-container collector executes against a real-shaped runtime projection', async (context) => {
  const fixture = await runtimeFixture();
  context.after(() => rm(fixture.root, { force: true, recursive: true }));
  const result = await runFixture(fixture.root);
  assert.equal(result.status, 0, result.stderr);
  const envelope = JSON.parse(result.stdout);
  const payload = JSON.parse(envelope.canonical);
  assert.deepEqual(payload, fixture.runtime);
  assert.equal(payload.imageId, fixtureImageId);
  assert.deepEqual(
    payload.runtimeRunner.files.map(({ path }) => path),
    ['bin/Runner.Listener', 'bin/Runner.Worker', 'entrypoint.mjs']
  );
});

test('in-container collector refuses target, symlink, package, manifest, and image drift', async (context) => {
  const cases = [
    async (fixture) => {
      const link = join(fixture.root, 'usr/bin/google-chrome-stable');
      const alternate = join(
        fixture.root,
        'opt/google/chrome/google-chrome-alternate'
      );
      await copyFile(
        join(fixture.root, 'opt/google/chrome/google-chrome'),
        alternate
      );
      await unlink(link);
      await symlink('/opt/google/chrome/google-chrome-alternate', link);
      const manifestPath = join(
        fixture.root,
        'opt/runner/runtime-manifest.json'
      );
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
      manifest.chromeTargetPath = '/opt/google/chrome/google-chrome-alternate';
      await writeFile(manifestPath, JSON.stringify(manifest));
    },
    async (fixture) => {
      const path = join(fixture.root, 'usr/bin/google-chrome-stable');
      await unlink(path);
      await symlink('../../opt/google/chrome/google-chrome', path);
    },
    async (fixture) => {
      const path = join(fixture.root, 'usr/bin/google-chrome-stable');
      await unlink(path);
      await symlink('../../../../etc/passwd', path);
    },
    async (fixture) => {
      const path = join(fixture.root, 'opt/pnpm/bin/pnpm.cjs');
      await unlink(path);
      await symlink('pnpm-real.cjs', path);
    },
    async (fixture) => {
      const path = join(fixture.root, 'opt/pnpm/package.json');
      await writeFile(
        path,
        JSON.stringify({
          bin: { pnpm: 'bin/pnpm-other.cjs' },
          name: 'pnpm',
          version: '11.7.0',
        })
      );
    },
    async (fixture) => {
      const path = join(fixture.root, 'opt/runner/runtime-manifest.json');
      const manifest = JSON.parse(await readFile(path, 'utf8'));
      manifest.schemaVersion = 2;
      await writeFile(path, JSON.stringify(manifest));
    },
  ];
  for (const mutate of cases) {
    const fixture = await runtimeFixture();
    context.after(() => rm(fixture.root, { force: true, recursive: true }));
    await mutate(fixture);
    assert.notEqual((await runFixture(fixture.root)).status, 0);
  }
  const fixture = await runtimeFixture();
  context.after(() => rm(fixture.root, { force: true, recursive: true }));
  assert.notEqual(
    (await runFixture(fixture.root, `sha256:${'f'.repeat(64)}`)).status,
    0
  );
});

test('in-container collector accepts the production root without treating it as an escape', async () => {
  const result = await runFixture('/');
  assert.notEqual(result.status, 0);
  assert.doesNotMatch(result.stderr, /runtime path escape/);
});
