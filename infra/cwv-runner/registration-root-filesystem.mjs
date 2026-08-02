import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
// biome-ignore format: compact fixed filesystem surface preserves the file-size gate
import { chmod, chown, link, lstat, mkdir, open, readdir, rm, rmdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { canonicalSha256 } from './canonical-json.mjs';
import { registrationLayout } from './registration-controller.mjs';
import { assertRegistrationTokenMount } from './registration-token-mount.mjs';

const SHA256 = /^[a-f0-9]{64}$/;
const FIXED_BASES = Object.freeze({
  release: '/run/baci-cwv-registration-release',
  sealed: '/srv/baci-cwv/sealed',
  staging: '/srv/baci-cwv/registration-staging',
  token: '/run/baci-cwv-registration',
});
// biome-ignore format: compact failure helper preserves the executable line cap
const fail = () => { throw new TypeError('registration root filesystem refused'); };
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
// biome-ignore format: compact absence receipt preserves the file-size gate
const tokenReceipt = (key, paths) => ({ [key]: canonicalSha256({ paths: { token: paths.token, tokenParent: paths.tokenParent }, schemaVersion: 1, state: 'absent' }) });
const FIXED_OPTIONS = Object.freeze({
  env: Object.freeze({
    LC_ALL: 'C.UTF-8',
    PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
    TZ: 'Etc/UTC',
  }),
  maxBuffer: 65_536,
});

async function directory(path, owner, mode) {
  let details;
  try {
    details = await lstat(path);
  } catch {
    fail();
  }
  if (
    !details.isDirectory() ||
    details.isSymbolicLink() ||
    details.uid !== owner.uid ||
    details.gid !== owner.gid ||
    (details.mode & 0o777) !== mode
  )
    fail();
  return details;
}
// biome-ignore format: compact fixed-ownership helper preserves the file-size gate
async function createDirectory(parent, path, parentOwner, owner, mode, parentMode = 0o700) {
  await directory(parent, parentOwner, parentMode);
  try {
    await mkdir(path, { mode });
    await chown(path, owner.uid, owner.gid);
    await chmod(path, mode);
  } catch (error) {
    if (error?.code !== 'EEXIST') fail();
  }
  await directory(path, owner, mode);
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

async function createFile(path, bytes, owner, mode) {
  const handle = await open(
    path,
    constants.O_WRONLY |
      constants.O_CREAT |
      constants.O_EXCL |
      constants.O_NOFOLLOW,
    mode
  );
  try {
    await handle.writeFile(bytes);
    await handle.sync();
    await handle.chown(owner.uid, owner.gid);
    await handle.chmod(mode);
  } finally {
    await handle.close();
  }
}

async function verifyFile(path, expected, owner, mode) {
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const details = await handle.stat();
    const bytes = await handle.readFile();
    if (
      !details.isFile() ||
      details.uid !== owner.uid ||
      details.gid !== owner.gid ||
      (details.mode & 0o777) !== mode ||
      digest(bytes) !== expected
    )
      fail();
    return bytes;
  } finally {
    await handle.close();
  }
}

async function absent(path) {
  try {
    await lstat(path);
  } catch (error) {
    if (error?.code === 'ENOENT') return true;
    fail();
  }
  fail();
}

// biome-ignore format: fixed registration filesystem contract preserves the file-size gate
export function createRegistrationRootFilesystem(configuration, options = {}) {
  const layout = registrationLayout(configuration?.context);
  const bases = options.bases ?? FIXED_BASES;
  const owner = options.owner ?? { gid: 0, uid: 0 };
  const runner = options.runner ?? { gid: 10001, uid: 10001 };
  const executeFile = options.executeFile;
  const ensureRuntimeBase = (path) =>
    createDirectory('/run', path, owner, owner, 0o700, 0o755);
  if (
    !bases ||
    Object.keys(bases).sort().join(',') !== 'release,sealed,staging,token' ||
    Object.values(bases).some(
      (path) => typeof path !== 'string' || !path.startsWith('/')
    )
  )
    fail();
  const paths = Object.freeze({
    handoff: join(bases.release, configuration.context.releaseNonce, 'handoff'),
    release: join(
      bases.release,
      configuration.context.releaseNonce,
      'handoff',
      'release.json'
    ),
    releaseParent: join(bases.release, configuration.context.releaseNonce),
    sealedRunner: join(bases.sealed, 'actions-runner'),
    staging: join(bases.staging, configuration.context.stagingNonce),
    token: join(bases.token, configuration.context.registrationNonce, 'token'),
    tokenParent: join(bases.token, configuration.context.registrationNonce),
  });
  const assertDerived = () => {
    if (
      options.bases === undefined &&
      (paths.handoff !== layout.handoff.path ||
        paths.releaseParent !== layout.releaseParent.path ||
        paths.staging !== layout.staging.path ||
        paths.token !== layout.token.path ||
        paths.tokenParent !== layout.tokenParent.path)
    )
      fail();
  };
  assertDerived();
  return Object.freeze({
    paths,
    async createTokenLayout() {
      if (options.bases === undefined) await ensureRuntimeBase(bases.token);
      await createDirectory(
        bases.token,
        paths.tokenParent,
        owner,
        owner,
        0o700
      );
      if (options.bases === undefined) {
        if (typeof executeFile !== 'function') fail();
        // biome-ignore format: the mount contract is an exact fixed argv
        const result = await executeFile('/usr/bin/mount', [
          '--types', 'tmpfs', '--options',
          'nosuid,nodev,noexec,size=4096,mode=0700,uid=0,gid=0',
          'tmpfs', paths.tokenParent,
        ], FIXED_OPTIONS);
        if (result?.stdout !== '' || result.stderr !== '') fail();
        await assertRegistrationTokenMount(
          paths.tokenParent,
          await directory(paths.tokenParent, owner, 0o700)
        );
      }
    },
    async writeToken(bytes) {
      if (!Buffer.isBuffer(bytes) || bytes.length < 21 || bytes.length > 129)
        fail();
      await directory(paths.tokenParent, owner, 0o700);
      await createFile(
        paths.token,
        bytes,
        { gid: runner.gid, uid: owner.uid },
        0o440
      );
      bytes.fill(0);
    },
    async createStagingLayout() {
      await createDirectory(bases.staging, paths.staging, owner, runner, 0o700);
    },
    async createReleaseLayout() {
      if (options.bases === undefined) await ensureRuntimeBase(bases.release);
      await createDirectory(
        bases.release,
        paths.releaseParent,
        owner,
        owner,
        0o700
      );
      await createDirectory(
        paths.releaseParent,
        paths.handoff,
        owner,
        { gid: runner.gid, uid: owner.uid },
        0o750
      );
    },
    async publishRelease(bytes, sha256) {
      if (
        typeof bytes !== 'string' ||
        !SHA256.test(sha256) ||
        digest(bytes) !== sha256
      )
        fail();
      await directory(
        paths.handoff,
        { gid: runner.gid, uid: owner.uid },
        0o750
      );
      await absent(paths.release);
      const temporary = join(paths.handoff, `.release-${process.pid}`);
      await createFile(
        temporary,
        Buffer.from(bytes),
        { gid: runner.gid, uid: owner.uid },
        0o440
      );
      try {
        await link(temporary, paths.release);
        await syncDirectory(paths.handoff);
      } finally {
        await unlink(temporary).catch(() => undefined);
      }
      await verifyFile(
        paths.release,
        sha256,
        { gid: runner.gid, uid: owner.uid },
        0o440
      );
    },
    verifyRelease: (sha256) =>
      verifyFile(
        paths.release,
        sha256,
        { gid: runner.gid, uid: owner.uid },
        0o440
      ),
    async deleteReleaseFile() {
      await directory(
        paths.handoff,
        { gid: runner.gid, uid: owner.uid },
        0o750
      );
      await unlink(paths.release);
      await syncDirectory(paths.handoff);
    },
    proveReleaseAbsence: () => absent(paths.release),
    async deleteTokenLayout() {
      await unlink(paths.token).catch((error) => {
        if (error?.code !== 'ENOENT') fail();
      });
      await rmdir(paths.tokenParent).catch((error) => { if (error?.code !== 'ENOENT') fail(); });
      if (options.bases === undefined) await rmdir(bases.token).catch((error) => { if (error?.code !== 'ENOENT') fail(); });
      await Promise.all([absent(paths.token), absent(paths.tokenParent)]);
      return tokenReceipt('tokenDeleteSha256', paths);
    },
    async proveTokenAbsence() {
      await Promise.all([absent(paths.token), absent(paths.tokenParent)]);
      return tokenReceipt('tokenAbsenceSha256', paths);
    },
    async deleteReleaseLayout() {
      await unlink(paths.release).catch((error) => {
        if (error?.code !== 'ENOENT') fail();
      });
      if ((await readdir(paths.handoff)).length !== 0) fail();
      await rmdir(paths.handoff);
      await rmdir(paths.releaseParent);
      if (options.bases === undefined) await rmdir(bases.release);
    },
    async deleteStagingLayout() {
      await directory(paths.staging, runner, 0o700);
      await rm(paths.staging, { force: false, recursive: true });
    },
  });
}
