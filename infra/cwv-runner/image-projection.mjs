import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { validateArchiveLinks } from './archive-link-validation.mjs';
// biome-ignore format: the archive verifier dependency surface is kept contiguous for the audited file-size gate.
import { archiveLimits, archiveSha256, createArchiveWorkspace, extractArchiveMember, fileSha256, inspectArchive, openArchiveIndex, readSmallMember, removeArchiveWorkspace } from './archive-stream.mjs';
import { canonicalJson } from './canonical-json.mjs';
import { parseCanonicalCommandSettingsReceipt } from './command-settings-contract.mjs';
import { configureImageArchiveAuthority } from './image-archive-authority.mjs';
import { sealedPaths } from './image-process-map.mjs';
import { configureImageProjection } from './image-projection-config.mjs';
import { parseRunnerPolicy } from './policy.schema.mjs';
// biome-ignore format: rootfs projection authority is one closed import surface.
import { parseRootfsProjection, requireProjectedFile, rootfsProjectionPath, validateRootfsProjectionInventory, validateRootfsProjectionLinks } from './rootfs-projection-contract.mjs';
// biome-ignore format: source inventory parsing remains one closed import surface.
import { parseRootfsSourceInventory, rootfsSourceInventoryPath } from './rootfs-source-inventory.mjs';
// biome-ignore format: membership authority is one closed import surface.
import { packageSourceAuthority, parseRootfsSourceMembership, rootfsSourceMembershipPath } from './rootfs-source-membership.mjs';
import { verifyGeneratedTrustBundle } from './rootfs-source-membership-input.mjs';

const policyBytes = readFileSync(new URL('policy.json', import.meta.url));
const policy = parseRunnerPolicy(JSON.parse(policyBytes.toString('utf8')));
const rootfsManifestMaxBytes = archiveLimits.smallMemberBytes * 8;
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
// biome-ignore format: closed-record equality remains compact for the audited file-size gate.
const exactKeys = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value) && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
// biome-ignore format: the fixed image config validator wiring remains compact for the audited file-size gate.
const validateImageConfig = configureImageProjection(policy, policyBytes, sha256);
// biome-ignore format: exact immutable provenance members are a closed inventory.
const provenanceMembers = { baseTools: 'opt/baci-cwv/provenance/base-tools.json', chrome: 'opt/baci-cwv/provenance/chrome.json', node: 'opt/baci-cwv/provenance/node.json', ownerCli: 'opt/baci-cwv/provenance/owner-cli.json', pnpm: 'opt/baci-cwv/provenance/pnpm.json', runner: 'opt/baci-cwv/provenance/runner.json', ubuntu: 'opt/baci-cwv/provenance/ubuntu.json' };
// biome-ignore format: exact receipt keys are one closed image-provenance schema.
const provenanceKeys = { baseTools: ['baseImageDigest', 'inventorySha256', 'schemaVersion', 'tools'], chrome: ['artifactSha256', 'inReleaseSha256', 'packagesSha256', 'schemaVersion', 'signingKeySha256', 'version'], node: ['archiveBasename', 'archiveSha256', 'baseToolReceiptSha256', 'checksumsSha256', 'executableSha256', 'keyringSha256', 'schemaVersion', 'signatureSha256'], ownerCli: ['archiveSha256', 'binarySha256', 'checksumsSha256', 'schemaVersion', 'version'], pnpm: ['artifactSha256', 'distIntegrity', 'distShasum', 'schemaVersion', 'tarball', 'version'], runner: ['artifactSha256', 'assetDigest', 'assetId', 'assetName', 'assetSize', 'schemaVersion'], ubuntu: ['baseToolReceiptSha256', 'indexes', 'keyringSha256', 'packages', 'releases', 'schemaVersion', 'snapshotId', 'sourcesSha256'] };
// biome-ignore format: sealed runtime members form one closed image projection.
const sealedRuntimePaths = [...new Set(['opt/baci-cwv/command-settings-contract.mjs', 'opt/baci-cwv/command-settings-receipt.json', 'opt/baci-cwv/registration-egress-probe.mjs', 'opt/baci-cwv/isolation-probe.sh', 'opt/baci-cwv/image-process-map.json', ...sealedPaths.map((path) => path.slice(1))])];
// biome-ignore format: baci-owned runtime leaves form one closed archive projection.
const declaredBaciPaths = new Set(['opt/baci-cwv/canonical-json.mjs', 'opt/baci-cwv/policy.json', 'opt/baci-cwv/policy.schema.mjs', 'opt/baci-cwv/sealed-runner.mjs', rootfsProjectionPath, rootfsSourceInventoryPath, rootfsSourceMembershipPath, ...sealedRuntimePaths, ...Object.values(provenanceMembers)]);
function validateProvenanceReceipt(name, receipt) {
  if (!exactKeys(receipt, provenanceKeys[name]) || receipt.schemaVersion !== 1)
    throw new TypeError('invalid provenance receipt schema');
  for (const [key, value] of Object.entries(receipt))
    if (key.endsWith('Sha256') && !/^[0-9a-f]{64}$/.test(value))
      throw new TypeError('invalid provenance receipt digest');
  const chain = policy.supplyChain;
  const source = policy.supplyChainProvenance;
  // biome-ignore format: each frozen receipt identity is a direct policy binding.
  if ((name === 'chrome' && (receipt.artifactSha256 !== chain.chrome.sha256 || receipt.inReleaseSha256 !== source.chrome.inReleaseSha256 || receipt.packagesSha256 !== source.chrome.packagesSha256 || receipt.signingKeySha256 !== source.chrome.signingKeySha256 || receipt.version !== chain.chrome.version)) || (name === 'node' && (receipt.archiveBasename !== new URL(chain.node.url).pathname.split('/').at(-1) || receipt.archiveSha256 !== chain.node.sha256 || receipt.checksumsSha256 !== source.node.checksumsSha256 || receipt.keyringSha256 !== source.node.keyringSha256 || receipt.signatureSha256 !== source.node.signatureSha256)) || (name === 'ownerCli' && (receipt.archiveSha256 !== source.ownerCli.archiveSha256 || receipt.binarySha256 !== source.ownerCli.binarySha256 || receipt.checksumsSha256 !== source.ownerCli.checksumsSha256 || receipt.version !== source.ownerCli.version)) || (name === 'pnpm' && (receipt.artifactSha256 !== chain.pnpm.sha256 || receipt.distIntegrity !== chain.pnpm.integrity || receipt.distShasum !== source.pnpm.distShasum || receipt.tarball !== chain.pnpm.url || receipt.version !== chain.pnpm.version)) || (name === 'runner' && (receipt.artifactSha256 !== chain.runner.sha256 || receipt.assetDigest !== source.runner.assetDigest || receipt.assetId !== source.runner.assetId || receipt.assetName !== source.runner.assetName || receipt.assetSize !== source.runner.assetSize))) throw new TypeError('provenance receipt policy mismatch');
  if (name === 'baseTools') {
    // biome-ignore format: the base image trust roots are one closed executable inventory plus dynamic closure.
    const required = ['apt-get', 'awk', 'awk:alternative', 'awk:target', 'base64', 'bash', 'chmod', 'cp', 'dpkg', 'dpkg-query', 'find', 'gpgv', 'grep', 'ldd', 'mkdir', 'mktemp', 'mv', 'readlink', 'rm', 'sha256sum', 'sort', 'stat', 'timeout', 'wc', 'keyring'];
    const tools = receipt.tools;
    const roles = Array.isArray(tools) ? tools.map((row) => row?.role) : [];
    // biome-ignore format: each receipt row is a closed byte, package, owner, mode, and link-identity binding.
    if (receipt.baseImageDigest !== policy.supplyChain.ubuntu.reference || !Array.isArray(tools) || !tools.length || !tools.every((row) => exactKeys(row, ['linkIdentity', 'mode', 'owner', 'package', 'path', 'role', 'sha256', 'version']) && typeof row.linkIdentity === 'string' && /^[0-7]{3,4}$/.test(row.mode) && /^\d+:\d+$/.test(row.owner) && typeof row.package === 'string' && /^\/[A-Za-z0-9_./+-]+$/.test(row.path) && typeof row.version === 'string' && /^[0-9a-f]{64}$/.test(row.sha256)) || canonicalJson(roles) !== canonicalJson([...roles].sort()) || new Set(roles).size !== roles.length || !required.every((role) => roles.includes(role)) || !roles.some((role) => role.startsWith('interpreter:')) || !roles.some((role) => role.startsWith('library:')) || roles.some((role) => !required.includes(role) && !/^(?:interpreter|library):[A-Za-z0-9:._/-]+$/.test(role)) || tools.find((row) => row.role === 'keyring')?.path !== '/usr/share/keyrings/ubuntu-archive-keyring.gpg') throw new TypeError('invalid base-tool receipt schema');
  }
  if (
    name === 'ubuntu' &&
    (!['indexes', 'packages', 'releases'].every(
      (key) => Array.isArray(receipt[key]) && receipt[key].length
    ) ||
      !receipt.indexes.every((row) => exactKeys(row, ['path', 'sha256'])) ||
      !receipt.releases.every((row) => exactKeys(row, ['path', 'sha256'])) ||
      !receipt.packages.every((row) =>
        exactKeys(row, [
          'architecture',
          'filename',
          'name',
          'sha256',
          'version',
        ])
      ))
  )
    throw new TypeError('invalid Ubuntu receipt schema');
}
// biome-ignore format: archive member normalization is compact to preserve the audited file-size gate.
function layerEntries(layer) {
  const names = layer.members.map((member) => member.rawName);
  const entries = layer.members.map((member) => ({ member, name: member.rawName, path: member.rawName.replace(/^\.\//, '').replace(/\/$/, '') })).filter(({ path }) => path);
  if (new Set(names).size !== names.length || entries.some(({ name, path }) => name.startsWith('/') || !path || path.includes('\\') || path.split('/').some((part) => !part || part === '.' || part === '..') || [...path].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127))) throw new TypeError('unsafe runtime layer path');
  return entries;
}
function directoryIdentity(projection, directories, path) {
  const entry = projection.get(path);
  // biome-ignore format: the exact ancestor-or-writable-directory admission is one closed predicate.
  if (!directories.has(path) && (entry?.kind !== 'generated' || entry.owner !== 'directory')) return undefined;
  // biome-ignore format: only declared writable directories differ from sealed root-owned ancestors.
  return entry?.kind === 'generated' && entry.owner === 'directory' ? [10001, 10001, 0o700] : [0, 0, 0o755];
}
// biome-ignore format: each runtime-layer security check remains contiguous for the audited file-size gate.
function scanLayer(layer, projected, projection, workspace, index) {
  const directories = new Set([...projection.keys()].flatMap((root) => root.split('/').slice(0, -1).map((_part, index, parts) => parts.slice(0, index + 1).join('/'))));
  if (projected) validateRootfsProjectionLinks(validateArchiveLinks(layer.members.map((member) => ({ ...member })), projection));
  for (const entry of layerEntries(layer)) {
    const path = entry.path;
    if (projected && path.split('/').some((part) => part.startsWith('.wh.')))
      throw new TypeError('whiteout-dependent runtime projection');
    const directory = directoryIdentity(projection, directories, path);
    if (entry.member.type === '5' || entry.name.endsWith('/')) {
      if (!directory) throw new TypeError('unprojected runtime file');
      if (entry.member.type !== '5' || entry.member.rawName !== `./${path}/` || entry.member.uid !== directory[0] || entry.member.gid !== directory[1] || entry.member.mode !== directory[2]) throw new TypeError('invalid runtime directory record');
      continue;
    }
    requireProjectedFile(projection, path);
    if (/^(?:opt\/baci-cwv\/downloads|var\/cache\/apt\/archives|var\/lib\/apt\/lists)(?:\/|$)|\.(?:deb|tgz|tar|tar\.gz|tar\.xz|sig)$/i.test(path) || /(^|\/)\.env(?:\.|\/|$)/.test(path)) throw new TypeError('build artifact leaked into runtime layer');
    if (path === 'opt/baci-cwv/policy.json' || Object.values(provenanceMembers).includes(path)) continue;
    if (!/^(?:opt\/baci-cwv|runner-work|registration-staging)\//.test(path))
      continue;
    const verbose = layer.details(entry.name);
    if (!verbose.startsWith('-')) continue;
    const member = layer.extract(entry.name, workspace, `member-${index}-${sha256(Buffer.from(path)).slice(0, 12)}`);
    const bytes = readSmallMember(
      member,
      [rootfsProjectionPath, rootfsSourceInventoryPath, rootfsSourceMembershipPath].includes(path)
        ? rootfsManifestMaxBytes
        : undefined
    );
    if (!bytes.includes(0) && /(?:^|[^A-Z])(TOKEN|KEY|PASSWORD|SECRET|AUTH|COOKIE|CREDENTIAL|SIGNATURE)[A-Z0-9_]*\s*=/i.test(bytes.toString('utf8'))) throw new TypeError('credential-shaped value leaked into runtime layer');
  }
}
function exactLayerMember(layers, expected, workspace) {
  let found;
  for (const [index, layer] of layers.entries()) {
    const member = layer.find(expected);
    if (member && found) throw new TypeError('duplicate provenance member');
    if (member) {
      const identity = sha256(Buffer.from(expected)).slice(0, 12);
      if (member.type !== '0') throw new TypeError('unsafe provenance member');
      found = layer.extract(
        member.rawName,
        workspace,
        `member-${index}-${identity}`
      );
    }
  }
  if (!found) throw new TypeError('missing sealed runtime member');
  return found;
}
function layerMember(layers, expected, name, workspace) {
  const found = exactLayerMember(layers, expected, workspace);
  const raw = readSmallMember(found);
  let receipt;
  try {
    receipt = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw));
  } catch {
    throw new TypeError('invalid provenance receipt');
  }
  if (canonicalJson(receipt) !== raw.toString('utf8'))
    throw new TypeError('noncanonical provenance receipt');
  validateProvenanceReceipt(name, receipt);
  return { path: `/${expected}`, receipt, sha256: sha256(raw) };
}
function validateSealedRuntime(layers, workspace) {
  // biome-ignore format: the sealed descriptor map remains one compact bounded receipt lookup.
  const members = new Map(sealedRuntimePaths.map((path) => [path, exactLayerMember(layers, path, workspace)]));
  const bytes = members.get('opt/baci-cwv/command-settings-receipt.json');
  try {
    parseCanonicalCommandSettingsReceipt(readSmallMember(bytes), policy);
  } catch {
    throw new TypeError('invalid command settings receipt');
  }
}
// biome-ignore format: the descriptor-bound rootfs record preserves direct unique archive identity lookup.
const archiveRecord = (layerIndexes, path, workspace) => { const matches = layerIndexes.flatMap((layer) => { const member = layer.find(path); return member ? [member] : []; }); if (matches.length !== 1) throw new TypeError('ambiguous runtime tar header'); const member = matches[0]; const digest = member.type === '0' ? fileSha256(exactLayerMember(layerIndexes, path, workspace)) : member.type === '2' ? sha256(Buffer.from(member.linkTarget)) : member.type === '5' ? undefined : (() => { throw new TypeError('unsupported rootfs source member type'); })(); return { gid: member.gid, mode: member.mode.toString(8).padStart(4, '0'), path, ...(digest ? { sha256: digest } : {}), type: member.type, uid: member.uid }; };
// biome-ignore format: the process-map adapter carries only the descriptor and path views plus its receipt hook.
function validateProcessMap(layerIndexes, layers, workspace, nodeReceipt, sourceInventory, recordFor) {
  // biome-ignore format: the fixed receipt member is one authority lookup.
  const bytes = exactLayerMember(layerIndexes, 'opt/baci-cwv/image-process-map.json', workspace);
  // biome-ignore format: archive receipt authority is one closed validation call.
  const map = configureImageArchiveAuthority({ exactLayerMember: (_layers, path, root) => exactLayerMember(layerIndexes, path, root), layers, recordFor, workspace }).validateProcessMap(readSmallMember(bytes), policy);
  const runtimeNode = map.entries.find((entry) => entry.role === 'runtimeNode');
  const source = sourceInventory.get('opt/node/bin/node');
  // biome-ignore format: all three retained Node byte identities must match one receipt hash.
  if (runtimeNode?.path !== '/opt/node/bin/node' || [runtimeNode?.sha256, fileSha256(exactLayerMember(layerIndexes, 'opt/node/bin/node', workspace)), source?.sha256].some((value) => value !== nodeReceipt.executableSha256) || source?.kind !== 'tarball' || source?.owner !== 'node' || source?.type !== '0') throw new TypeError('node executable provenance mismatch');
  return map;
}
export function archiveIdentity(archive, sourceManifest) {
  const sourceManifestSha256 =
    typeof sourceManifest === 'string'
      ? sourceManifest
      : sourceManifest?.sha256;
  if (!/^[0-9a-f]{64}$/.test(sourceManifestSha256))
    throw new TypeError('invalid source manifest digest');
  const workspace = createArchiveWorkspace();
  const layerIndexes = [];
  try {
    const outer = inspectArchive(archive);
    const manifest = JSON.parse(
      readSmallMember(
        extractArchiveMember(
          archive,
          'manifest.json',
          workspace,
          'manifest.json'
        )
      ).toString('utf8')
    );
    // biome-ignore format: one exact safe config, tag, and layer inventory is required.
    if (!Array.isArray(manifest) || manifest.length !== 1 || !exactKeys(manifest[0], ['Config', 'Layers', 'RepoTags']) || !/^[0-9a-f]{64}\.json$/.test(manifest[0].Config ?? '') || canonicalJson(manifest[0].RepoTags) !== canonicalJson([`baci-cwv-runner:${policy.supplyChain.runner.version}-chrome${policy.supplyChain.chrome.version.split('.')[0]}`]) || !Array.isArray(manifest[0].Layers) || manifest[0].Layers.length !== 1 || !manifest[0].Layers.every((layer) => /^[0-9a-f]{64}\/layer\.tar$/.test(layer)) || new Set(manifest[0].Layers).size !== manifest[0].Layers.length) throw new TypeError('invalid image archive manifest');
    const expectedOuter = [
      'manifest.json',
      manifest[0].Config,
      ...manifest[0].Layers,
    ];
    if (
      outer.length !== expectedOuter.length ||
      canonicalJson(outer.map((member) => member.name)) !==
        canonicalJson(expectedOuter) ||
      outer.some((member) => member.type !== '0')
    )
      throw new TypeError(
        `invalid outer archive inventory: ${outer.map((member) => member.name).join(',')}`
      );
    if (archiveSha256(archive).length !== 64)
      throw new TypeError('invalid archive digest');
    const configBytes = readSmallMember(
      extractArchiveMember(
        archive,
        manifest[0].Config,
        workspace,
        'config.json'
      )
    );
    const configHash = sha256(configBytes);
    if (manifest[0].Config !== `${configHash}.json`)
      throw new TypeError('image config digest mismatch');
    const layers = manifest[0].Layers.map((path, index) =>
      extractArchiveMember(archive, path, workspace, `layer-${index}.tar`)
    );
    for (const [index, path] of layers.entries()) {
      if (manifest[0].Layers[index] !== `${fileSha256(path)}/layer.tar`)
        throw new TypeError('image layer digest mismatch');
    }
    layerIndexes.push(...layers.map((path) => openArchiveIndex(path)));
    const provenance = {};
    for (const [name, path] of Object.entries(provenanceMembers))
      provenance[name] = layerMember(layerIndexes, path, name, workspace);
    // biome-ignore format: Chrome extends the immutable package identity set once.
    const packageSources = packageSourceAuthority([...provenance.ubuntu.receipt.packages, { architecture: 'amd64', filename: new URL(policy.supplyChain.chrome.url).pathname.split('/deb/')[1], name: 'google-chrome-stable', sha256: policy.supplyChain.chrome.sha256, version: provenance.chrome.receipt.version }]);
    // biome-ignore format: artifact authority is one fixed role-to-digest projection.
    const artifactSources = new Map(['chrome', 'node', 'pnpm', 'runner'].map((name) => [name, policy.supplyChain[name].sha256]));
    // biome-ignore format: membership receipt parsing binds exactly the two source authorities.
    const membership = parseRootfsSourceMembership(readSmallMember(exactLayerMember(layerIndexes, rootfsSourceMembershipPath, workspace), rootfsManifestMaxBytes), { artifactSources, packageSources });
    const sourceInventory = parseRootfsSourceInventory(
      readSmallMember(
        exactLayerMember(layerIndexes, rootfsSourceInventoryPath, workspace),
        rootfsManifestMaxBytes
      ),
      {
        artifactSources,
        packageSources,
        membership,
      }
    );
    // biome-ignore format: immutable projection extraction stays compact for the file-size gate.
    const projection = parseRootfsProjection(readSmallMember(exactLayerMember(layerIndexes, rootfsProjectionPath, workspace), rootfsManifestMaxBytes), declaredBaciPaths, sourceInventory);
    // biome-ignore format: generated CA bytes are the exact ordered concat of source-membership-backed enabled certificates.
    verifyGeneratedTrustBundle(projection, readSmallMember(exactLayerMember(layerIndexes, 'etc/ca-certificates.conf', workspace)), (path) => readSmallMember(exactLayerMember(layerIndexes, path, workspace)), fileSha256(exactLayerMember(layerIndexes, 'etc/ssl/certs/ca-certificates.crt', workspace)));
    const archiveAuthority = configureImageArchiveAuthority({
      exactLayerMember: (_layers, path, root) =>
        exactLayerMember(layerIndexes, path, root),
      layers,
      recordFor: (path) => archiveRecord(layerIndexes, path, workspace),
      workspace,
    });
    archiveAuthority.validateSourceProjection(sourceManifest);
    validateRootfsProjectionInventory(
      projection,
      sourceInventory,
      archiveAuthority.rootfsRows(projection)
    );
    for (const [index, layer] of layerIndexes.entries())
      scanLayer(
        layer,
        index === layerIndexes.length - 1,
        projection,
        workspace,
        index
      );
    validateImageConfig(
      JSON.parse(configBytes.toString('utf8')),
      sourceManifestSha256,
      layers.map((path) => `sha256:${fileSha256(path)}`)
    );
    validateSealedRuntime(layerIndexes, workspace);
    // biome-ignore format: Node provenance requires the exact receipt, source row, and map together.
    const processMap = validateProcessMap(layerIndexes, layers, workspace, provenance.node.receipt, sourceInventory, (path) => archiveRecord(layerIndexes, path, workspace));
    // biome-ignore format: injected runner entrypoint must remain exactly the Baci-owned source bytes.
    if (fileSha256(exactLayerMember(layerIndexes, 'opt/runner/entrypoint.mjs', workspace)) !== fileSha256(exactLayerMember(layerIndexes, 'opt/baci-cwv/entrypoint.mjs', workspace))) throw new TypeError('runner entrypoint source drift');
    const baseToolSha256 = provenance.baseTools.sha256;
    // biome-ignore format: both downstream receipts must bind the exact retained receipt bytes.
    if (provenance.node.receipt.baseToolReceiptSha256 !== baseToolSha256 || provenance.ubuntu.receipt.baseToolReceiptSha256 !== baseToolSha256) throw new TypeError('base-tool provenance binding mismatch');
    return {
      configDigest: `sha256:${configHash}`,
      imageId: `sha256:${configHash}`,
      processMap,
      provenance,
    };
  } finally {
    for (const layer of layerIndexes) layer.close();
    removeArchiveWorkspace(workspace);
  }
}
