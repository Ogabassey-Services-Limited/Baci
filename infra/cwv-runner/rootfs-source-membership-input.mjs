import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { canonicalJson } from './canonical-json.mjs';
import { packageSourceAuthority } from './rootfs-source-membership.mjs';

const exactKeys = (value, keys) =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
const safeOwner = (owner) =>
  typeof owner === 'string' && /^[A-Za-z0-9+._-]+$/.test(owner);
const safePath = (path) =>
  typeof path === 'string' &&
  /^(?:[A-Za-z0-9_.+-]+\/)*[A-Za-z0-9_.+-]+$/.test(path) &&
  !path.split('/').some((part) => part === '.' || part === '..');
const digest = (value) =>
  typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
const installMapping = (value) =>
  (value.installPrefix === '' || safePath(value.installPrefix)) &&
  Number.isSafeInteger(value.stripComponents) &&
  value.stripComponents >= 0 &&
  value.stripComponents <= 16;
const sourceKey = ({ kind, owner, source }) =>
  `${kind}\0${owner}\0${source.sha256}`;
const ordered = (values, key) =>
  values.every(
    (value, index) => index === 0 || key(values[index - 1]) < key(value)
  );
export function generatedTrustSourcePaths(projection, configBytes) {
  const paths = [
    ...new Set(
      Buffer.from(configBytes)
        .toString('utf8')
        .split('\n')
        .map((line) => line.trim())
        .filter(
          (line) => line && !line.startsWith('#') && !line.startsWith('!')
        )
        .map((line) => {
          if (!safePath(line) || !line.endsWith('.crt'))
            throw new TypeError('invalid generated trust source');
          const path = `usr/share/ca-certificates/${line}`;
          const entry = projection.get(path);
          if (entry?.kind !== 'package' || entry.owner !== 'ca-certificates')
            throw new TypeError('missing generated trust sources');
          return path;
        })
    ),
  ].sort();
  if (!paths.length) throw new TypeError('missing generated trust sources');
  return paths;
}
export function verifyGeneratedTrustBundle(
  projection,
  configBytes,
  readBytes,
  expectedSha256
) {
  if (typeof readBytes !== 'function' || !digest(expectedSha256))
    throw new TypeError('invalid generated trust bundle authority');
  const paths = generatedTrustSourcePaths(projection, configBytes);
  const hash = createHash('sha256');
  for (const path of paths) {
    const bytes = readBytes(path);
    if (!(bytes instanceof Uint8Array))
      throw new TypeError('missing generated trust sources');
    hash.update(bytes);
  }
  if (hash.digest('hex') !== expectedSha256)
    throw new TypeError('generated trust bundle source mismatch');
  return paths;
}
const parseCandidates = (bytes) => {
  const rows = Buffer.from(bytes)
    .toString('utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => line.split('\t'));
  if (!rows.length) throw new TypeError('empty rootfs source candidates');
  return rows.map(([kind, owner, sourceSha256, path, ...extra]) => {
    if (
      extra.length ||
      !['deb', 'tarball'].includes(kind) ||
      !safeOwner(owner) ||
      !digest(sourceSha256) ||
      !safePath(path)
    )
      throw new TypeError('invalid rootfs source candidate');
    return { kind, owner, path, sourceSha256 };
  });
};
const artifact = (value, owner) => {
  if (
    !exactKeys(value, [
      'archivePath',
      'installPrefix',
      'kind',
      'source',
      'sourceArchivePath',
      'stripComponents',
    ]) ||
    !['deb', 'tarball'].includes(value.kind) ||
    typeof value.archivePath !== 'string' ||
    typeof value.sourceArchivePath !== 'string' ||
    (value.kind === 'tarball'
      ? !exactKeys(value.source, ['sha256'])
      : !exactKeys(value.source, [
          'architecture',
          'filename',
          'name',
          'sha256',
          'version',
        ]) || value.source.name !== owner) ||
    !digest(value.source.sha256) ||
    !installMapping(value)
  )
    throw new TypeError('invalid rootfs artifact source');
  return value;
};

export function rootfsSourceMembershipInput(
  candidateBytes,
  ubuntuReceipt,
  artifactSources,
  debDirectory
) {
  if (
    typeof debDirectory !== 'string' ||
    !ubuntuReceipt ||
    !Array.isArray(ubuntuReceipt.packages) ||
    artifactSources === null ||
    typeof artifactSources !== 'object' ||
    Array.isArray(artifactSources)
  )
    throw new TypeError('invalid rootfs source membership authority');
  const packages = packageSourceAuthority(ubuntuReceipt.packages);
  const candidates = parseCandidates(candidateBytes);
  const grouped = new Map();
  for (const candidate of candidates) {
    const key = `${candidate.kind}\0${candidate.owner}\0${candidate.sourceSha256}`;
    const group = grouped.get(key) ?? { ...candidate, candidates: [] };
    group.candidates.push(candidate.path);
    grouped.set(key, group);
  }
  const sources = [...grouped.values()].map((group) => {
    const external = artifactSources[group.owner]
      ? artifact(artifactSources[group.owner], group.owner)
      : undefined;
    const packageSource = packages.get(group.owner);
    const source = external?.source ?? packageSource;
    if (
      !source ||
      source.sha256 !== group.sourceSha256 ||
      (external && external.kind !== group.kind) ||
      (!external && group.kind !== 'deb')
    )
      throw new TypeError('unbound rootfs source candidate');
    return {
      archivePath:
        external?.archivePath ?? `${debDirectory}/${group.sourceSha256}.tar`,
      candidates: [...new Set(group.candidates)].sort(),
      installPrefix: external?.installPrefix ?? '',
      kind: group.kind,
      owner: group.owner,
      source,
      sourceArchivePath:
        external?.sourceArchivePath ??
        `${debDirectory}/${group.sourceSha256}.deb`,
      stripComponents: external?.stripComponents ?? 0,
    };
  });
  sources.sort((left, right) =>
    sourceKey(left) < sourceKey(right)
      ? -1
      : sourceKey(left) > sourceKey(right)
        ? 1
        : 0
  );
  if (!ordered(sources, sourceKey))
    throw new TypeError('duplicate rootfs source authority');
  return Buffer.from(canonicalJson({ schemaVersion: 1, sources }));
}

if (
  process.argv[1] === fileURLToPath(import.meta.url) &&
  process.argv[2] === 'write'
) {
  const [candidatePath, ubuntuPath, artifactPath, debDirectory, outputPath] =
    process.argv.slice(3);
  if (
    !candidatePath ||
    !ubuntuPath ||
    !artifactPath ||
    !debDirectory ||
    !outputPath ||
    process.argv.length !== 8
  )
    throw new TypeError('invalid rootfs source membership input command');
  writeFileSync(
    outputPath,
    rootfsSourceMembershipInput(
      readFileSync(candidatePath),
      JSON.parse(readFileSync(ubuntuPath, 'utf8')),
      JSON.parse(readFileSync(artifactPath, 'utf8')),
      debDirectory
    ),
    { mode: 0o444 }
  );
}
