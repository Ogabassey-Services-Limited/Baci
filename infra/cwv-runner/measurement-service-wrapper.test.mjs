// biome-ignore-all format: compact service fixtures preserve focused contract readability.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const wrapper = new URL('./measurement-service-wrapper.sh', import.meta.url);
const image = `BACI_CWV_IMAGE_ID=sha256:${'a'.repeat(64)}\n`;
const dynamic = [
  'BACI_CWV_CAMPAIGN_ID=campaign-1',
  `BACI_CWV_CAPTURE_SHA256=${'b'.repeat(64)}`,
  'BACI_CWV_LISTENER_RELEASE_DEADLINE_MONOTONIC_SECONDS=3600',
  'BACI_CWV_LISTENER_RELEASE_NOT_BEFORE_MONOTONIC_SECONDS=1800',
].join('\n');

async function inputs(root) {
  const imagePath = join(root, 'image-id');
  const receiptPath = join(root, 'image-id.sha256');
  const dynamicPath = join(root, 'measurement.env');
  await Promise.all([
    writeFile(imagePath, image),
    writeFile(
      receiptPath,
      `${createHash('sha256').update(image).digest('hex')}\n`
    ),
    writeFile(dynamicPath, `${dynamic}\n`),
  ]);
  await Promise.all([
    chmod(imagePath, 0o644),
    chmod(receiptPath, 0o644),
    chmod(dynamicPath, 0o440),
  ]);
  return {
    dynamicPath,
    imagePath,
    receiptPath,
    snapshotPath: join(root, 'input.env'),
  };
}

function invoke(args) {
  const harness = `
    MEASUREMENT_SERVICE_WRAPPER_LIBRARY=1 source ${JSON.stringify(wrapper.pathname)}
    stat_identity() {
      case "$1" in
        */measurement.env) printf '%s' 0:0:440 ;;
        */image-id|*/image-id.sha256) printf '%s' 0:0:644 ;;
        */input.env|*/.measurement-service.*) printf '%s' 0:0:400 ;;
        *) printf '%s' 0:0:700 ;;
      esac
    }
    baci_cwv_gid() { printf '%s' 0; }
    [ "$1" = prepare ]
    prepare "\${@:2}"
  `;
  return spawnSync(
    '/bin/bash',
    ['-ceu', harness, 'measurement-wrapper-test', ...args],
    {
      encoding: 'utf8',
    }
  );
}

test('creates a validated root-only snapshot that remains independent from the source files', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'baci-measurement-wrapper-'));
  context.after(() => rm(root, { force: true, recursive: true }));
  const input = await inputs(root);

  const result = invoke([
    'prepare',
    input.snapshotPath,
    input.imagePath,
    input.receiptPath,
    input.dynamicPath,
  ]);

  assert.equal(result.status, 0, result.stderr);
  await chmod(input.dynamicPath, 0o644);
  await writeFile(input.dynamicPath, 'BACI_CWV_CAMPAIGN_ID=swapped\n');
  assert.equal(
    await readFile(input.snapshotPath, 'utf8'),
    `${image}${dynamic}\n`
  );
  assert.equal(
    (await readFile(input.snapshotPath)).length,
    Buffer.byteLength(`${image}${dynamic}\n`)
  );
});

test('accepts the installer-produced bare image digest receipt', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'baci-measurement-wrapper-'));
  context.after(() => rm(root, { force: true, recursive: true }));
  const input = await inputs(root);
  await writeFile(
    input.receiptPath,
    `${createHash('sha256').update(image).digest('hex')}\n`
  );

  const result = invoke([
    'prepare',
    input.snapshotPath,
    input.imagePath,
    input.receiptPath,
    input.dynamicPath,
  ]);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(await readFile(input.snapshotPath, 'utf8'), `${image}${dynamic}\n`);
});

test('refuses a bad first static input even when the receipt is valid', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'baci-measurement-wrapper-'));
  context.after(() => rm(root, { force: true, recursive: true }));
  const input = await inputs(root);
  await writeFile(input.imagePath, 'invalid\n');

  const result = invoke([
    'prepare',
    input.snapshotPath,
    input.imagePath,
    input.receiptPath,
    input.dynamicPath,
  ]);

  assert.notEqual(result.status, 0);
  await assert.rejects(readFile(input.snapshotPath));
});

test('refuses post-start values in the pre-start snapshot', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'baci-measurement-wrapper-'));
  context.after(() => rm(root, { force: true, recursive: true }));
  const input = await inputs(root);
  await chmod(input.dynamicPath, 0o644);
  await writeFile(
    input.dynamicPath,
    `${dynamic}\nBACI_CWV_CLASSIFIER_SHA256=${'c'.repeat(64)}\n`
  );
  await chmod(input.dynamicPath, 0o440);

  const result = invoke([
    'prepare',
    input.snapshotPath,
    input.imagePath,
    input.receiptPath,
    input.dynamicPath,
  ]);

  assert.notEqual(result.status, 0);
  await assert.rejects(readFile(input.snapshotPath));
});

test('only accepts a confirmed absent-container response during stop', () => {
  const harness = `
    MEASUREMENT_SERVICE_WRAPPER_LIBRARY=1 source ${JSON.stringify(wrapper.pathname)}
    docker_stop() { return 1; }
    docker_inspect() { printf '%s\\n' 'Error response from daemon: No such container: baci-cwv-measurement' >&2; return 1; }
    stop_measurement
  `;
  const result = spawnSync('/bin/bash', ['-ceu', harness], {
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
});

test('preserves a stop failure when Docker cannot confirm container absence', () => {
  const harness = `
    MEASUREMENT_SERVICE_WRAPPER_LIBRARY=1 source ${JSON.stringify(wrapper.pathname)}
    docker_stop() { return 73; }
    docker_inspect() { printf '%s\\n' 'Cannot connect to the Docker daemon' >&2; return 1; }
    stop_measurement
  `;
  const result = spawnSync('/bin/bash', ['-ceu', harness], {
    encoding: 'utf8',
  });
  assert.equal(result.status, 73, result.stderr);
});
