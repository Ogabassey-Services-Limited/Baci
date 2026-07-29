import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { link, open, readFile, unlink } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

const HEX = /^[0-9a-f]{64}$/;
const SOURCE = /^[0-9a-f]{40}$/;
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const stable = (value) =>
  Array.isArray(value)
    ? value.map(stable)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, stable(value[key])])
        )
      : value;
const canonical = (value) => JSON.stringify(stable(value));
const same = (left, right) => canonical(left) === canonical(right);

async function syncDirectory(directory) {
  const handle = await open(directory, 'r');
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function assertExactRegularFile(path, bytes, drift) {
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch (error) {
    if (error.code === 'ELOOP') throw new TypeError(drift);
    throw error;
  }
  try {
    const details = await handle.stat();
    if (
      !details.isFile() ||
      details.uid !== process.getuid() ||
      (details.mode & 0o777) !== 0o600
    )
      throw new TypeError(drift);
    if ((await handle.readFile('utf8')) !== bytes) throw new TypeError(drift);
  } finally {
    await handle.close();
  }
}

async function removeTemporary(handle, temporaryPath, directory) {
  if (handle) await handle.close();
  try {
    await unlink(temporaryPath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  await syncDirectory(directory);
}

async function writeExclusiveOrExact(path, bytes, drift, dependencies = {}) {
  const writeValue =
    dependencies.writeValue ?? ((handle) => handle.writeFile(bytes));
  const directory = dirname(path);
  const temporaryPath = join(
    directory,
    `.${basename(path)}.${process.pid}.${randomUUID()}.tmp`
  );
  let handle;
  let created = true;
  let temporaryExists = false;
  try {
    handle = await open(temporaryPath, 'wx', 0o600);
    temporaryExists = true;
    await handle.chmod(0o600);
    await writeValue(handle, bytes);
    await handle.sync();
    await handle.close();
    handle = undefined;
    try {
      await link(temporaryPath, path);
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      await assertExactRegularFile(path, bytes, drift);
      created = false;
    }
    if (created) await syncDirectory(directory);
  } catch (error) {
    if (temporaryExists)
      await removeTemporary(handle, temporaryPath, directory).catch(
        () => undefined
      );
    throw error;
  }
  await removeTemporary(handle, temporaryPath, directory);
  return created;
}

async function persistBoundReplacement(
  directory,
  name,
  value,
  drift,
  dependencies = {}
) {
  const afterValue = dependencies?.afterValue ?? (() => undefined);
  const bytes = canonical(value);
  const path = join(directory, `${name}.json`);
  const digestPath = join(directory, `${name}.sha256`);
  const created = await writeExclusiveOrExact(path, bytes, drift, dependencies);
  await syncDirectory(directory);
  if (created) await afterValue();
  await writeExclusiveOrExact(digestPath, `${sha256(bytes)}\n`, drift);
  await syncDirectory(directory);
  return value;
}

export async function persistBootstrapReplacementIntent(
  directory,
  intent,
  dependencies
) {
  return await persistBoundReplacement(
    directory,
    'replacement-intent',
    intent,
    'bootstrap replacement intent drift',
    dependencies
  );
}

export async function persistBootstrapReplacementReceipt(
  directory,
  receipt,
  dependencies
) {
  return await persistBoundReplacement(
    directory,
    'replacement-receipt',
    receipt,
    'bootstrap replacement receipt drift',
    dependencies
  );
}

export async function readBootstrapReplacementIntent(directory) {
  return await readBoundReplacement(directory, 'replacement-intent', false);
}

export async function readBootstrapReplacementReceipt(directory) {
  return await readBoundReplacement(directory, 'replacement-receipt', true);
}

async function readBoundReplacement(directory, name, receipt) {
  const [bytes, digest] = await Promise.all([
    readFile(join(directory, `${name}.json`), 'utf8'),
    readFile(join(directory, `${name}.sha256`), 'utf8'),
  ]);
  if (digest !== `${sha256(bytes)}\n`)
    throw new TypeError(`bootstrap ${name} digest mismatch`);
  const intent = JSON.parse(bytes);
  if (
    intent.schemaVersion !== 1 ||
    !['complete', 'pristine'].includes(intent.baselineKind) ||
    !SOURCE.test(intent.baselineSourceSha ?? '') ||
    !HEX.test(intent.baselineStateSha256 ?? '') ||
    !SOURCE.test(intent.sourceSha ?? '') ||
    !HEX.test(intent.captureSha256 ?? '') ||
    !HEX.test(intent.installedProjectionSha256 ?? '') ||
    !HEX.test(intent.pathSetSha256 ?? '') ||
    !HEX.test(intent.policyFileSha256 ?? '') ||
    !Array.isArray(intent.authorityChain) ||
    intent.authorityChain.length < 2 ||
    intent.authorityChain.some(
      (row) =>
        !SOURCE.test(row?.sourceSha ?? '') ||
        !HEX.test(row?.stateSha256 ?? '') ||
        !HEX.test(row?.journalTipSha256 ?? '') ||
        !HEX.test(row?.sealReceiptSha256 ?? '') ||
        !same(Object.keys(row).sort(), [
          'journalTipSha256',
          'sealReceiptSha256',
          'sourceSha',
          'stateSha256',
        ])
    ) ||
    !Array.isArray(intent.transitionPaths) ||
    !intent.transitionPaths.length ||
    intent.transitionPaths.some((path) => typeof path !== 'string') ||
    !same(intent.transitionPaths, [...intent.transitionPaths].sort()) ||
    new Set(intent.transitionPaths).size !== intent.transitionPaths.length ||
    !same(
      Object.keys(intent).sort(),
      [
        'authorityChain',
        'baselineKind',
        'baselineSourceSha',
        'baselineStateSha256',
        'captureSha256',
        'installedProjectionSha256',
        'pathSetSha256',
        'policyFileSha256',
        'schemaVersion',
        'sourceSha',
        'transitionPaths',
        ...(receipt ? ['receiptSha256'] : []),
      ].sort()
    ) ||
    (receipt && !HEX.test(intent.receiptSha256 ?? ''))
  )
    throw new TypeError(`invalid bootstrap ${name}`);
  return intent;
}
