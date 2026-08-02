import { readSync as readFromDescriptor } from 'node:fs';

const TOKEN_FD = 3;
const MINIMUM_BYTES = 21;
const MAXIMUM_BYTES = 129;

const fail = () => {
  throw new TypeError('registration token fd refused');
};
const validToken = (bytes) =>
  bytes.length >= MINIMUM_BYTES &&
  bytes.length <= MAXIMUM_BYTES &&
  bytes.at(-1) === 10 &&
  bytes
    .subarray(0, -1)
    .every(
      (byte) =>
        (byte >= 48 && byte <= 57) ||
        (byte >= 65 && byte <= 90) ||
        (byte >= 97 && byte <= 122)
    );

export function readRegistrationTokenFd(fd, dependencies = {}) {
  const readSync = dependencies.readSync ?? readFromDescriptor;
  if (fd !== TOKEN_FD || typeof readSync !== 'function') fail();
  const bytes = Buffer.alloc(MAXIMUM_BYTES);
  const overflow = Buffer.alloc(1);
  try {
    let length = 0;
    while (length < bytes.length) {
      const count = readSync(fd, bytes, length, bytes.length - length, null);
      if (
        !Number.isSafeInteger(count) ||
        count < 0 ||
        count > bytes.length - length
      )
        fail();
      if (count === 0) break;
      length += count;
    }
    const extra = readSync(fd, overflow, 0, overflow.length, null);
    if (extra !== 0) fail();
    const token = bytes.subarray(0, length);
    if (!validToken(token)) fail();
    return token;
  } catch (error) {
    bytes.fill(0);
    throw error;
  } finally {
    overflow.fill(0);
  }
}
