import { createHash, randomUUID } from 'node:crypto';
import {
  chmod,
  chown,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

import { canonicalJson } from './canonical-json.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const imageId = /^sha256:[a-f0-9]{64}$/;
const hash = /^[a-f0-9]{64}$/;
const runnerPaths = Object.freeze([
  'bin/Runner.Listener',
  'bin/Runner.Worker',
  'entrypoint.mjs',
]);
const exact = (value, keys) =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
const fail = () => {
  throw new TypeError('runner runtime identity refused');
};

function packageProjection(bytes) {
  let value;
  try {
    value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    fail();
  }
  return {
    bin: value?.bin?.pnpm ?? value?.bin,
    name: value?.name,
    version: value?.version,
  };
}

function sealedHash(receipt, path) {
  const rows = receipt?.processMap?.sealed;
  if (!Array.isArray(rows)) fail();
  const found = rows.filter((row) => row?.path === path);
  if (found.length !== 1 || !hash.test(found[0]?.sha256 ?? '')) fail();
  return found[0].sha256;
}

function requiredRunnerFiles(manifest, contract) {
  if (
    manifest?.imageId === undefined ||
    canonicalJson(contract.runnerFiles) !== canonicalJson(runnerPaths) ||
    !Array.isArray(manifest?.files)
  )
    fail();
  return runnerPaths.map((path) => {
    const rows = manifest.files.filter((row) => row?.path === path);
    if (rows.length !== 1 || !hash.test(rows[0]?.sha256 ?? '')) fail();
    return { path, sha256: rows[0].sha256 };
  });
}

export function deriveRunnerRuntimeIdentity(input) {
  const runtimeContract = input?.contract?.builderSources?.runtime;
  const receipt = input?.imageReceipt;
  if (
    input?.contract?.schemaVersion !== 1 ||
    !runtimeContract ||
    !imageId.test(receipt?.imageId ?? '') ||
    receipt.platform !== 'linux/amd64' ||
    canonicalJson(receipt) !== input.imageReceiptBytes ||
    input.runnerManifest?.imageId !== receipt.imageId
  )
    fail();
  const files = input.runtimeFiles;
  for (const name of ['chrome', 'node', 'pnpm', 'pnpmPackage'])
    if (
      !exact(files?.[name], ['bytes', 'path', 'sha256']) ||
      !Buffer.isBuffer(files[name].bytes) ||
      files[name].sha256 !== sha256(files[name].bytes)
    )
      fail();
  if (
    files.chrome.path !==
      runtimeContract.chrome.targetPath.replace(/^\//, '') ||
    files.node.path !== 'opt/node/bin/node' ||
    files.pnpm.path !== 'opt/pnpm/bin/pnpm.cjs' ||
    files.pnpmPackage.path !== 'opt/pnpm/package.json' ||
    files.node.sha256 !== sealedHash(receipt, '/opt/node/bin/node') ||
    files.pnpm.sha256 !== sealedHash(receipt, '/opt/pnpm/bin/pnpm.cjs')
  )
    fail();
  const projectedPackage = packageProjection(files.pnpmPackage.bytes);
  const chrome = receipt.provenance?.chrome?.receipt;
  const pnpm = receipt.provenance?.pnpm?.receipt;
  if (
    chrome?.artifactSha256 !== runtimeContract.chrome.debianSha256 ||
    chrome?.version !== runtimeContract.chrome.debianPackage.version ||
    runtimeContract.chrome.debianPackage.version !==
      `${runtimeContract.chrome.version}-1` ||
    pnpm?.version !== runtimeContract.pnpm.version ||
    canonicalJson(projectedPackage) !==
      canonicalJson(runtimeContract.pnpm.packageProjection)
  )
    fail();
  const runtimeRunner = {
    files: requiredRunnerFiles(input.runnerManifest, runtimeContract),
    version: runtimeContract.runnerVersion,
  };
  const runtime = {
    chrome: {
      binarySha256: files.chrome.sha256,
      debianPackage: runtimeContract.chrome.debianPackage,
      debianSha256: runtimeContract.chrome.debianSha256,
      version: runtimeContract.chrome.version,
    },
    imageId: receipt.imageId,
    node: {
      binarySha256: files.node.sha256,
      version: runtimeContract.node.version,
    },
    pnpm: {
      binarySha256: files.pnpm.sha256,
      packageJsonSha256: files.pnpmPackage.sha256,
      packageProjection: projectedPackage,
      version: runtimeContract.pnpm.version,
    },
    runtimeRunner,
    runtimeRunnerBinaryDigest: sha256(canonicalJson(runtimeRunner)),
    schemaVersion: 1,
  };
  const identityManifest = {
    chromeTargetPath: runtimeContract.chrome.targetPath,
    pnpmPackage: projectedPackage,
    runtime,
    schemaVersion: 1,
  };
  const identityManifestBytes = canonicalJson(identityManifest);
  const runtimeIdentitySha256 = sha256(canonicalJson(runtime));
  const imageEvidence = {
    id: receipt.imageId,
    imageReceiptSha256: sha256(input.imageReceiptBytes),
    platform: receipt.platform,
    runtimeIdentitySha256,
    runtimeManifestSha256: sha256(identityManifestBytes),
    schemaVersion: 1,
  };
  return Object.freeze({
    identityManifest: Object.freeze(identityManifest),
    identityManifestBytes,
    identityManifestReceipt: `${sha256(identityManifestBytes)}\n`,
    imageEvidence: Object.freeze(imageEvidence),
    runtimeIdentitySha256,
  });
}

export function runnerRuntimeImageEnvelope(value) {
  if (
    !exact(value, [
      'id',
      'imageReceiptSha256',
      'platform',
      'runtimeIdentitySha256',
      'runtimeManifestSha256',
      'schemaVersion',
    ]) ||
    !imageId.test(value.id ?? '') ||
    !hash.test(value.imageReceiptSha256 ?? '') ||
    value.platform !== 'linux/amd64' ||
    !hash.test(value.runtimeIdentitySha256 ?? '') ||
    !hash.test(value.runtimeManifestSha256 ?? '') ||
    value.schemaVersion !== 1
  )
    fail();
  const canonical = canonicalJson(value);
  return Object.freeze({
    canonical,
    owner: Object.freeze({ gid: 10001, mode: '0640', uid: 0 }),
    schemaVersion: 1,
    sha256Receipt: `${sha256(canonical)}\n`,
    source: 'image',
  });
}

// biome-ignore format: exact projection rows stay compact under the file cap.
function projectionRows(projection) {
  if (
    !Buffer.isBuffer(projection?.identityContractBytes) ||
    !Buffer.isBuffer(projection?.runtimeManifestBytes) ||
    !Array.isArray(projection?.runnerFiles)
  )
    fail();
  const rows = projection.runnerFiles.map((row) => {
    if (
      !exact(row, ['bytes', 'path', 'sha256']) ||
      !Buffer.isBuffer(row.bytes) ||
      !runnerPaths.includes(row.path) ||
      row.sha256 !== sha256(row.bytes)
    )
      fail();
    return { bytes: row.bytes, mode: row.path === 'entrypoint.mjs' ? 0o444 : 0o555, path: row.path };
  });
  if (
    canonicalJson(rows.map(({ path }) => path).sort()) !==
    canonicalJson([...runnerPaths].sort())
  )
    fail();
  rows.push(
    { bytes: projection.identityContractBytes, mode: 0o444, path: 'identity-contract.json' },
    { bytes: projection.runtimeManifestBytes, mode: 0o444, path: 'runtime-manifest.json' }
  );
  return rows.sort((left, right) => left.path.localeCompare(right.path));
}

async function setOwner(path, owner, mode) {
  await chown(path, owner.uid, owner.gid);
  await chmod(path, mode);
}

// biome-ignore format: stable public signature stays under the file cap.
export async function writeRunnerRuntimeProjection(directory, projection, owner) {
  const rows = projectionRows(projection);
  await mkdir(directory, { mode: 0o700 });
  await mkdir(join(directory, 'bin'), { mode: 0o700 });
  for (const row of rows) {
    const path = join(directory, row.path);
    await writeFile(path, row.bytes, { flag: 'wx', mode: 0o600 });
    await setOwner(path, owner, row.mode);
  }
  await setOwner(join(directory, 'bin'), owner, 0o555);
  await setOwner(directory, owner, 0o555);
  await verifyRunnerRuntimeProjection(directory, projection, owner);
}

async function assertMetadata(path, type, mode, owner) {
  const details = await lstat(path);
  if (
    details.isSymbolicLink() ||
    (type === 'file' ? !details.isFile() : !details.isDirectory()) ||
    details.uid !== owner.uid ||
    details.gid !== owner.gid ||
    (details.mode & 0o777) !== mode ||
    (type === 'file' && details.nlink !== 1)
  )
    fail();
}

// biome-ignore format: stable public signature stays under the file cap.
export async function verifyRunnerRuntimeProjection(directory, projection, owner) {
  const rows = projectionRows(projection);
  await assertMetadata(directory, 'directory', 0o555, owner);
  await assertMetadata(join(directory, 'bin'), 'directory', 0o555, owner);
  if (
    canonicalJson((await readdir(directory)).sort()) !==
      canonicalJson(['bin', 'entrypoint.mjs', 'identity-contract.json', 'runtime-manifest.json']) ||
    canonicalJson((await readdir(join(directory, 'bin'))).sort()) !==
      canonicalJson(['Runner.Listener', 'Runner.Worker'])
  )
    fail();
  for (const row of rows) {
    const path = join(directory, row.path);
    await assertMetadata(path, 'file', row.mode, owner);
    if (sha256(await readFile(path)) !== sha256(row.bytes)) fail();
  }
  return Object.freeze({ directory, runtimeManifestSha256: sha256(projection.runtimeManifestBytes) });
}

// biome-ignore format: stable public signature stays under the file cap.
export async function publishRunnerRuntimeProjection(source, destination, projection, owner) {
  await verifyRunnerRuntimeProjection(source, projection, owner);
  try {
    return await verifyRunnerRuntimeProjection(destination, projection, owner);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  const temporary = await mkdtemp(join(dirname(destination), `.${basename(destination)}-${randomUUID()}-`));
  await rm(temporary, { recursive: true });
  try {
    await writeRunnerRuntimeProjection(temporary, projection, owner);
    await rename(temporary, destination);
    const parent = await open(dirname(destination), 'r');
    try {
      await parent.sync();
    } finally {
      await parent.close();
    }
  } finally {
    await rm(temporary, { force: true, recursive: true });
  }
  return verifyRunnerRuntimeProjection(destination, projection, owner);
}
