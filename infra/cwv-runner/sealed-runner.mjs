import {
  closeSync,
  constants,
  fstatSync,
  openSync,
  readFileSync,
} from 'node:fs';

import { pinnedRunnerIdentity } from './policy.schema.mjs';

const fail = (message) => {
  throw new TypeError(message);
};

const sealedFilesystem = Object.freeze({
  close: closeSync,
  fstat: fstatSync,
  open: openSync,
  read: readFileSync,
});

export function validateSealedRunnerFileMetadata(info) {
  if (
    !info.isFile() ||
    info.uid !== 0 ||
    info.gid !== pinnedRunnerIdentity.runnerGid ||
    (info.mode & 0o777) !== 0o440
  )
    fail('sealed runner file refused');
}

export function readSealedRunnerFile(path, filesystem = sealedFilesystem) {
  const descriptor = filesystem.open(
    path,
    constants.O_RDONLY | constants.O_NOFOLLOW
  );
  try {
    validateSealedRunnerFileMetadata(filesystem.fstat(descriptor));
    return filesystem.read(descriptor, 'utf8');
  } finally {
    filesystem.close(descriptor);
  }
}
