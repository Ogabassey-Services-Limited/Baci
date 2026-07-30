import { lstat, mkdir, open, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { writeBootstrapStateFileAtomic } from './install-bootstrap-atomic-state-file.mjs';

const refuse = (message) => {
  throw new TypeError(message);
};
async function privateDirectory(path, create = false) {
  if (create) await mkdir(path, { mode: 0o700 });
  const info = await lstat(path);
  if (
    !info.isDirectory() ||
    info.isSymbolicLink() ||
    info.uid !== process.getuid() ||
    (info.mode & 0o777) !== 0o700
  )
    refuse('private state directory required');
}
async function writeExclusive(path, bytes) {
  const handle = await open(path, 'wx', 0o600);
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
}
async function syncDirectory(path) {
  const handle = await open(path, 'r');
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

export async function persistBootstrapCapture(
  stateRoot,
  capture,
  descriptor = {}
) {
  await privateDirectory(stateRoot);
  if (capture.phase !== 'captured') refuse('captured bootstrap state required');
  const directory = join(stateRoot, capture.transactionId);
  await privateDirectory(directory, true);
  await syncDirectory(stateRoot);
  await writeBootstrapStateFileAtomic(
    directory,
    'capture.json',
    capture.captureBytes,
    {
      openFile: descriptor.openCaptureFile,
      removeFile: descriptor.removeCaptureFile,
      renameFile: descriptor.renameCaptureFile,
      syncDirectory: descriptor.syncCaptureDirectory,
    }
  );
  await writeBootstrapStateFileAtomic(
    directory,
    'capture.sha256',
    `${capture.captureSha256}\n`,
    {
      openFile: descriptor.openCaptureDigestFile,
      removeFile: descriptor.removeCaptureDigestFile,
      renameFile: descriptor.renameCaptureDigestFile,
      syncDirectory: descriptor.syncCaptureDigestDirectory,
    }
  );
  await writeExclusive(join(directory, 'journal.ndjson'), '');
  const phase = join(directory, `.phase-${process.pid}`);
  await writeExclusive(phase, 'captured\n');
  await (descriptor.renamePhaseFile ?? rename)(phase, join(directory, 'phase'));
  await syncDirectory(directory);
  return directory;
}
