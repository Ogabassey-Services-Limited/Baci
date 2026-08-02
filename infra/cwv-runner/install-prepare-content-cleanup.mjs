import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import {
  assertNoLiveReferences,
  assertNoMount,
  assertOwnedTree,
  liveMountPoints,
  removeOwnedTree,
} from './install-prepare-content-safety.mjs';

const FIXED_ROOTS = Object.freeze([
  { kind: 'docker', path: '/srv/baci-cwv/docker' },
  { kind: 'containerd', path: '/srv/baci-cwv/containerd' },
]);
const ID = /^prepare-[a-z0-9][a-z0-9-]{0,52}$/;
const SHA = /^[a-f0-9]{64}$/;
const MARKER = '.baci-cwv-prepare-generation';
const TEMPORARY_MARKER = /^\.baci-cwv-prepare-generation-[0-9]+$/;
const TOP_LEVELS = Object.freeze({
  docker: new Set([
    MARKER,
    'buildkit',
    'containers',
    'image',
    'network',
    'overlay2',
    'plugins',
    'runtimes',
    'swarm',
    'tmp',
    'trust',
    'volumes',
  ]),
  containerd: new Set([
    MARKER,
    'io.containerd.content.v1.content',
    'io.containerd.metadata.v1.bolt',
    'io.containerd.runtime.v1.linux',
    'io.containerd.runtime.v2.task',
    'io.containerd.snapshotter.v1.native',
    'io.containerd.snapshotter.v1.overlayfs',
    'tmpmounts',
    'version',
  ]),
});
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
// biome-ignore format: bounded source file keeps this terminal helper compact
const fail = (message) => { throw new Error(message); };
const temporaryMarker = (name) => TEMPORARY_MARKER.test(name);
const canonical = (value) => {
  if (value === null || typeof value === 'boolean' || typeof value === 'string')
    return JSON.stringify(value);
  if (typeof value === 'number' && Number.isSafeInteger(value))
    return String(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (!value || typeof value !== 'object') fail('invalid content receipt');
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
    .join(',')}}`;
};
async function syncDirectory(directory) {
  const handle = await fs.open(directory, 'r');
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}
async function privateDirectory(directory, uid, gid) {
  const details = await fs.lstat(directory);
  if (
    !details.isDirectory() ||
    details.isSymbolicLink() ||
    details.uid !== uid ||
    details.gid !== gid ||
    (details.mode & 0o077) !== 0
  )
    fail('private campaign directory required');
}
async function captureRow(root, uid, gid, points) {
  const parent = path.dirname(root.path);
  const parentDetails = await fs.lstat(parent);
  if (
    !parentDetails.isDirectory() ||
    parentDetails.isSymbolicLink() ||
    parentDetails.uid !== uid ||
    parentDetails.gid !== gid
  )
    fail('root-owned content parent required');
  assertNoMount(root.path, points);
  try {
    const details = await fs.lstat(root.path);
    if (
      !details.isDirectory() ||
      details.isSymbolicLink() ||
      details.uid !== uid ||
      details.gid !== gid ||
      (details.mode & 0o777) !== 0o700 ||
      details.dev !== parentDetails.dev ||
      (await fs.readdir(root.path)).length !== 0
    )
      fail('content root must be empty and root-owned');
    return {
      kind: root.kind,
      path: root.path,
      prior: 'empty',
      dev: details.dev,
      ino: details.ino,
      uid,
      gid,
      mode: 0o700,
      parentDev: parentDetails.dev,
      parentIno: parentDetails.ino,
    };
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return {
      kind: root.kind,
      path: root.path,
      prior: 'absent',
      uid,
      gid,
      mode: 0o700,
      parentDev: parentDetails.dev,
      parentIno: parentDetails.ino,
    };
  }
}
async function atomicFile(directory, name, bytes) {
  const temporaryName = `${name.startsWith('.') ? '' : '.'}${name}-${process.pid}`;
  const temporary = path.join(directory, temporaryName);
  const handle = await fs.open(temporary, 'wx', 0o600);
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
  await fs.rename(temporary, path.join(directory, name));
  await syncDirectory(directory);
}

export async function capturePrepareContentRoots(options) {
  const {
    transactionId,
    campaign: campaignDirectory,
    roots = FIXED_ROOTS,
    owner = 0,
    group = 0,
    mountPoints = await liveMountPoints(),
  } = options;
  if (!ID.test(transactionId) || roots.length !== 2)
    fail('fixed prepare transaction required');
  await privateDirectory(campaignDirectory, owner, group);
  const rows = [];
  for (const root of roots) {
    if (!TOP_LEVELS[root.kind]) fail('fixed content root required');
    rows.push(await captureRow(root, owner, group, mountPoints));
  }
  const identity = { schemaVersion: 1, transactionId, roots: rows };
  const receipt = { ...identity, generation: sha256(canonical(identity)) };
  const bytes = canonical(receipt);
  await atomicFile(campaignDirectory, 'prepare-content-roots.json', bytes);
  await atomicFile(
    campaignDirectory,
    'prepare-content-roots.sha256',
    `${sha256(bytes)}\n`
  );
  return receipt;
}

async function assertReceipt(options, receipt) {
  const bytes = canonical(receipt);
  const [stored, digest] = await Promise.all([
    fs.readFile(
      path.join(options.campaign, 'prepare-content-roots.json'),
      'utf8'
    ),
    fs.readFile(
      path.join(options.campaign, 'prepare-content-roots.sha256'),
      'utf8'
    ),
  ]);
  if (
    stored !== bytes ||
    digest !== `${sha256(bytes)}\n` ||
    receipt.transactionId !== options.transactionId ||
    !SHA.test(receipt.generation) ||
    receipt.generation !==
      sha256(
        canonical({
          schemaVersion: receipt.schemaVersion,
          transactionId: receipt.transactionId,
          roots: receipt.roots,
        })
      )
  )
    fail('content receipt identity mismatch');
}

export async function activatePrepareContentRoots(options) {
  const { receipt, owner = 0, group = 0 } = options;
  const mountPoints = options.mountPoints ?? (await liveMountPoints());
  await assertReceipt(options, receipt);
  for (const row of receipt.roots) {
    const parent = await fs.lstat(path.dirname(row.path));
    if (parent.dev !== row.parentDev || parent.ino !== row.parentIno)
      fail('content parent identity drift');
    assertNoMount(row.path, mountPoints);
    if (row.prior === 'absent') await fs.mkdir(row.path, { mode: 0o700 });
    const details = await fs.lstat(row.path);
    if (
      !details.isDirectory() ||
      details.isSymbolicLink() ||
      details.uid !== owner ||
      details.gid !== group ||
      (row.prior === 'empty' &&
        (details.dev !== row.dev || details.ino !== row.ino)) ||
      (await fs.readdir(row.path)).length !== 0
    )
      fail('content root identity drift');
    await atomicFile(
      row.path,
      MARKER,
      `${receipt.transactionId}:${receipt.generation}\n`
    );
  }
}

export async function cleanupPrepareContentRoots(options) {
  const { receipt, owner = 0, group = 0, assertQuiescent } = options;
  const quiescent = assertQuiescent ?? assertNoLiveReferences;
  const mountPoints = options.mountPoints ?? (await liveMountPoints());
  await assertReceipt(options, receipt);
  await quiescent(receipt.roots);
  for (const row of receipt.roots) {
    assertNoMount(row.path, mountPoints);
    let details;
    try {
      details = await fs.lstat(row.path);
    } catch (error) {
      if (row.prior === 'absent' && error.code === 'ENOENT') continue;
      throw error;
    }
    if (
      !details.isDirectory() ||
      details.isSymbolicLink() ||
      details.uid !== owner ||
      details.gid !== group ||
      (row.prior === 'empty' &&
        (details.dev !== row.dev || details.ino !== row.ino))
    )
      fail(
        details.isSymbolicLink()
          ? 'content root symlink'
          : 'content root identity drift'
      );
    assertNoMount(row.path, mountPoints);
    const names = await fs.readdir(row.path);
    const marker = names.includes(MARKER);
    const temporaryMarkers = names.filter(temporaryMarker);
    if (marker) {
      const value = await fs.readFile(path.join(row.path, MARKER), 'utf8');
      if (value !== `${receipt.transactionId}:${receipt.generation}\n`)
        fail('content generation drift');
    } else if (names.length !== temporaryMarkers.length)
      fail('content generation missing');
    for (const name of names) {
      if (!TOP_LEVELS[row.kind].has(name) && !temporaryMarker(name))
        fail('foreign content path');
      if (temporaryMarker(name)) {
        const value = await fs.readFile(path.join(row.path, name), 'utf8');
        if (value !== `${receipt.transactionId}:${receipt.generation}\n`)
          fail('content generation drift');
      }
      await assertOwnedTree(
        row.path,
        path.join(row.path, name),
        row,
        mountPoints,
        owner,
        group
      );
    }
    for (const name of names)
      await removeOwnedTree(
        row.path,
        path.join(row.path, name),
        row,
        mountPoints,
        owner,
        group
      );
    if (row.prior === 'absent') await fs.rmdir(row.path);
    await syncDirectory(path.dirname(row.path));
  }
}
