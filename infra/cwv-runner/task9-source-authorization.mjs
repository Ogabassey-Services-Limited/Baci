// biome-ignore-all format: descriptor-held source validation stays below the repository file limit
import { createHash } from 'node:crypto';
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readSync,
} from 'node:fs';
import { posix, relative, resolve } from 'node:path';

const fail = () => {
  throw new Error('source manifest refused');
};
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const same = (left, right) => left.dev === right.dev && left.ino === right.ino;
const POLICY_PATH = 'infra/cwv-runner/policy.json';

function assertHeldPaths(held) {
  for (const member of held) {
    const current = lstatSync(member.path);
    if (
      current.isSymbolicLink() ||
      !current.isFile() ||
      !same(current, fstatSync(member.descriptor))
    )
      fail();
  }
}

function openClosed(path) {
  const before = lstatSync(path);
  if (before.isSymbolicLink() || !before.isFile()) fail();
  const descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = fstatSync(descriptor);
    if (!stat.isFile() || !same(before, stat)) fail();
    const bytes = Buffer.alloc(stat.size);
    for (let offset = 0; offset < bytes.length; ) {
      const count = readSync(
        descriptor,
        bytes,
        offset,
        bytes.length - offset,
        offset
      );
      if (count < 1) fail();
      offset += count;
    }
    if (!same(stat, lstatSync(path))) fail();
    return { bytes, descriptor, path };
  } catch (error) {
    closeSync(descriptor);
    throw error;
  }
}

function canonical(value) {
  if (
    value === null ||
    ['string', 'boolean'].includes(typeof value) ||
    (typeof value === 'number' && Number.isFinite(value))
  )
    return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && Object.getPrototypeOf(value) === Object.prototype)
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(',')}}`;
  return fail();
}

function exact(value, keys) {
  return value && Object.getPrototypeOf(value) === Object.prototype && Object.keys(value).sort().join('\n') === [...keys].sort().join('\n');
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object') return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function sealedTransportPolicy(bytes, expectedSha256) {
  if (!/^[a-f0-9]{64}$/.test(expectedSha256) || hash(bytes) !== expectedSha256) fail();
  let wire;
  try { wire = JSON.parse(bytes.toString('utf8')); } catch { fail(); }
  const value = wire?.repositoryAuthority?.artifactDownload;
  const keys = ['allowedQueryKeys', 'bodyInactivityTimeoutSeconds', 'connectTimeoutSeconds', 'headerTimeoutSeconds', 'hostPattern', 'maxBytes', 'overallTimeoutSeconds', 'pathPrefix'];
  if (!exact(value, keys) || typeof value.allowedQueryKeys !== 'string' || typeof value.hostPattern !== 'string' || value.hostPattern.length > 256 || !value.hostPattern.startsWith('^') || !value.hostPattern.endsWith('$') || typeof value.pathPrefix !== 'string' || !/^\/[A-Za-z0-9._/-]+\/$/.test(value.pathPrefix) || !Number.isInteger(value.maxBytes) || value.maxBytes < 1 || value.maxBytes > 1024 * 1024) fail();
  const allowedQueryKeys = value.allowedQueryKeys.split('|');
  const seconds = { bodyInactivity: value.bodyInactivityTimeoutSeconds, connect: value.connectTimeoutSeconds, headers: value.headerTimeoutSeconds, overall: value.overallTimeoutSeconds };
  if (!allowedQueryKeys.length || allowedQueryKeys.length > 32 || new Set(allowedQueryKeys).size !== allowedQueryKeys.length || allowedQueryKeys.some((key) => !/^[a-z0-9]{1,16}$/.test(key)) || Object.values(seconds).some((field) => !Number.isInteger(field) || field < 1 || field > 30) || ['bodyInactivity', 'connect', 'headers'].some((key) => seconds[key] > seconds.overall)) fail();
  try { new RegExp(value.hostPattern, 'u'); } catch { fail(); }
  const policy = { allowedQueryKeys, hostPattern: value.hostPattern, maxBytes: value.maxBytes, pathPrefix: value.pathPrefix, timeoutsMs: Object.fromEntries(Object.entries(seconds).map(([key, field]) => [key, field * 1000])) };
  return deepFreeze({ policy, policyFileSha256: expectedSha256, projectionSha256: hash(Buffer.from(canonical(policy))) });
}

export function withVerifiedTask9Source(
  { authorizationPath, authorizationSha256Path, sourceRoot },
  consume = (receiptHash) => receiptHash
) {
  const held = [];
  const closeHeld = () => {
    for (const file of held.reverse()) closeSync(file.descriptor);
  };
  try {
    const authorization = openClosed(authorizationPath);
    held.push(authorization);
    const authorizationDigest = openClosed(authorizationSha256Path);
    held.push(authorizationDigest);
    const receiptHash = hash(authorization.bytes);
    if (authorizationDigest.bytes.toString('ascii') !== `${receiptHash}\n`)
      fail();
    let receipt;
    try {
      receipt = JSON.parse(authorization.bytes.toString('utf8'));
    } catch {
      fail();
    }
    if (
      canonical(receipt) !== authorization.bytes.toString('utf8') ||
      receipt?.purpose !== 'task9-exact-run' ||
      !Array.isArray(receipt.sourceFiles)
    )
      fail();
    const root = resolve(sourceRoot);
    const policyTarget = resolve(root, POLICY_PATH);
    if (relative(root, policyTarget).startsWith('..') || !/^[a-f0-9]{64}$/.test(receipt.policyFileSha256)) fail();
    let policy;
    try { policy = openClosed(policyTarget); } catch { fail(); }
    held.push(policy);
    const transportPolicy = sealedTransportPolicy(policy.bytes, receipt.policyFileSha256);
    const byPath = new Map();
    for (const row of receipt.sourceFiles) {
      if (
        !row ||
        typeof row.path !== 'string' ||
        !/^[a-f0-9]{64}$/.test(row.sha256) ||
        row.path === POLICY_PATH
      )
        fail();
      const target = resolve(root, row.path);
      if (relative(root, target).startsWith('..') || byPath.has(row.path))
        fail();
      const member = openClosed(target);
      held.push(member);
      if (hash(member.bytes) !== row.sha256) fail();
      byPath.set(row.path, member);
    }
    const result = consume(
      receiptHash,
      (path) => Buffer.from(byPath.get(path)?.bytes ?? fail()),
      new Map([...byPath].map(([path, member]) => [path, member.descriptor])),
      () => assertHeldPaths(held),
      transportPolicy
    );
    if (result && typeof result.then === 'function') return Promise.resolve(result).finally(closeHeld);
    closeHeld();
    return result;
  } catch (error) {
    closeHeld();
    throw error;
  }
}

export function verifyTask9Source(input) {
  return withVerifiedTask9Source(input);
}

function verifiedModuleUrl(path, readHeld, urls = new Map()) {
  if (urls.has(path)) return urls.get(path);
  const source = readHeld(path).toString('utf8');
  const rewrite = (_match, prefix, quote, specifier) => {
    const child = posix.normalize(posix.join(posix.dirname(path), specifier));
    try {
      return `${prefix}${quote}${verifiedModuleUrl(child, readHeld, urls)}${quote}`;
    } catch {
      return _match;
    }
  };
  const rewritten = source
    .replace(
      /\bfrom\s+(['"])(\.{1,2}\/[^'"\r\n]+)\1/g,
      (match, quote, specifier) => rewrite(match, 'from ', quote, specifier)
    )
    .replace(
      /\bimport\s+(['"])(\.{1,2}\/[^'"\r\n]+)\1/g,
      (match, quote, specifier) => rewrite(match, 'import ', quote, specifier)
    );
  const url = `data:text/javascript;base64,${Buffer.from(rewritten).toString('base64')}`;
  urls.set(path, url);
  return url;
}

export function runVerifiedTask9Transport(input, args, beforeLoad) {
  if (
    !Array.isArray(args) ||
    (beforeLoad !== undefined && typeof beforeLoad !== 'function')
  )
    fail();
  return withVerifiedTask9Source(
    input,
    (_receiptHash, readHeld, _descriptors, assertHeld, transportPolicy) => {
      const transportUrl = verifiedModuleUrl(
        'infra/cwv-runner/owner-api-transport-runtime.mjs',
        readHeld
      );
      beforeLoad?.();
      assertHeld();
      return import(transportUrl).then(({ runTransportCli }) => {
        if (typeof runTransportCli !== 'function') fail();
        assertHeld();
        return runTransportCli(args, { transportPolicy });
      });
    }
  );
}

export function runTask9SourceAuthorizationCli(args) {
  if (
    args.length === 6 &&
    args[0] === 'verify' &&
    args[1] === '--authorization' &&
    args[3] === '--authorization-sha256'
  ) {
    withVerifiedTask9Source(
      {
        authorizationPath: args[2],
        authorizationSha256Path: args[4],
        sourceRoot: args[5],
      },
      (receiptHash) => process.stdout.write(`${receiptHash}\n`)
    );
    return;
  }
  if (
    args.length > 8 &&
    args[0] === 'execute' &&
    args[1] === '--authorization' &&
    args[3] === '--authorization-sha256' &&
    args[5] === '--source-root' &&
    args[7] === '--'
  )
    return runVerifiedTask9Transport(
      {
        authorizationPath: args[2],
        authorizationSha256Path: args[4],
        sourceRoot: args[6],
      },
      args.slice(8)
    );
  fail();
}

if (process.argv[1] === new URL(import.meta.url).pathname)
  void runTask9SourceAuthorizationCli(process.argv.slice(2)).catch(() => {
    process.stderr.write('source manifest refused\n');
    process.exitCode = 1;
  });
