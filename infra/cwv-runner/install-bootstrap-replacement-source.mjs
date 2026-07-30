import { createHash } from 'node:crypto';
import { lstat, readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { canonicalJson } from './canonical-json.mjs';
import { resolveBootstrapGenerationFileSpecs } from './install-bootstrap-generation-specs.mjs';
import { readPinnedBootstrapFile } from './install-bootstrap-installed.mjs';
import { buildBootstrapInput } from './install-bootstrap-plan.mjs';

const HEX = /^[a-f0-9]{64}$/;
const SOURCE = /^[a-f0-9]{40}$/;
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const same = (left, right) => canonicalJson(left) === canonicalJson(right);

async function defaultListSourcePaths(root) {
  const names = await readdir(root, { recursive: true });
  const files = [];
  for (const name of names) {
    const details = await lstat(join(root, name));
    if (details.isSymbolicLink())
      throw new TypeError('sealed source tree contains a symlink');
    if (details.isFile()) files.push(name);
    else if (!details.isDirectory())
      throw new TypeError('sealed source tree contains a special file');
  }
  return files.sort();
}

function receiptFile(value, name) {
  if (
    value.details.uid !== 0 ||
    value.details.gid !== 0 ||
    (value.details.mode & 0o777) !== 0o600
  )
    throw new TypeError(`unsafe sealed source receipt: ${name}`);
  return value.bytes;
}

function validateCompleteReceipt(state) {
  if (state.phase !== 'complete') return;
  const receipt = state.receipt;
  if (
    !same(Object.keys(receipt ?? {}).sort(), [
      'captureSha256',
      'files',
      'policyFileSha256',
      'schemaVersion',
      'sourceManifestSha256',
      'sourceSha',
      'unitStates',
    ]) ||
    receipt.schemaVersion !== 1 ||
    receipt.captureSha256 !== state.captureSha256 ||
    receipt.sourceSha !== state.sourceSha ||
    receipt.sourceManifestSha256 !== state.sourceManifestSha256 ||
    receipt.policyFileSha256 !== state.policyFileSha256 ||
    !same(receipt.files, state.files) ||
    !receipt.unitStates ||
    !Object.keys(receipt.unitStates).length ||
    Object.values(receipt.unitStates).some(
      (value) => !/^loaded\ninactive\n(?:disabled|static)\n$/.test(value)
    )
  )
    throw new TypeError('invalid completed bootstrap source receipt');
}

export async function validateBootstrapReplacementSourceState(
  { state, sourceRoot, receiptRoot },
  descriptor = {}
) {
  const readPinned = descriptor.readPinned ?? readPinnedBootstrapFile;
  const listSourcePaths = descriptor.listSourcePaths ?? defaultListSourcePaths;
  const buildInput = descriptor.buildInput ?? buildBootstrapInput;
  const resolveFileSpecs =
    descriptor.resolveFileSpecs ?? resolveBootstrapGenerationFileSpecs;
  if (
    !SOURCE.test(state?.sourceSha ?? '') ||
    state.transactionId !== `bootstrap-${state.sourceSha.slice(0, 12)}` ||
    !HEX.test(state.sourceManifestSha256 ?? '') ||
    !HEX.test(state.policyFileSha256 ?? '')
  )
    throw new TypeError('invalid bootstrap source state identity');
  validateCompleteReceipt(state);
  const source = join(sourceRoot, state.sourceSha);
  const receipts = join(receiptRoot, state.sourceSha);
  const names = [
    'archive.sha256',
    'manifest.json',
    'manifest.sha256',
    'seal-receipt.json',
    'tree.sha256',
  ];
  const values = Object.fromEntries(
    await Promise.all(
      names.map(async (name) => [
        name,
        receiptFile(await readPinned(join(receipts, name)), name),
      ])
    )
  );
  const manifestSha = values['manifest.sha256'].toString('utf8');
  const archiveSha = values['archive.sha256'].toString('utf8');
  const treeSha = values['tree.sha256'].toString('utf8');
  if (
    ![manifestSha, archiveSha, treeSha].every((value) =>
      /^[a-f0-9]{64}\n$/.test(value)
    ) ||
    sha256(values['manifest.json']) !== manifestSha.trim() ||
    manifestSha.trim() !== state.sourceManifestSha256
  )
    throw new TypeError('sealed source receipt digest mismatch');
  const manifest = JSON.parse(values['manifest.json']);
  if (
    canonicalJson(manifest) !== values['manifest.json'].toString('utf8') ||
    manifest.schemaVersion !== 1 ||
    manifest.mergeSha !== state.sourceSha ||
    manifest.policyFileSha256 !== state.policyFileSha256 ||
    manifest.sourceArchive?.prefix !== 'infra/cwv-runner/' ||
    !Array.isArray(manifest.sourceArchive.entries)
  )
    throw new TypeError('sealed source manifest mismatch');
  const seal = JSON.parse(values['seal-receipt.json']);
  if (
    !same(Object.keys(seal).sort(), [
      'archiveSha256',
      'manifestSha256',
      'schemaVersion',
      'sealedTreeSha256',
      'sourceSha',
    ]) ||
    seal.schemaVersion !== 1 ||
    seal.sourceSha !== state.sourceSha ||
    seal.manifestSha256 !== manifestSha.trim() ||
    seal.archiveSha256 !== archiveSha.trim() ||
    seal.sealedTreeSha256 !== treeSha.trim()
  )
    throw new TypeError('sealed source receipt mismatch');
  const entries = manifest.sourceArchive.entries;
  const relativePaths = [];
  const rows = [];
  for (const entry of entries) {
    if (
      !same(Object.keys(entry).sort(), ['blobSha256', 'mode', 'path']) ||
      !/^infra\/cwv-runner\/(?!\.{1,2}$)[a-zA-Z0-9][a-zA-Z0-9._@-]*$/.test(
        entry.path
      ) ||
      !/^100(?:644|755)$/.test(entry.mode) ||
      !HEX.test(entry.blobSha256)
    )
      throw new TypeError('invalid sealed source entry');
    const relative = entry.path.slice('infra/cwv-runner/'.length);
    const pinned = await readPinned(join(source, relative));
    if (
      pinned.details.uid !== 0 ||
      pinned.details.gid !== 0 ||
      (pinned.details.mode & 0o777) !==
        (entry.mode === '100755' ? 0o755 : 0o644) ||
      sha256(pinned.bytes) !== entry.blobSha256
    )
      throw new TypeError('sealed source entry drift');
    relativePaths.push(relative);
    rows.push(`${entry.path}\t${entry.mode}\t${entry.blobSha256}\n`);
  }
  if (
    !same(relativePaths, [...relativePaths].sort()) ||
    !same(await listSourcePaths(source), relativePaths) ||
    sha256(Buffer.from(rows.join(''))) !== treeSha.trim()
  )
    throw new TypeError('sealed source tree drift');
  const derived = await buildInput({
    sourceRoot: source,
    sourceSha: state.sourceSha,
    sourceManifestSha256: state.sourceManifestSha256,
    policyFileSha256: state.policyFileSha256,
    bootstrapFileSha256: sha256(
      (await readPinned(join(source, 'install.sh'))).bytes
    ),
    transactionId: state.transactionId,
    fileSpecs: resolveFileSpecs({
      sourceSha: state.sourceSha,
      manifestRelativePaths: relativePaths,
      files: state.files,
    }),
  });
  if (
    !same(derived.files, state.files) ||
    (state.phase === 'complete' && !same(state.receipt?.files, state.files))
  )
    throw new TypeError('bootstrap source projection drift');
  return {
    journalTipSha256: state.journal?.at(-1)?.sha256 ?? state.captureSha256,
    sealReceiptSha256: sha256(values['seal-receipt.json']),
    sourceSha: state.sourceSha,
  };
}
