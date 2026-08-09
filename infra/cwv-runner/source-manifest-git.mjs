import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const TRUSTED_GIT = '/usr/bin/git';
function trustedGitEnvironment() {
  const env = {
    PATH: '/usr/bin:/bin',
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_NO_REPLACE_OBJECTS: '1',
  };
  for (const key of ['HOME', 'LANG', 'LC_ALL', 'TZ']) {
    if (typeof process.env[key] === 'string') env[key] = process.env[key];
  }
  return env;
}

const fail = (message) => {
  throw new TypeError(message);
};

export function git(cwd, args, input, encoding = 'utf8') {
  return execFileSync(TRUSTED_GIT, args, {
    cwd,
    encoding,
    input,
    env: trustedGitEnvironment(),
    maxBuffer: 512 * 1024 * 1024,
  });
}

export function verifyObjects(cwd, objectIds) {
  const ids = [...new Set(objectIds)];
  const verified = new Map();
  const output = git(cwd, ['cat-file', '--batch'], `${ids.join('\n')}\n`, null);
  let offset = 0;
  for (const objectId of ids) {
    const headerEnd = output.indexOf(0x0a, offset);
    if (headerEnd < 0) fail('malformed Git object response');
    const [reported, type, sizeText] = output
      .subarray(offset, headerEnd)
      .toString('utf8')
      .split(' ');
    const size = Number(sizeText);
    const start = headerEnd + 1;
    if (
      reported !== objectId ||
      !/^(blob|commit|tree|tag)$/.test(type) ||
      !Number.isSafeInteger(size) ||
      size < 0 ||
      output.length < start + size + 1
    )
      fail('malformed Git object response');
    const bytes = output.subarray(start, start + size);
    const algorithm = objectId.length === 64 ? 'sha256' : 'sha1';
    const actual = createHash(algorithm)
      .update(Buffer.concat([Buffer.from(`${type} ${size}\0`), bytes]))
      .digest('hex');
    if (actual !== objectId) fail('Git object hash mismatch');
    verified.set(`${cwd}\0${objectId}`, { type, bytes: Buffer.from(bytes) });
    offset = start + size + 1;
  }
  return verified;
}

export function objectBytes(cwd, objectId) {
  if (!/^[0-9a-f]{40,64}$/.test(objectId)) fail('invalid Git object id');
  const object = verifyObjects(cwd, [objectId]).get(`${cwd}\0${objectId}`);
  if (!object || object.type !== 'blob') fail('invalid Git blob');
  return Buffer.from(object.bytes);
}
