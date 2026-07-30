import { open, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';

async function syncDirectory(path) {
  const handle = await open(path, 'r');
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

export async function writeBootstrapStateFileAtomic(
  directory,
  name,
  bytes,
  descriptor = {}
) {
  if (name !== 'capture.json')
    throw new TypeError('invalid atomic bootstrap state file');
  const temporary = join(directory, '.capture-json-stage');
  const destination = join(directory, name);
  const openFile = descriptor.openFile ?? open;
  const renameFile = descriptor.renameFile ?? rename;
  const removeFile = descriptor.removeFile ?? rm;
  const syncParent = descriptor.syncDirectory ?? syncDirectory;
  let handle;
  let created = false;
  try {
    handle = await openFile(temporary, 'wx', 0o600);
    created = true;
    await handle.writeFile(bytes);
    await handle.sync();
    await handle.close();
    handle = undefined;
    await renameFile(temporary, destination);
    created = false;
    await syncParent(directory);
  } catch (error) {
    if (handle) {
      try {
        await handle.close();
      } catch {
        // Preserve the publication failure.
      }
    }
    if (created) {
      try {
        await removeFile(temporary, { force: true });
        await syncParent(directory);
      } catch {
        // Best effort only; pre-capture recovery handles durable residue.
      }
    }
    throw error;
  }
}
