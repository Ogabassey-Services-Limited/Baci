import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readdirSync,
  readFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { canonicalJson } from './canonical-json.mjs';
import { validateRunnerRuntimeReceipt } from './runner-runtime-manifest-producer.mjs';

const files = Object.freeze({
  context: 'runner-runtime-context.json',
  contextReceipt: 'runner-runtime-context.json.sha256',
  identityManifest: 'runner-runtime-identity-manifest.json',
  identityManifestReceipt: 'runner-runtime-identity-manifest.json.sha256',
  manifest: 'runner-runtime-manifest.json',
  manifestReceipt: 'runner-runtime-manifest.json.sha256',
});
const fail = () => {
  throw new TypeError('runner runtime receipt reader refused');
};
const same = (left, right) =>
  left.dev === right.dev &&
  left.ino === right.ino &&
  left.size === right.size &&
  left.mode === right.mode &&
  left.uid === right.uid &&
  left.gid === right.gid &&
  left.nlink === right.nlink;

function read(path, owner, mode = 0o400) {
  const before = lstatSync(path);
  if (
    !before.isFile() ||
    before.isSymbolicLink() ||
    before.uid !== owner.uid ||
    before.gid !== owner.gid ||
    before.nlink !== 1 ||
    (before.mode & 0o777) !== mode
  )
    fail();
  const descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const opened = fstatSync(descriptor);
    if (!same(before, opened)) fail();
    const bytes = readFileSync(descriptor);
    if (!same(opened, fstatSync(descriptor))) fail();
    return bytes.toString('utf8');
  } finally {
    closeSync(descriptor);
  }
}

export function readRunnerRuntimeReceipt(
  directory,
  imageReceiptPath,
  owner = { gid: 0, uid: 0 },
  imageReceiptMode = 0o400
) {
  try {
    const root = lstatSync(directory);
    if (
      !root.isDirectory() ||
      root.isSymbolicLink() ||
      root.uid !== owner.uid ||
      root.gid !== owner.gid ||
      (root.mode & 0o777) !== 0o700 ||
      ![0o400, 0o600].includes(imageReceiptMode)
    )
      fail();
    if (
      canonicalJson(readdirSync(directory).sort()) !==
      canonicalJson(Object.values(files).sort())
    )
      fail();
    const paths = Object.fromEntries(
      Object.entries(files).map(([key, name]) => [key, join(directory, name)])
    );
    const contextBytes = read(paths.context, owner);
    const identityManifestBytes = read(paths.identityManifest, owner);
    const manifestBytes = read(paths.manifest, owner);
    const record = {
      context: JSON.parse(contextBytes),
      contextBytes,
      contextReceipt: read(paths.contextReceipt, owner),
      imageReceiptBytes: read(imageReceiptPath, owner, imageReceiptMode),
      identityManifest: JSON.parse(identityManifestBytes),
      identityManifestBytes,
      identityManifestReceipt: read(paths.identityManifestReceipt, owner),
      manifest: JSON.parse(manifestBytes),
      manifestBytes,
      manifestReceipt: read(paths.manifestReceipt, owner),
    };
    validateRunnerRuntimeReceipt(record);
    return Object.freeze({
      context: Object.freeze(record.context),
      identityManifest: Object.freeze(record.identityManifest),
      manifest: Object.freeze(record.manifest),
      paths: Object.freeze(paths),
    });
  } catch {
    fail();
  }
}
