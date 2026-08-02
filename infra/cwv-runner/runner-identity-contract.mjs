import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { link, lstat, open, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';

import { canonicalJson } from './canonical-json.mjs';

const MAXIMUM_RUNNER_BYTES = 16_384;
const REPOSITORY_URL = 'https://github.com/ogabasseyy/Baci';
const SHA256 = /^[a-f0-9]{64}$/;
const RUNNER_SETTINGS_KEYS = Object.freeze([
  'agentId',
  'agentName',
  'disableUpdate',
  'ephemeral',
  'gitHubUrl',
  'monitorSocketAddress',
  'poolId',
  'poolName',
  'serverUrl',
  'serverUrlV2',
  'skipSessionRecover',
  'useRunnerAdminFlow',
  'useV2Flow',
  'workFolder',
]);
const OPTIONAL_TYPES = Object.freeze({
  ephemeral: 'boolean',
  monitorSocketAddress: 'string',
  serverUrlV2: 'string',
  skipSessionRecover: 'boolean',
  useRunnerAdminFlow: 'boolean',
  useV2Flow: 'boolean',
});
const fail = () => {
  throw new TypeError('runner identity contract refused');
};
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const record = (value) =>
  value && typeof value === 'object' && !Array.isArray(value);
const snapshot = (details) =>
  [
    details.dev,
    details.ino,
    details.size,
    details.mode,
    details.mtimeMs,
    details.ctimeMs,
    details.nlink,
    details.uid,
    details.gid,
  ].join(':');

async function readExactSnapshot(handle, size) {
  const bytes = Buffer.alloc(size);
  let offset = 0;
  while (offset < size) {
    const { bytesRead } = await handle.read(
      bytes,
      offset,
      size - offset,
      offset
    );
    if (bytesRead === 0) fail();
    offset += bytesRead;
  }
  const probe = Buffer.allocUnsafe(1);
  if ((await handle.read(probe, 0, 1, size)).bytesRead !== 0) fail();
  return bytes;
}

function contractGithub(contract) {
  const github = contract?.builderSources?.github;
  if (
    !github ||
    !Number.isSafeInteger(github.controllerGeneration) ||
    github.controllerGeneration <= 0 ||
    typeof github.runnerName !== 'string' ||
    !github.runnerName
  )
    fail();
  return github;
}

function hostedUrl(value, suffixes) {
  if (typeof value !== 'string') return false;
  try {
    const parsed = new URL(value);
    return (
      parsed.protocol === 'https:' &&
      !parsed.username &&
      !parsed.password &&
      !parsed.port &&
      !parsed.search &&
      !parsed.hash &&
      suffixes.some((suffix) => parsed.hostname.endsWith(suffix))
    );
  } catch {
    return false;
  }
}

function validRunnerSettings(runner, github) {
  if (
    !record(runner) ||
    Object.keys(runner).some((key) => !RUNNER_SETTINGS_KEYS.includes(key)) ||
    !Number.isSafeInteger(runner.agentId) ||
    runner.agentId <= 0 ||
    runner.agentName !== github.runnerName ||
    runner.gitHubUrl !== REPOSITORY_URL ||
    runner.workFolder !== '/runner-work' ||
    runner.disableUpdate !== true ||
    !Number.isSafeInteger(runner.poolId) ||
    runner.poolId <= 0 ||
    typeof runner.poolName !== 'string' ||
    !runner.poolName.trim() ||
    !hostedUrl(runner.serverUrl, ['.actions.githubusercontent.com'])
  )
    return false;
  return (
    Object.entries(OPTIONAL_TYPES).every(
      ([key, type]) => !(key in runner) || typeof runner[key] === type
    ) &&
    (!('serverUrlV2' in runner) ||
      hostedUrl(runner.serverUrlV2, [
        '.actions.githubusercontent.com',
        '.githubapp.com',
      ]))
  );
}

export function deriveRunnerIdentity(runnerBytes, identityContract) {
  if (
    !Buffer.isBuffer(runnerBytes) ||
    !runnerBytes.length ||
    runnerBytes.length > MAXIMUM_RUNNER_BYTES
  )
    fail();
  let runner;
  try {
    runner = JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(runnerBytes)
    );
  } catch {
    fail();
  }
  const github = contractGithub(identityContract);
  if (!validRunnerSettings(runner, github)) fail();
  const bytes = Buffer.from(
    canonicalJson({
      generation: github.controllerGeneration,
      id: runner.agentId,
      name: runner.agentName,
    }),
    'utf8'
  );
  return Object.freeze({ bytes, sha256: digest(bytes) });
}

async function readRunner(path, owner, mode) {
  const before = await lstat(path);
  if (
    !before.isFile() ||
    before.isSymbolicLink() ||
    before.uid !== owner.uid ||
    before.gid !== owner.gid ||
    before.nlink !== 1 ||
    (before.mode & 0o777) !== mode ||
    before.size > MAXIMUM_RUNNER_BYTES
  )
    fail();
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const opened = await handle.stat();
    if (snapshot(before) !== snapshot(opened)) fail();
    const bytes = await readExactSnapshot(handle, opened.size);
    if (snapshot(opened) !== snapshot(await handle.stat())) fail();
    return bytes;
  } finally {
    await handle.close();
  }
}

async function syncDirectory(path) {
  const handle = await open(
    path,
    constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW
  );
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function publish(path, bytes, owner) {
  const parent = dirname(path);
  const directory = await lstat(parent);
  if (
    !directory.isDirectory() ||
    directory.isSymbolicLink() ||
    directory.uid !== owner.uid ||
    (directory.mode & 0o022) !== 0
  )
    fail();
  try {
    await lstat(path);
    fail();
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  const temporary = `${path}.partial-${process.pid}`;
  const handle = await open(
    temporary,
    constants.O_WRONLY |
      constants.O_CREAT |
      constants.O_EXCL |
      constants.O_NOFOLLOW,
    0o400
  );
  try {
    await handle.writeFile(bytes);
    await handle.sync();
    await handle.chown(owner.uid, owner.gid);
    await handle.chmod(0o400);
  } finally {
    await handle.close();
  }
  try {
    await link(temporary, path);
    await unlink(temporary);
    await syncDirectory(parent);
  } catch (_error) {
    fail();
  }
  const final = await lstat(path);
  if (
    !final.isFile() ||
    final.isSymbolicLink() ||
    final.uid !== owner.uid ||
    final.gid !== owner.gid ||
    final.nlink !== 1 ||
    (final.mode & 0o777) !== 0o400 ||
    final.size !== bytes.length
  )
    fail();
  const verified = await readRunnerIdentity(path, owner);
  if (!verified.equals(bytes)) fail();
}

async function readRunnerIdentity(path, owner) {
  const details = await lstat(path);
  if (details.size > 512) fail();
  return await readRunner(path, owner, 0o400);
}

export async function sealRunnerIdentity({
  identityContract,
  owner,
  sealedIdentityPath,
  sealedRunnerPath,
  stagingRunnerPath,
  runner,
}) {
  if (
    !owner ||
    !runner ||
    typeof sealedIdentityPath !== 'string' ||
    typeof sealedRunnerPath !== 'string' ||
    typeof stagingRunnerPath !== 'string'
  )
    fail();
  const staged = deriveRunnerIdentity(
    await readRunner(stagingRunnerPath, runner, 0o600),
    identityContract
  );
  const sealed = deriveRunnerIdentity(
    await readRunner(sealedRunnerPath, owner, 0o440),
    identityContract
  );
  if (
    staged.sha256 !== sealed.sha256 ||
    !staged.bytes.equals(sealed.bytes) ||
    !SHA256.test(staged.sha256)
  )
    fail();
  await publish(sealedIdentityPath, sealed.bytes, owner);
  return Object.freeze({ runnerIdentitySha256: sealed.sha256 });
}
