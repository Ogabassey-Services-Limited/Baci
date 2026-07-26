import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import path from 'node:path';

import { assertRegistrationTokenMount } from './registration-token-mount.mjs';

const ROOTS = Object.freeze({
  registrationToken: '/run/baci-cwv-registration',
  registrationRelease: '/run/baci-cwv-registration-release',
  admission: '/srv/baci-cwv/allow',
  registrationStaging: '/srv/baci-cwv/registration-staging',
  prepareImport: '/srv/baci-cwv/import',
  dedicatedRuntime: '/srv/baci-cwv/dedicated-runtime',
});
const actions = Object.freeze({
  'registration-token-layout-created': [
    'registrationToken',
    /^[a-f0-9]{32}$/,
    'tree',
  ],
  'registration-token-created': [
    'registrationToken',
    /^([^/]+)\/token$/,
    'file',
  ],
  'registration-release-created': [
    'registrationRelease',
    /^([^/]+)\/handoff\/release\.json$/,
    'file',
  ],
  'registration-release-layout-created': [
    'registrationRelease',
    /^[a-f0-9]{32}\/handoff$/,
    'tree',
  ],
  'admission-published': ['admission', /^active\.json$/, 'file'],
  'registration-staging-created': ['registrationStaging', /^([^/]+)$/, 'tree'],
  'prepare-import-created': ['prepareImport', /^([^/]+)$/, 'tree'],
  'prepare-synthetic-created': [
    'dedicatedRuntime',
    /^prepare\/synthetic\/([^/]+)\.json$/,
    'file',
  ],
  'prepare-target-verified': [
    'dedicatedRuntime',
    /^prepare\/target\/([^/]+)\.json$/,
    'file',
  ],
  'target-accepted': [
    'dedicatedRuntime',
    /^prepare\/accepted\/([^/]+)\.json$/,
    'file',
  ],
});
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const safe = (value) =>
  typeof value === 'string' && value.length > 0 && !value.includes('..');
// biome-ignore format: fixed receipt key set stays within the executable line cap
const receiptKeys = ['schemaVersion', 'root', 'rootDev', 'rootIno', 'relative', 'type', 'dev', 'ino', 'uid', 'mode', 'contentSha256'];
// biome-ignore format: fixed terminal action set stays within the executable line cap
const tokenActions = new Set(['registration-token-created', 'registration-token-layout-created']);

export function terminalActionPath(
  action,
  receipt,
  transactionId,
  roots = ROOTS
) {
  const definition = Object.hasOwn(actions, action) && actions[action];
  const tokenAction = tokenActions.has(action);
  if (!definition || !receipt || receipt.schemaVersion !== 1)
    throw new Error('closed terminal action required');
  const hasMutable = Object.hasOwn(receipt, 'mutable');
  if (
    (hasMutable &&
      (receipt.mutable !== true ||
        !['prepare-import-created', 'registration-staging-created'].includes(
          action
        ))) ||
    JSON.stringify(Object.keys(receipt).sort()) !==
      JSON.stringify(
        [
          ...receiptKeys,
          ...(tokenAction ? ['mountDev', 'mountIno', 'mountRelative'] : []),
          ...(hasMutable ? ['mutable'] : []),
        ].sort()
      )
  )
    throw new Error(
      hasMutable
        ? 'invalid mutable terminal receipt'
        : 'invalid terminal receipt'
    );
  const [rootKey, pattern, type] = definition;
  if (
    receipt.root !== roots[rootKey] ||
    !safe(receipt.relative) ||
    receipt.type !== type ||
    (action === 'registration-staging-created' &&
      (receipt.uid !== 10001 || receipt.mode !== 0o700 || !hasMutable)) ||
    (action === 'registration-token-layout-created' &&
      (receipt.uid !== 0 || receipt.mode !== 0o700 || hasMutable)) ||
    (tokenAction &&
      (!/^[a-f0-9]{32}$/.test(receipt.mountRelative) ||
        !Number.isSafeInteger(receipt.mountDev) ||
        !Number.isSafeInteger(receipt.mountIno) ||
        receipt.mountDev === receipt.rootDev ||
        (action === 'registration-token-layout-created'
          ? receipt.relative !== receipt.mountRelative
          : receipt.relative !== `${receipt.mountRelative}/token`))) ||
    (action === 'registration-release-layout-created' &&
      (receipt.uid !== 0 || receipt.mode !== 0o750 || hasMutable))
  )
    throw new Error('fixed root receipt required');
  const match = pattern.exec(receipt.relative);
  if (
    !match ||
    (action.startsWith('prepare-') && match[1] !== transactionId) ||
    (action === 'target-accepted' && match[1] !== transactionId)
  )
    throw new Error('terminal receipt identity mismatch');
  const target = path.resolve(receipt.root, receipt.relative);
  if (!target.startsWith(`${receipt.root}${path.sep}`))
    throw new Error('cross-root substitution');
  return target;
}
async function assertAncestors(root, target, owner, receipt) {
  const rootDetails = await fs.lstat(root);
  if (
    !rootDetails.isDirectory() ||
    rootDetails.isSymbolicLink() ||
    rootDetails.dev !== receipt.rootDev ||
    rootDetails.ino !== receipt.rootIno ||
    rootDetails.uid !== owner ||
    (rootDetails.mode & 0o077) !== 0
  )
    throw new Error('unsafe terminal root');
  for (
    let cursor = path.dirname(target);
    cursor !== root;
    cursor = path.dirname(cursor)
  ) {
    const details = await fs.lstat(cursor);
    if (
      !details.isDirectory() ||
      details.isSymbolicLink() ||
      details.dev !== rootDetails.dev ||
      details.uid !== owner ||
      (details.mode & 0o077) !== 0
    )
      throw new Error('unsafe terminal ancestor');
  }
}
async function treeHash(root, owner, device) {
  const names = (await fs.readdir(root)).sort();
  const rows = [];
  for (const name of names) {
    const child = path.join(root, name);
    const details = await fs.lstat(child);
    if (
      details.isSymbolicLink() ||
      details.dev !== device ||
      details.uid !== owner ||
      (details.mode & 0o077) !== 0 ||
      (!details.isDirectory() && !details.isFile())
    )
      throw new Error('unsafe terminal tree');
    rows.push(
      `${name}:${details.mode & 0o777}:${details.isDirectory() ? await treeHash(child, owner, device) : sha256(await fs.readFile(child))}`
    );
  }
  return sha256(rows.join('\n'));
}
async function assertMutableTree(root, owner, device) {
  for (const name of await fs.readdir(root)) {
    const child = path.join(root, name);
    const details = await fs.lstat(child);
    if (
      details.isSymbolicLink() ||
      details.dev !== device ||
      details.uid !== owner ||
      (details.mode & 0o077) !== 0 ||
      (!details.isFile() && !details.isDirectory())
    )
      throw new Error('unsafe mutable prepare tree');
    if (details.isDirectory()) await assertMutableTree(child, owner, device);
  }
}
// biome-ignore format: tmpfs teardown requires one compact conditional trust boundary
async function assertBound(action, target, receipt, owner, rootOwner = owner, requireMounted = true) {
  const tokenAction = tokenActions.has(action);
  const mount = path.join(receipt.root, receipt.mountRelative ?? '');
  await assertAncestors(receipt.root, tokenAction ? mount : target, rootOwner, receipt);
  const details = await fs.lstat(target);
  const mounted = tokenAction && details.dev === receipt.mountDev;
  if (mounted) {
    const mountDetails = await fs.lstat(mount);
    if (mountDetails.dev !== receipt.mountDev || mountDetails.ino !== receipt.mountIno)
      throw new Error('terminal mount identity mismatch');
    await assertRegistrationTokenMount(mount, mountDetails);
  }
  if (
    details.isSymbolicLink() ||
    (!tokenAction &&
      (receipt.rootDev !== receipt.dev ||
        details.dev !== receipt.dev ||
        details.dev !== receipt.rootDev)) ||
    (tokenAction &&
      (!mounted &&
        (requireMounted ||
          action !== 'registration-token-layout-created' ||
          details.dev !== receipt.rootDev)) ||
        (mounted && (details.dev !== receipt.dev || details.ino !== receipt.ino))) ||
    (!tokenAction && details.ino !== receipt.ino) ||
    details.uid !== receipt.uid ||
    details.uid !== owner ||
    (details.mode & 0o777) !== receipt.mode
  )
    throw new Error('terminal identity mismatch');
  if (receipt.mutable === true)
    await assertMutableTree(target, owner, receipt.rootDev);
  else {
    const actual =
      receipt.type === 'tree'
        ? await treeHash(target, owner, tokenAction ? receipt.mountDev : receipt.rootDev)
        : sha256(await fs.readFile(target));
    if (actual !== receipt.contentSha256)
      throw new Error('terminal content mismatch');
  }
}
export async function cleanupTerminalReceipt(
  action,
  receipt,
  transactionId,
  owner = 0,
  roots = ROOTS
) {
  const target = terminalActionPath(action, receipt, transactionId, roots);
  const targetOwner = action === 'registration-staging-created' ? 10001 : owner;
  let exists = true;
  try {
    await fs.lstat(target);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    exists = false;
  }
  if (exists) {
    await assertBound(action, target, receipt, targetOwner, owner, false);
    await fs.rm(target, { recursive: receipt.type === 'tree', force: false });
  }
  for (
    let cursor = path.dirname(target);
    cursor !== receipt.root;
    cursor = path.dirname(cursor)
  ) {
    try {
      await fs.rmdir(cursor);
    } catch (error) {
      if (error.code === 'ENOTEMPTY') break;
      if (error.code !== 'ENOENT') throw error;
    }
  }
}

export async function validateTerminalReceipt(
  action,
  receipt,
  transactionId,
  owner = 0,
  roots = ROOTS
) {
  const target = terminalActionPath(action, receipt, transactionId, roots);
  const targetOwner = action === 'registration-staging-created' ? 10001 : owner;
  await assertBound(action, target, receipt, targetOwner, owner);
  return target;
}
if (import.meta.filename === process.argv[1]) {
  const values = process.argv.slice(2);
  const validateOnly = values[0] === '--validate';
  const [action, transactionId, receipt] = values.slice(validateOnly ? 1 : 0);
  Promise.resolve()
    .then(() => {
      if (values.length !== (validateOnly ? 4 : 3))
        throw new Error('invalid terminal receipt invocation');
      try {
        return JSON.parse(receipt);
      } catch {
        throw new Error('invalid terminal receipt JSON');
      }
    })
    .then((parsed) =>
      validateOnly
        ? validateTerminalReceipt(action, parsed, transactionId)
        : cleanupTerminalReceipt(action, parsed, transactionId)
    )
    .catch((error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    });
}
