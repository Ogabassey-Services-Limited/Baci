import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';

const HEX = /^[0-9a-f]{64}$/;
const fail = (message) => {
  throw new TypeError(message);
};
const validTimestamp = (value) => typeof value === 'bigint' && value >= 0n;
const closeHandle = async (handle) => handle?.close();

async function privateDirectory(path) {
  const info = await lstat(path);
  if (
    !info.isDirectory() ||
    info.isSymbolicLink() ||
    info.uid !== process.getuid() ||
    (info.mode & 0o077) !== 0
  )
    fail('private destination directory required');
}

export async function copyExternalNoFollow(options) {
  const { source, destination, identity, expectedSha256, maxBytes } = options;
  if (
    typeof source !== 'string' ||
    !source.startsWith('/') ||
    typeof destination !== 'string' ||
    !destination.startsWith('/') ||
    !identity ||
    !/^[0-9]+$/.test(identity.device) ||
    !/^[0-9]+$/.test(identity.inode) ||
    !HEX.test(expectedSha256) ||
    !Number.isSafeInteger(maxBytes) ||
    maxBytes < 1 ||
    maxBytes > 2 ** 31
  )
    fail('invalid no-follow copy contract');
  await privateDirectory(dirname(destination));
  let input;
  let output;
  let created = false;
  let complete = false;
  let result;
  let copyFailure;
  let closeFailures = [];
  try {
    try {
      input = await open(source, constants.O_RDONLY | constants.O_NOFOLLOW);
    } catch (error) {
      throw new Error(`no-follow input refused: ${error.code ?? 'open'}`);
    }
    const before = await input.stat({ bigint: true });
    if (
      !before.isFile() ||
      before.isSymbolicLink?.() ||
      String(before.dev) !== identity.device ||
      String(before.ino) !== identity.inode ||
      before.size < 0n ||
      before.size > BigInt(maxBytes) ||
      !validTimestamp(before.mtimeNs) ||
      !validTimestamp(before.ctimeNs)
    )
      fail('external input identity mismatch');
    output = await open(
      destination,
      constants.O_WRONLY |
        constants.O_CREAT |
        constants.O_EXCL |
        constants.O_NOFOLLOW,
      0o600
    );
    created = true;
    const hash = createHash('sha256');
    const buffer = Buffer.allocUnsafe(64 * 1024);
    let position = 0;
    const size = Number(before.size);
    if (!Number.isSafeInteger(size)) fail('external input size is not safe');
    while (position < size) {
      const length = Math.min(buffer.length, size - position);
      const { bytesRead } = await input.read(buffer, 0, length, position);
      if (bytesRead === 0) fail('external input changed during copy');
      hash.update(buffer.subarray(0, bytesRead));
      let written = 0;
      while (written < bytesRead) {
        const { bytesWritten } = await output.write(
          buffer,
          written,
          bytesRead - written,
          position + written
        );
        if (!Number.isSafeInteger(bytesWritten) || bytesWritten < 1)
          fail('external output short write');
        written += bytesWritten;
      }
      position += bytesRead;
    }
    const after = await input.stat({ bigint: true });
    if (
      after.dev !== before.dev ||
      after.ino !== before.ino ||
      after.size !== before.size ||
      !validTimestamp(after.mtimeNs) ||
      !validTimestamp(after.ctimeNs) ||
      after.mtimeNs !== before.mtimeNs ||
      after.ctimeNs !== before.ctimeNs
    )
      fail('external input changed during copy');
    const sha256 = hash.digest('hex');
    if (sha256 !== expectedSha256) fail('owner-frozen input digest mismatch');
    await output.sync();
    complete = true;
    result = { destination, sha256, bytes: position };
  } catch (error) {
    copyFailure = error;
  } finally {
    const closeResults = await Promise.allSettled([
      closeHandle(output),
      closeHandle(input),
    ]);
    closeFailures = closeResults.filter(
      (result) => result.status === 'rejected'
    );
    if (closeFailures.length > 0) complete = false;
    if (created && !complete) await unlink(destination).catch(() => undefined);
  }
  if (closeFailures.length === 1) throw closeFailures[0].reason;
  if (closeFailures.length > 1)
    throw new AggregateError(
      closeFailures.map((failure) => failure.reason),
      'failed to close copied input resources'
    );
  if (copyFailure) throw copyFailure;
  return result;
}

if (import.meta.filename === process.argv[1]) {
  const [command, source, destination, device, inode, expectedSha256, maximum] =
    process.argv.slice(2);
  if (command !== 'copy') throw new Error('unsupported input-copy command');
  copyExternalNoFollow({
    source,
    destination,
    identity: { device, inode },
    expectedSha256,
    maxBytes: Number(maximum),
  })
    .then((result) => process.stdout.write(`${JSON.stringify(result)}\n`))
    .catch((error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    });
}
