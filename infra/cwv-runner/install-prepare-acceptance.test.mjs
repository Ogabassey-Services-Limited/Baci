import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
// biome-ignore format: exact test source remains under the repository cap.
import { chmod, lstat, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { processAuthority } from './host-idle-process-authority.fixture.mjs';
import { assertProcesses } from './host-idle-process-authority.mjs';
import {
  buildReceipt,
  canonical,
  DIGEST,
  IMAGE,
  processMap,
  removeRequiredRuntimeFile,
  stageRunnerRuntimeReceipt,
} from './install-prepare-acceptance.fixture.mjs';
import { publishAcceptedPrepare } from './install-prepare-acceptance.mjs';
import {
  acceptPreparedTarget,
  armPrepareWatchdog,
  capturePrepare,
  proveSyntheticContainment,
  verifyPreparedCopies,
} from './install-prepare-controller.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
// biome-ignore format: exact fixture remains below the repository cap.
async function fixture(context, receipt = buildReceipt, receiptBytes = canonical(receipt)) {
  const directory = await mkdtemp(join(tmpdir(), 'baci-accept-state-'));
  const root = await mkdtemp(join(tmpdir(), 'baci-accept-root-'));
  context.after(async () => {
    for (const path of [
      join(directory, 'runner-runtime-projection/bin'),
      join(directory, 'runner-runtime-projection'),
      join(root, 'sealed/runtime-runner-binaries/bin'),
      join(root, 'sealed/runtime-runner-binaries'),
    ])
      await chmod(path, 0o755).catch(() => undefined);
    await Promise.all([
      rm(directory, { recursive: true, force: true }),
      rm(root, { recursive: true, force: true }),
    ]);
  });
  await Promise.all([chmod(directory, 0o700), chmod(root, 0o700)]);
  await mkdir(join(root, 'sealed'), { mode: 0o700 });
  const bytes = Buffer.from(receiptBytes); const receiptSha256 = sha256(bytes);
  await capturePrepare(directory, {
    transactionId: 'prepare-accept',
    external: {
      archive: { path: '/owner/image.tar', device: '1', inode: '2' },
      receipt: { path: '/owner/build.json', device: '1', inode: '3' },
    },
    expected: { archiveSha256: 'a'.repeat(64), receiptSha256 },
    sourceManifestSha256: 'd'.repeat(64),
    policyFileSha256: 'e'.repeat(64),
  });
  await armPrepareWatchdog(directory, '4'.repeat(64));
  await verifyPreparedCopies(directory, {
    archiveSha256: 'a'.repeat(64),
    receiptSha256,
    buildReceipt: receipt,
  });
  await proveSyntheticContainment(directory, {
    networkMode: 'none',
    cleaned: true,
    productionUnchanged: true,
    dedicatedSocket: '/run/baci-cwv/docker.sock',
  });
  await acceptPreparedTarget(directory, {
    imageId: IMAGE,
    imageConfigDigest: IMAGE,
    productionUnchanged: true,
    supervisorReceiptSha256: '5'.repeat(64),
  });
  await writeFile(join(directory, 'build-receipt.json'), bytes, {
    mode: 0o600,
  });
  await stageRunnerRuntimeReceipt(directory);
  return { directory, root, bytes, receiptSha256 };
}
// biome-ignore format: exact helper remains below the repository cap.
async function replaceReceipt(directory, receipt, receiptBytes = canonical(receipt)) {
  const bytes = Buffer.from(receiptBytes);
  const statePath = join(directory, 'prepare-state.json');
  const state = JSON.parse(await readFile(statePath, 'utf8'));
  state.expected.receiptSha256 = sha256(bytes);
  const { stateSha256: _, ...unsigned } = state;
  const stateBytes = canonical({
    ...unsigned,
    stateSha256: sha256(canonical(unsigned)),
  });
  await writeFile(join(directory, 'build-receipt.json'), bytes, {
    mode: 0o600,
  });
  await writeFile(statePath, stateBytes, { mode: 0o600 });
}
// biome-ignore format: exact receipt recovery fixture remains below the repository cap.
test('publishes the canonical Task1 process map and idempotently retains exact receipt bytes', async (context) => {
  const { directory, root, bytes, receiptSha256 } = await fixture(context);
  await mkdir(join(root, 'receipts', 'runner-runtime'), { mode: 0o700, recursive: true });
  const stale = join(root, 'receipts', 'runner-runtime', '.runner-runtime-context.json-prepare-accept-123');
  await writeFile(stale, 'interrupted', { mode: 0o400 });
  assert.ok(
    processMap.sealed.some(
      ({ path }) => path === '/opt/baci-cwv/rootfs-source-inventory.json'
    )
  );
  const first = await publishAcceptedPrepare(directory, root);
  const second = await publishAcceptedPrepare(directory, root);
  assert.deepEqual(first, second);
  await assert.rejects(lstat(stale), { code: 'ENOENT' });
  assert.equal(
    await readFile(join(root, 'image-id'), 'utf8'),
    `BACI_CWV_IMAGE_ID=${IMAGE}\n`
  );
  assert.deepEqual(await readFile(join(root, 'image-receipt.json')), bytes);
  assert.equal(
    (await readFile(join(root, 'image-receipt.sha256'), 'utf8')).trim(),
    receiptSha256
  );
  const mapBytes = Buffer.from(canonical(processMap));
  assert.deepEqual(
    await readFile(join(root, 'receipts', 'image-process-map.json')),
    mapBytes
  );
  assert.equal(
    (
      await readFile(join(root, 'receipts', 'image-process-map.sha256'), 'utf8')
    ).trim(),
    sha256(mapBytes)
  );
  const directoryDetails = await lstat(join(root, 'receipts'));
  assert.equal(directoryDetails.mode & 0o777, 0o700);
  assert.equal(directoryDetails.uid, process.getuid());
  assert.equal(directoryDetails.gid, process.getgid());
  for (const name of ['image-process-map.json', 'image-process-map.sha256']) {
    const details = await lstat(join(root, 'receipts', name));
    assert.equal(details.mode & 0o777, 0o400);
    assert.equal(details.uid, process.getuid());
    assert.equal(details.gid, process.getgid());
  }
  for (const name of [
    'runner-runtime-context.json',
    'runner-runtime-context.json.sha256',
    'runner-runtime-identity-manifest.json',
    'runner-runtime-identity-manifest.json.sha256',
    'runner-runtime-manifest.json',
    'runner-runtime-manifest.json.sha256',
  ]) {
    const published = join(root, 'receipts', 'runner-runtime', name);
    assert.deepEqual(
      await readFile(published),
      await readFile(join(directory, 'runner-runtime', name))
    );
    assert.equal((await lstat(published)).mode & 0o777, 0o400);
  }
  assert.equal(
    (await lstat(join(root, 'sealed/runtime-runner-binaries'))).mode & 0o777,
    0o555
  );
});
test('rejects missing, extra, or reordered Task1 sealed process-map paths', async (context) => {
  const mutations = [
    (sealed) =>
      sealed.filter(
        ({ path }) => path !== '/opt/baci-cwv/rootfs-source-inventory.json'
      ),
    (sealed) => [
      ...sealed,
      {
        ...sealed.at(-1),
        path: '/opt/baci-cwv/unapproved-extra',
        realpath: '/opt/baci-cwv/unapproved-extra',
      },
    ],
    (sealed) => [sealed[1], sealed[0], ...sealed.slice(2)],
  ];
  for (const mutate of mutations) {
    const { directory, root } = await fixture(context);
    const receipt = structuredClone(buildReceipt);
    receipt.processMap.sealed = mutate(receipt.processMap.sealed);
    await replaceReceipt(directory, receipt);
    await assert.rejects(
      publishAcceptedPrepare(directory, root),
      /image process map/
    );
    await assert.rejects(lstat(join(root, 'image-id')), { code: 'ENOENT' });
  }
});
test('fails closed before publishing an invalid staged runtime closure', async (context) => {
  const { directory, root } = await fixture(context);
  await removeRequiredRuntimeFile(directory);
  await assert.rejects(
    publishAcceptedPrepare(directory, root),
    /runner runtime receipt reader refused/
  );
  await assert.rejects(lstat(join(root, 'image-id')), { code: 'ENOENT' });
});
test('fails closed for missing, malformed, noncanonical, or image-mismatched process map receipts', async (context) => {
  const missing = { ...buildReceipt };
  delete missing.processMap;
  const malformed = structuredClone(buildReceipt);
  malformed.processMap.entries[0].extra = true;
  const mismatch = {
    ...buildReceipt,
    configDigest: `sha256:${'c'.repeat(64)}`,
  };
  for (const [receipt, bytes, message] of [
    [missing, canonical(missing), /process map/],
    [malformed, canonical(malformed), /process map/],
    [
      buildReceipt,
      JSON.stringify(
        Object.fromEntries(Object.entries(buildReceipt).reverse())
      ),
      /canonical/,
    ],
    [mismatch, canonical(mismatch), /accepted image receipt/],
  ]) {
    const { directory, root } = await fixture(context);
    await replaceReceipt(directory, receipt, bytes);
    await assert.rejects(publishAcceptedPrepare(directory, root), message);
  }
});
test('fails closed when an installed process-map receipt is unsafe or drifts', async (context) => {
  const { directory, root } = await fixture(context);
  await publishAcceptedPrepare(directory, root);
  await chmod(join(root, 'receipts', 'image-process-map.json'), 0o600);
  await assert.rejects(publishAcceptedPrepare(directory, root), /drift/);
  const next = await fixture(context);
  await publishAcceptedPrepare(next.directory, next.root);
  const mapDigest = join(next.root, 'receipts', 'image-process-map.sha256');
  await chmod(mapDigest, 0o600);
  await writeFile(mapDigest, `${'0'.repeat(64)}\n`, { mode: 0o400 });
  await chmod(mapDigest, 0o400);
  await assert.rejects(
    publishAcceptedPrepare(next.directory, next.root),
    /drift/
  );
});
test('publishes a full process map the idle consumer accepts only with its digest', async (context) => {
  const { directory, root } = await fixture(context);
  await publishAcceptedPrepare(directory, root);
  const mapBytes = await readFile(
    join(root, 'receipts', 'image-process-map.json')
  );
  const authority = processAuthority(IMAGE);
  authority.processMap = JSON.parse(mapBytes);
  authority.processMapSha256 = sha256(mapBytes);
  const runner = 'a'.repeat(64);
  await mkdir(join(root, 'start'));
  await writeFile(
    join(root, 'start', 'processes'),
    `10|1|/usr/bin/dockerd|${'a'.repeat(64)}|/cwv-measurement-control.slice/docker.service|2-3|/usr/lib/systemd/systemd|-\n11|1|/usr/bin/containerd|${'b'.repeat(64)}|/cwv-measurement-control.slice/containerd.service|2-3|/usr/lib/systemd/systemd|-\n41|1|/opt/node/bin/node|${DIGEST}|/cwv-measurement.slice/docker-${runner}.scope|2-3|/usr/lib/systemd/systemd|-\n42|41|/opt/runner/bin/Runner.Listener|${DIGEST}|/cwv-measurement.slice/docker-${runner}.scope|2-3|/opt/node/bin/node|${DIGEST}\n`
  );
  // biome-ignore format: the producer-to-consumer seam is clearer as one tuple.
  const runtime = { processAuthority: authority, runnerContainerId: runner, runnerImage: IMAGE };
  // biome-ignore format: the exact consumer invocation is reused for the bound and drifted receipts.
  const verify = () => assertProcesses(root, 'start', runtime, { measurementCpuSet: '2-3' }, 'live');
  assert.doesNotThrow(verify);
  authority.processMapSha256 = '0'.repeat(64);
  assert.throws(verify, /process authority/);
});
test('installer creates the root-only process-map receipts directory', async () => {
  const installer = await readFile(
    new URL('./install.sh', import.meta.url),
    'utf8'
  );
  // biome-ignore format: exact installer ownership assertions keep this test below the repository cap.
  for (const pattern of [/for directory in source source-receipts docker containerd registration-staging campaigns retired-ollama import dedicated-runtime receipts;/, /ensure_directory "\$ROOT\/allow" 0750 root:baci-cwv/]) assert.match(installer, pattern);
});
// biome-ignore format: exact foreign-file recovery fixture remains below the repository cap.
test('fails closed before acceptance and on any installed receipt drift', async (context) => {
  const { directory, root } = await fixture(context);
  await mkdir(join(root, 'receipts', 'runner-runtime'), { mode: 0o700, recursive: true });
  const foreign = join(root, 'receipts', 'runner-runtime', '.runner-runtime-context.json-other-123');
  await writeFile(foreign, 'foreign', { mode: 0o400 });
  await assert.rejects(publishAcceptedPrepare(directory, root), /unsafe runtime receipt directory/);
  await rm(foreign);
  await publishAcceptedPrepare(directory, root);
  await writeFile(join(root, 'image-id'), 'drift\n');
  await assert.rejects(publishAcceptedPrepare(directory, root), /drift/);
  const source = JSON.parse(
    await readFile(join(directory, 'prepare-state.json'), 'utf8')
  );
  source.phase = 'synthetic-proven';
  await writeFile(
    join(directory, 'prepare-state.json'),
    JSON.stringify(source)
  );
  await assert.rejects(
    publishAcceptedPrepare(directory, root),
    /(?:digest|accepted)/
  );
});
