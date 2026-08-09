import { createHash } from 'node:crypto';

import { git } from './source-manifest-git.mjs';

const fail = (message) => {
  throw new TypeError(message);
};

export function verifyGitObjects(cwd, objectIds) {
  const ids = [...new Set(objectIds)];
  const verified = new Map();
  const output = git(cwd, ['cat-file', '--batch'], `${ids.join('\n')}\n`, null);
  let offset = 0;
  for (const objectId of ids) {
    const headerEnd = output.indexOf(0x0a, offset);
    if (headerEnd < 0) fail('malformed Git object response');
    const [reported, type, sizeText] = output.subarray(offset, headerEnd).toString('utf8').split(' ');
    const size = Number(sizeText);
    const start = headerEnd + 1;
    if (reported !== objectId || !/^(blob|commit|tree|tag)$/.test(type) || !Number.isSafeInteger(size) || size < 0 || output.length < start + size + 1) fail('malformed Git object response');
    const bytes = output.subarray(start, start + size);
    const algorithm = objectId.length === 64 ? 'sha256' : 'sha1';
    const actual = createHash(algorithm).update(Buffer.concat([Buffer.from(`${type} ${size}\0`), bytes])).digest('hex');
    if (actual !== objectId) fail('Git object hash mismatch');
    verified.set(`${cwd}\0${objectId}`, { type, bytes: Buffer.from(bytes) });
    offset = start + size + 1;
  }
  return verified;
}
