import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { link, open, unlink } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

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

export async function persistBoundReplacement(
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
