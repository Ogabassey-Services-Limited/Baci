import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { verifyRunnerRuntimeProjection } from './runner-runtime-identity-manifest.mjs';
import { readRunnerRuntimeReceipt } from './runner-runtime-manifest-receipt-reader.mjs';
import { parseRunnerRuntimeManifest } from './runner-runtime-projection.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const receiptNames = Object.freeze({
  context: 'runner-runtime-context.json',
  contextReceipt: 'runner-runtime-context.json.sha256',
  identityManifest: 'runner-runtime-identity-manifest.json',
  identityManifestReceipt: 'runner-runtime-identity-manifest.json.sha256',
  manifest: 'runner-runtime-manifest.json',
  manifestReceipt: 'runner-runtime-manifest.json.sha256',
});

export async function readPreparedRuntimeReceipt(
  stateDirectory,
  durableImageReceipt,
  imageId,
  owner,
  filesystem = { readFile }
) {
  if (typeof filesystem?.readFile !== 'function')
    throw new TypeError('prepared runtime filesystem refused');
  const directory = join(stateDirectory, 'runner-runtime');
  const imageReceiptPath = join(
    stateDirectory,
    'runner-runtime-image-receipt.json'
  );
  const checked = readRunnerRuntimeReceipt(directory, imageReceiptPath, owner);
  const [imageReceipt, ...files] = await Promise.all([
    filesystem.readFile(imageReceiptPath),
    ...Object.keys(receiptNames).map((key) =>
      filesystem.readFile(checked.paths[key])
    ),
  ]);
  if (!imageReceipt.equals(durableImageReceipt))
    throw new TypeError('prepared runtime image receipt drift');
  const values = Object.fromEntries(
    Object.keys(receiptNames).map((key, index) => [key, files[index]])
  );
  const {
    context: contextBytes,
    contextReceipt,
    identityManifest: identityManifestBytes,
    identityManifestReceipt,
    manifest: manifestBytes,
    manifestReceipt,
  } = values;
  if (
    contextReceipt.toString('utf8') !== `${sha256(contextBytes)}\n` ||
    identityManifestReceipt.toString('utf8') !==
      `${sha256(identityManifestBytes)}\n` ||
    manifestReceipt.toString('utf8') !== `${sha256(manifestBytes)}\n` ||
    checked.context.manifestSha256 !== sha256(manifestBytes) ||
    checked.context.runtimeManifestSha256 !== sha256(identityManifestBytes)
  )
    throw new TypeError('prepared runtime receipt drift');
  const manifest = JSON.parse(
    new TextDecoder('utf-8', { fatal: true }).decode(manifestBytes)
  );
  parseRunnerRuntimeManifest(manifest, imageId);
  const revalidated = readRunnerRuntimeReceipt(
    directory,
    imageReceiptPath,
    owner
  );
  if (
    revalidated.context.manifestSha256 !== sha256(manifestBytes) ||
    revalidated.context.runtimeManifestSha256 !== sha256(identityManifestBytes)
  )
    throw new TypeError('prepared runtime receipt drift');
  const projectionDirectory = join(stateDirectory, 'runner-runtime-projection');
  const identityContractBytes = await readFile(
    new URL('./identity-contract.json', import.meta.url)
  );
  const runnerFiles = await Promise.all(
    ['bin/Runner.Listener', 'bin/Runner.Worker', 'entrypoint.mjs'].map(
      async (path) => {
        const bytes = await readFile(join(projectionDirectory, path));
        const expected = revalidated.manifest.files.find(
          (row) => row.path === path
        );
        if (!expected || expected.sha256 !== sha256(bytes))
          throw new TypeError('prepared runtime projection drift');
        return Object.freeze({ bytes, path, sha256: expected.sha256 });
      }
    )
  );
  const projection = Object.freeze({
    identityContractBytes,
    runnerFiles: Object.freeze(runnerFiles),
    runtimeManifestBytes: Buffer.from(identityManifestBytes),
  });
  await verifyRunnerRuntimeProjection(projectionDirectory, projection, owner);
  return Object.freeze({
    contextSha256: sha256(contextBytes),
    files: Object.freeze(
      Object.entries(receiptNames).map(([, name], index) =>
        Object.freeze({ bytes: files[index], name })
      )
    ),
    manifestSha256: sha256(manifestBytes),
    imageEvidence: Object.freeze({
      id: checked.context.imageId,
      imageReceiptSha256: checked.context.imageReceiptSha256,
      platform: checked.context.platform,
      runtimeIdentitySha256: checked.context.runtimeIdentitySha256,
      runtimeManifestSha256: checked.context.runtimeManifestSha256,
      schemaVersion: 1,
    }),
    projection,
    projectionDirectory,
  });
}

async function main(argv) {
  const [command, stateDirectory, receiptPath, imageId] = argv;
  if (command !== 'verify' || !stateDirectory || !receiptPath || !imageId)
    throw new TypeError('prepared runtime receipt command refused');
  await readPreparedRuntimeReceipt(
    stateDirectory,
    await readFile(receiptPath),
    imageId,
    { gid: process.getgid(), uid: process.getuid() }
  );
}

if (import.meta.filename === process.argv[1]) {
  main(process.argv.slice(2)).catch(() => {
    process.stderr.write('prepared runtime receipt refused\n');
    process.exitCode = 1;
  });
}
