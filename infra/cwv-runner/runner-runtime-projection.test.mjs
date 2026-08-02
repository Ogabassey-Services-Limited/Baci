import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmod, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  parseRunnerRuntimeManifest,
  readRunnerImageId,
  readRunnerRuntimeManifest,
} from './runner-runtime-projection.mjs';

const imageId = `sha256:${'a'.repeat(64)}`;
const identity = { gid: process.getgid(), uid: process.getuid() };
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const canonical = (value) =>
  Array.isArray(value)
    ? `[${value.map(canonical).join(',')}]`
    : value && typeof value === 'object'
      ? `{${Object.keys(value)
          .sort()
          .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
          .join(',')}}`
      : JSON.stringify(value);
const manifest = {
  files: [
    ['bin/Runner.Listener', '0555'],
    ['bin/Runner.PluginHost', '0555'],
    ['bin/Runner.Worker', '0555'],
    ['entrypoint.mjs', '0444'],
    ['externals/node24/bin/node', '0555'],
  ].map(([filePath, mode]) => ({
    mode,
    path: filePath,
    sha256: sha256(`${filePath}\n`),
  })),
  imageId,
  receiptBinding: 'runner-runtime-closure-v1',
  schemaVersion: 1,
};

async function authorities() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'runner-authority-'));
  const imagePath = path.join(root, 'image-id');
  const imageReceiptPath = `${imagePath}.sha256`;
  const manifestPath = path.join(root, 'runner-runtime-manifest.json');
  const manifestReceiptPath = `${manifestPath}.sha256`;
  const imageBytes = Buffer.from(`BACI_CWV_IMAGE_ID=${imageId}\n`);
  const manifestBytes = Buffer.from(canonical(manifest));
  await Promise.all([
    writeFile(imagePath, imageBytes, { mode: 0o644 }),
    writeFile(imageReceiptPath, `${sha256(imageBytes)}\n`, { mode: 0o644 }),
    writeFile(manifestPath, manifestBytes, { mode: 0o400 }),
    writeFile(manifestReceiptPath, `${sha256(manifestBytes)}\n`, {
      mode: 0o400,
    }),
  ]);
  return {
    image: { owner: identity, path: imagePath, receiptPath: imageReceiptPath },
    manifest: {
      owner: identity,
      path: manifestPath,
      receiptPath: manifestReceiptPath,
    },
  };
}

test('accepts only canonical manifests bound to the accepted image receipt', async () => {
  const paths = await authorities();
  const acceptedImageId = await readRunnerImageId(paths.image);
  const accepted = await readRunnerRuntimeManifest(
    acceptedImageId,
    paths.manifest
  );

  assert.equal(accepted.imageId, imageId);
  assert.deepEqual(
    accepted.files.map(({ path: filePath }) => filePath),
    manifest.files.map(({ path: filePath }) => filePath)
  );
});

test('refuses drifted receipts and unsafe authority metadata', async () => {
  {
    const paths = await authorities();
    await assert.rejects(
      readRunnerRuntimeManifest(`sha256:${'b'.repeat(64)}`, paths.manifest),
      /runner runtime projection refused/
    );
  }
  {
    const paths = await authorities();
    const bytes = Buffer.from(JSON.stringify(manifest, null, 2));
    await chmod(paths.manifest.path, 0o600);
    await writeFile(paths.manifest.path, bytes);
    await chmod(paths.manifest.path, 0o400);
    await chmod(paths.manifest.receiptPath, 0o600);
    await writeFile(paths.manifest.receiptPath, `${sha256(bytes)}\n`);
    await chmod(paths.manifest.receiptPath, 0o400);
    await assert.rejects(
      readRunnerRuntimeManifest(imageId, paths.manifest),
      /runner runtime projection refused/
    );
  }
  {
    const paths = await authorities();
    await chmod(paths.manifest.receiptPath, 0o600);
    await writeFile(paths.manifest.receiptPath, `${'0'.repeat(64)}\n`);
    await chmod(paths.manifest.receiptPath, 0o400);
    await assert.rejects(
      readRunnerRuntimeManifest(imageId, paths.manifest),
      /runner runtime projection refused/
    );
  }
  {
    const paths = await authorities();
    await chmod(paths.image.path, 0o666);
    await assert.rejects(
      readRunnerImageId(paths.image),
      /runner runtime projection refused/
    );
  }
});

test('refuses forbidden, generated, and incomplete manifest projections', () => {
  for (const filePath of ['.credentials', '.env', '_diag/output', 'run.sh'])
    assert.throws(
      () =>
        parseRunnerRuntimeManifest(
          {
            ...manifest,
            files: [
              ...manifest.files,
              { mode: '0444', path: filePath, sha256: '0'.repeat(64) },
            ].sort((left, right) => left.path.localeCompare(right.path)),
          },
          imageId
        ),
      /runner runtime projection refused/
    );
  assert.throws(
    () =>
      parseRunnerRuntimeManifest(
        { ...manifest, files: manifest.files.slice(1) },
        imageId
      ),
    /runner runtime projection refused/
  );
});

test('accepts manifest paths ordered by canonical UTF-8 bytes', () => {
  const unicodeOrderedManifest = {
    ...manifest,
    files: [
      ...manifest.files.slice(0, 3),
      { mode: '0444', path: 'bin/\uE000', sha256: '1'.repeat(64) },
      { mode: '0444', path: 'bin/\u{10000}', sha256: '2'.repeat(64) },
      ...manifest.files.slice(3),
    ],
  };

  assert.doesNotThrow(() =>
    parseRunnerRuntimeManifest(unicodeOrderedManifest, imageId)
  );
});
