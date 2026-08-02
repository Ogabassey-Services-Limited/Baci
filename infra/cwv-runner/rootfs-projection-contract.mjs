import { createHash } from 'node:crypto';
import { canonicalJson } from './canonical-json.mjs';
export const rootfsProjectionPath = 'opt/baci-cwv/rootfs-projection.json';
const runtimePackages = new Set([
  'bash',
  'ca-certificates',
  'coreutils',
  'curl',
  'dash',
  'dpkg',
  'fonts-liberation',
  'git',
  'grep',
  'google-chrome-stable',
  'iproute2',
  'jq',
  'libasound2t64',
  'libatk-bridge2.0-0',
  'libc6',
  'libcups2',
  'libgbm1',
  'libgtk-3-0t64',
  'libnspr4',
  'libnss3',
  'libudev1',
  'libvulkan1',
  'mawk',
  'procps',
  'util-linux',
  'xdg-utils',
]);
const artifactRoots = {
  chrome: 'opt/google/',
  node: 'opt/node/',
  pnpm: 'opt/pnpm/',
  runner: 'opt/runner/',
};
const closureOwners = new Set([
  'action-node',
  'bash',
  'chrome',
  'dpkg-query',
  'git',
  'git-remote-https',
  'isolation-probe',
  'listener',
  'plugin-host',
  'runtime-node',
  'shell',
  'worker',
]);
const runtimePackageClosureOwner = (owner) =>
  typeof owner === 'string' &&
  owner.startsWith('runtime-package-') &&
  runtimePackages.has(owner.slice('runtime-package-'.length));
const generatedPaths = new Map([
  ['etc/alternatives/awk', 'awk-alternative'],
  ['etc/group', 'identity'],
  ['etc/passwd', 'identity'],
  ['etc/ssl/certs/ca-certificates.crt', 'trust'],
  ['home/runner', 'directory'],
  ['opt/runner/_diag', 'directory'],
  ['registration-staging', 'directory'],
  ['runner-work', 'directory'],
  ['tmp/baci-cwv', 'directory'],
  ['usr/bin/awk', 'awk-alternative'],
  ['var/lib/dpkg/status', 'dpkg-query'],
]);
const dpkgPaths = new Set(['usr/bin/dpkg-query']);
const forbiddenPackageStateRoots = [
  'etc/apt',
  'var/cache/apt',
  'var/lib/apt',
  'var/lib/dpkg',
];
const requiredBindings = new Map([
  ['bin/sh', ['closure', 'shell']],
  ['bin/dash', ['closure', 'shell']],
  ['etc/alternatives/awk', ['generated', 'awk-alternative']],
  ['etc/group', ['generated', 'identity']],
  ['etc/passwd', ['generated', 'identity']],
  ['etc/ssl/certs/ca-certificates.crt', ['generated', 'trust']],
  ['home/runner', ['generated', 'directory']],
  ['lib64/ld-linux-x86-64.so.2', ['closure', 'shell']],
  ['lib/x86_64-linux-gnu/ld-linux-x86-64.so.2', ['closure', 'shell']],
  ['opt/google/chrome/chrome', ['artifact', 'chrome']],
  ['opt/node/bin/node', ['artifact', 'node']],
  ['opt/runner/bin/Runner.Listener', ['artifact', 'runner']],
  ['opt/runner/bin/Runner.PluginHost', ['artifact', 'runner']],
  ['opt/runner/bin/Runner.Worker', ['artifact', 'runner']],
  ['opt/runner/externals/node24/bin/node', ['artifact', 'runner']],
  ['opt/runner/_diag', ['generated', 'directory']],
  [rootfsProjectionPath, ['declared', 'baci']],
  ['registration-staging', ['generated', 'directory']],
  ['runner-work', ['generated', 'directory']],
  ['tmp/baci-cwv', ['generated', 'directory']],
  ['usr/bin/bash', ['package', 'bash']],
  ['usr/bin/dash', ['closure', 'shell']],
  ['usr/bin/dpkg-query', ['package', 'dpkg']],
  ['usr/bin/git', ['package', 'git']],
  ['usr/bin/awk', ['generated', 'awk-alternative']],
  ['usr/bin/cat', ['package', 'coreutils']],
  ['usr/bin/findmnt', ['package', 'util-linux']],
  ['usr/bin/grep', ['package', 'grep']],
  ['usr/bin/id', ['package', 'coreutils']],
  ['usr/bin/mawk', ['package', 'mawk']],
  ['usr/bin/stat', ['package', 'coreutils']],
  ['usr/bin/tr', ['package', 'coreutils']],
  ['usr/lib/x86_64-linux-gnu/ld-linux-x86-64.so.2', ['closure', 'shell']],
  ['usr/lib/git-core/git-remote-https', ['package', 'git']],
  ['var/lib/dpkg/status', ['generated', 'dpkg-query']],
]);
const exactKeys = (value, keys) =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
const safePath = (path) =>
  typeof path === 'string' &&
  /^(?:[A-Za-z0-9_.+-]+\/)*[A-Za-z0-9_.+-]+$/.test(path) &&
  !path.split('/').some((part) => part === '.' || part === '..');
const forbiddenPackageState = (path) =>
  path !== 'var/lib/dpkg/status' &&
  forbiddenPackageStateRoots.some(
    (root) => path === root || path.startsWith(`${root}/`)
  );
const archiveIdentityKeys = ['gid', 'mode', 'path', 'type', 'uid'];
const sourceArchiveIdentityKeys = [...archiveIdentityKeys, 'sha256'];
// biome-ignore format: immutable final-image identity bytes are one closed uid/gid authority.
const identityBytes = new Map([['etc/group', 'runner:x:10001:\n'], ['etc/passwd', 'runner:x:10001:10001:Baci CWV Runner:/home/runner:/bin/bash\n']]);
// biome-ignore format: generated archive identity is a closed owner/mode/byte binding.
const generatedLinks = new Map([['etc/alternatives/awk', '/usr/bin/mawk'], ['usr/bin/awk', '/etc/alternatives/awk']]);
// biome-ignore format: generated alternatives remain one exact identity record.
const generatedArchiveRecord = ({ owner, path }) => { const link = generatedLinks.get(path); return { gid: owner === 'directory' ? 10001 : 0, mode: owner === 'directory' ? '0700' : link ? '0777' : ['dpkg-query', 'trust'].includes(owner) ? '0444' : '0644', path, type: owner === 'directory' ? '5' : link ? '2' : '0', uid: owner === 'directory' ? 10001 : 0, ...(identityBytes.has(path) ? { sha256: createHash('sha256').update(identityBytes.get(path)).digest('hex') } : link ? { sha256: createHash('sha256').update(link).digest('hex') } : {}) }; };
const declaredArchiveRecord = ({ path }) => ({
  gid: 0,
  mode:
    path === rootfsProjectionPath
      ? '0644'
      : path === 'opt/runner/entrypoint.mjs'
        ? '0444'
        : path.endsWith('.json')
          ? '0444'
          : '0555',
  path,
  type: '0',
  uid: 0,
});
const sameArchiveIdentity = (expected, actual, keys) =>
  expected &&
  actual &&
  canonicalJson(Object.fromEntries(keys.map((key) => [key, expected[key]]))) ===
    canonicalJson(Object.fromEntries(keys.map((key) => [key, actual[key]])));
const verifiedDebClosureSource = (source, path) =>
  source?.kind === 'deb' &&
  source.path === path &&
  typeof source.owner === 'string' &&
  /^[A-Za-z0-9+._-]+$/.test(source.owner) &&
  /^[0-9a-f]{64}$/.test(source.sourceSha256 ?? '');
export function parseRootfsProjection(
  bytes,
  declaredBaciPaths,
  sourceInventory
) {
  let value;
  try {
    value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new TypeError('invalid rootfs projection manifest');
  }
  if (
    canonicalJson(value) !== Buffer.from(bytes).toString('utf8') ||
    !exactKeys(value, ['entries', 'schemaVersion']) ||
    value.schemaVersion !== 1 ||
    !Array.isArray(value.entries) ||
    !value.entries.length
  )
    throw new TypeError('invalid rootfs projection manifest');
  const entries = new Map();
  for (const entry of value.entries) {
    if (!exactKeys(entry, ['kind', 'owner', 'path']) || !safePath(entry.path))
      throw new TypeError('invalid rootfs projection entry');
    if (entries.has(entry.path))
      throw new TypeError('duplicate rootfs projection path');
    if (forbiddenPackageState(entry.path))
      throw new TypeError('forbidden package-manager runtime path');
    if (entry.kind === 'package') {
      if (!runtimePackages.has(entry.owner))
        throw new TypeError('undeclared runtime package');
      if (entry.owner === 'dpkg' && !dpkgPaths.has(entry.path))
        throw new TypeError('undeclared dpkg runtime path');
      if (
        Object.values(artifactRoots).some((root) => entry.path.startsWith(root))
      )
        throw new TypeError('package path collides with artifact root');
    } else if (entry.kind === 'artifact') {
      if (
        typeof entry.owner !== 'string' ||
        !artifactRoots[entry.owner] ||
        !entry.path.startsWith(artifactRoots[entry.owner])
      )
        throw new TypeError('undeclared runtime artifact path');
    } else if (entry.kind === 'closure') {
      if (
        (!closureOwners.has(entry.owner) &&
          !runtimePackageClosureOwner(entry.owner)) ||
        !(
          entry.path === 'bin/sh' ||
          entry.path === 'bin/dash' ||
          entry.path === 'usr/bin/dash' ||
          /^(?:lib|lib64|usr\/lib)\//.test(entry.path)
        )
      )
        throw new TypeError('undeclared runtime closure path');
    } else if (entry.kind === 'generated') {
      if (generatedPaths.get(entry.path) !== entry.owner)
        throw new TypeError('undeclared generated rootfs path');
    } else if (
      entry.kind !== 'declared' ||
      entry.owner !== 'baci' ||
      !declaredBaciPaths.has(entry.path)
    )
      throw new TypeError('undeclared rootfs path');
    if (['artifact', 'closure', 'package'].includes(entry.kind)) {
      const source = sourceInventory?.get(entry.path);
      const compatible =
        source &&
        source.path === entry.path &&
        ((entry.kind === 'closure' &&
          verifiedDebClosureSource(source, entry.path)) ||
          (entry.kind === 'artifact' &&
            (entry.owner === 'chrome'
              ? entry.path.startsWith(artifactRoots.chrome) &&
                source.kind === 'deb' &&
                source.owner === 'google-chrome-stable'
              : source.kind === 'tarball' && source.owner === entry.owner)) ||
          (entry.kind === 'package' &&
            source.kind === 'deb' &&
            source.owner === entry.owner));
      if (!compatible) throw new TypeError('rootfs source inventory mismatch');
    }
    entries.set(entry.path, entry);
  }
  for (const [path, binding] of requiredBindings) {
    const entry = entries.get(path);
    if (!entry || entry.kind !== binding[0] || entry.owner !== binding[1])
      throw new TypeError(`missing required rootfs projection: ${path}`);
  }
  return entries;
}
export function validateRootfsProjectionInventory(
  projection,
  sourceInventory,
  archiveRows
) {
  for (const entry of projection.values()) {
    const sourceBacked = ['artifact', 'closure', 'package'].includes(
      entry.kind
    );
    const source = sourceBacked ? sourceInventory.get(entry.path) : undefined;
    const archive = archiveRows.get(entry.path);
    const expected = sourceBacked
      ? source
      : entry.kind === 'generated'
        ? generatedArchiveRecord(entry)
        : declaredArchiveRecord(entry);
    if (
      !sameArchiveIdentity(
        expected,
        archive,
        sourceBacked || expected.sha256
          ? sourceArchiveIdentityKeys
          : archiveIdentityKeys
      )
    )
      throw new TypeError('rootfs projection archive identity mismatch');
  }
  return projection;
}

export function requireProjectedFile(entries, path) {
  if (!entries.has(path)) throw new TypeError('unprojected runtime file');
}
export function validateRootfsProjectionLinks(records) {
  const members = new Map(records.map((record) => [record.name, record]));
  const awk = members.get('usr/bin/awk');
  const alternative = members.get('etc/alternatives/awk');
  const mawk = members.get('usr/bin/mawk');
  if (
    awk?.type !== '2' ||
    awk.targetPath !== 'etc/alternatives/awk' ||
    awk.resolvedTarget !== 'usr/bin/mawk' ||
    alternative?.type !== '2' ||
    alternative.targetPath !== 'usr/bin/mawk' ||
    alternative.resolvedTarget !== 'usr/bin/mawk' ||
    mawk?.type !== '0'
  )
    throw new TypeError('awk alternatives closure refused');
  return records;
}
