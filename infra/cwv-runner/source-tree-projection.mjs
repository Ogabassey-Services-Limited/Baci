import { createHash } from 'node:crypto';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const safePath = (path) =>
  typeof path === 'string' &&
  path === path.normalize('NFC') &&
  !path.startsWith('/') &&
  !path.includes('\\') &&
  ![...path].some(
    (character) =>
      character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127
  ) &&
  path.split('/').every((part) => part && part !== '.' && part !== '..');

export function gitSourceProjection(manifest, runGit) {
  let bytes;
  try {
    bytes = runGit([
      'ls-tree',
      '-r',
      '-z',
      manifest.mergeSha,
      '--',
      manifest.sourceArchive.prefix,
    ]);
  } catch {
    throw new TypeError('source archive Git tree unavailable');
  }
  let records;
  try {
    records = new TextDecoder('utf-8', { fatal: true })
      .decode(bytes)
      .split('\0')
      .filter(Boolean);
  } catch {
    throw new TypeError('invalid source archive Git tree');
  }
  return records.map((record) => {
    const match = /^(\d{6}) (\S+) ([0-9a-f]{40,64})\t([\s\S]+)$/.exec(record);
    if (
      match?.[2] !== 'blob' ||
      !/^(100644|100755)$/.test(match[1]) ||
      !safePath(match[4]) ||
      !match[4].startsWith(manifest.sourceArchive.prefix)
    )
      throw new TypeError('invalid source archive Git tree');
    let bytes;
    try {
      bytes = runGit(['cat-file', 'blob', match[3]]);
    } catch {
      throw new TypeError('source archive Git blob unavailable');
    }
    return { blobSha256: sha256(bytes), mode: match[1], path: match[4] };
  });
}
