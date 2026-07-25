import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { chmod, chown, lstat, mkdir, open, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import identityContract from './identity-contract.json' with { type: 'json' };
import { sealRunnerIdentity } from './runner-identity-contract.mjs';
import {
  inspectRunnerProjection,
  parseRunnerRuntimeManifest,
  readRunnerRuntimeManifest,
} from './runner-runtime-projection.mjs';

const FIXED_PATHS = Object.freeze({
  sealedRunner: '/srv/baci-cwv/sealed/actions-runner',
  staging: '/srv/baci-cwv/registration-staging',
});
const fail = () => {
  throw new TypeError('registration sealing refused');
};
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sameSnapshot = (before, after) =>
  before.dev === after.dev &&
  before.ino === after.ino &&
  before.size === after.size &&
  before.mode === after.mode &&
  before.mtimeMs === after.mtimeMs &&
  before.ctimeMs === after.ctimeMs &&
  before.nlink === after.nlink &&
  before.uid === after.uid &&
  before.gid === after.gid;

async function writeExact(handle, bytes) {
  let offset = 0;
  while (offset < bytes.length) {
    const { bytesWritten } = await handle.write(
      bytes,
      offset,
      bytes.length - offset,
      null
    );
    if (bytesWritten === 0) fail();
    offset += bytesWritten;
  }
}

async function directory(path, identity, empty = false) {
  const details = await lstat(path);
  if (
    !details.isDirectory() ||
    details.isSymbolicLink() ||
    details.uid !== identity.uid ||
    details.gid !== identity.gid ||
    (details.mode & 0o022) !== 0 ||
    (empty && (await readdir(path)).length !== 0)
  )
    fail();
}

async function syncDirectory(path) {
  const handle = await open(
    path,
    constants.O_RDONLY | (constants.O_DIRECTORY ?? 0) | constants.O_NOFOLLOW
  );
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function copyFile(source, destination, record, owner) {
  const input = await open(source, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const opened = await input.stat();
    if (!sameSnapshot(record.stat, opened)) fail();
    const mode = record.entry.executable ? 0o550 : 0o440;
    const output = await open(
      destination,
      constants.O_WRONLY |
        constants.O_CREAT |
        constants.O_EXCL |
        constants.O_NOFOLLOW,
      mode
    );
    try {
      const hash = createHash('sha256');
      const buffer = Buffer.alloc(Math.min(opened.size, 65_536));
      let offset = 0;
      while (offset < opened.size) {
        const { bytesRead } = await input.read(
          buffer,
          0,
          Math.min(buffer.length, opened.size - offset),
          offset
        );
        if (bytesRead === 0) fail();
        const chunk = buffer.subarray(0, bytesRead);
        hash.update(chunk);
        await writeExact(output, chunk);
        offset += bytesRead;
      }
      const probe = Buffer.allocUnsafe(1);
      if ((await input.read(probe, 0, 1, opened.size)).bytesRead !== 0) fail();
      if (
        !sameSnapshot(opened, await input.stat()) ||
        hash.digest('hex') !== record.digest
      )
        fail();
      await output.sync();
      await output.chown(owner.uid, owner.gid);
      await output.chmod(mode);
    } finally {
      await output.close();
    }
    return `${record.entry.path}:${mode.toString(8).padStart(4, '0')}:${record.digest}`;
  } finally {
    await input.close();
  }
}

async function createDirectories(root, directories, owner) {
  for (const relative of directories.filter(Boolean)) {
    const path = join(root, relative);
    await mkdir(path, { mode: 0o750 });
    await chown(path, owner.uid, owner.gid);
    await chmod(path, 0o750);
  }
}

async function sealDirectories(root, directories) {
  for (const relative of directories.filter(Boolean).reverse()) {
    const path = join(root, relative);
    await chmod(path, 0o550);
    await syncDirectory(path);
  }
  await chmod(root, 0o550);
  await syncDirectory(root);
}

function unchanged(before, after) {
  if (before.files.length !== after.files.length) fail();
  for (let index = 0; index < before.files.length; index += 1) {
    const left = before.files[index];
    const right = after.files[index];
    if (
      left.entry.path !== right.entry.path ||
      left.digest !== right.digest ||
      !sameSnapshot(left.stat, right.stat)
    )
      fail();
  }
}

export function createRegistrationSealer(configuration, options = {}) {
  const nonce = configuration?.context?.stagingNonce;
  const imageId = configuration?.context?.imageDigest;
  if (!/^[a-f0-9]{32}$/.test(nonce) || !/^sha256:[a-f0-9]{64}$/.test(imageId))
    fail();
  const paths = options.paths ?? {
    sealedRunner: FIXED_PATHS.sealedRunner,
    staging: join(FIXED_PATHS.staging, nonce),
  };
  const owner = options.owner ?? { gid: 10001, uid: 0 };
  const runner = options.runner ?? { gid: 10001, uid: 10001 };
  if (
    !paths ||
    Object.keys(paths).sort().join(',') !== 'sealedRunner,staging' ||
    (options.paths === undefined &&
      (paths.sealedRunner !== FIXED_PATHS.sealedRunner ||
        paths.staging !== join(FIXED_PATHS.staging, nonce)))
  )
    fail();
  const seal = async () => {
    const manifest = options.runtimeManifest
      ? parseRunnerRuntimeManifest(options.runtimeManifest, imageId)
      : await readRunnerRuntimeManifest(imageId);
    const source = join(paths.staging, 'actions-runner');
    const projection = await inspectRunnerProjection(source, manifest, runner);
    await directory(paths.sealedRunner, owner, true);
    await createDirectories(paths.sealedRunner, projection.directories, owner);
    const rows = [];
    for (const record of projection.files)
      rows.push(
        await copyFile(
          join(source, record.entry.path),
          join(paths.sealedRunner, record.entry.path),
          record,
          owner
        )
      );
    const sourceAfter = await inspectRunnerProjection(source, manifest, runner);
    unchanged(projection, sourceAfter);
    await sealDirectories(paths.sealedRunner, projection.directories);
    const sealed = await inspectRunnerProjection(
      paths.sealedRunner,
      manifest,
      owner,
      true
    );
    if (
      sealed.files.some(
        (record, index) => record.digest !== projection.files[index].digest
      )
    )
      fail();
    for (const relative of projection.directories.filter(Boolean))
      rows.push(`${relative}/:0550`);
    rows.sort();
    const identity = await sealRunnerIdentity({
      identityContract: options.identityContract ?? identityContract,
      owner,
      runner,
      sealedIdentityPath: join(
        dirname(paths.sealedRunner),
        'runner-identity.json'
      ),
      sealedRunnerPath: join(paths.sealedRunner, '.runner'),
      stagingRunnerPath: join(source, '.runner'),
    });
    return {
      ...identity,
      sealedRunnerSha256: digest(`${rows.join('\n')}\n`),
    };
  };
  return Object.freeze({
    async sealRunner() {
      try {
        return await seal();
      } catch {
        fail();
      }
    },
  });
}
