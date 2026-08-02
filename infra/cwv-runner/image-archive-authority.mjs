import { createHash } from 'node:crypto';
import {
  archiveLimits,
  archiveMemberDetails,
  fileSha256,
  inspectArchive,
  listArchiveMembers,
} from './archive-stream.mjs';
import { canonicalJson } from './canonical-json.mjs';
import { validateImageProcessMap } from './image-process-map.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const mode = ({ mode: value }) => value.toString(8).padStart(4, '0');
const canonicalArchivePath = (path) =>
  path.replace(/^\.\//, '').replace(/\/$/, '');
// biome-ignore format: only these reviewed source files survive into the sealed runtime image.
const runtimeSourcePaths = new Set(['canonical-json.mjs', 'command-settings-contract.mjs', 'container-attest-runtime.mjs', 'cwv-runner-authority.mjs', 'cwv-runner-authority-core.mjs', 'cwv-runner-authority-runtime.mjs', 'cwv-runner-stable-attestation-builder.mjs', 'direct-listener-conformance.mjs', 'entrypoint-runtime.mjs', 'entrypoint.mjs', 'entrypoint.sh', 'isolation-probe.sh', 'normal-release.mjs', 'policy.json', 'policy.schema.mjs', 'process-inventory.mjs', 'registration-egress-probe.mjs', 'registration-release.mjs', 'runner-identity-gate.mjs', 'sealed-runner.mjs']);
const sourcePrefix = 'infra/cwv-runner/';
export function configureImageArchiveAuthority({
  exactLayerMember,
  layers,
  recordFor,
  workspace,
}) {
  const lookup =
    recordFor ??
    ((path) => {
      const matches = layers.flatMap((layer) =>
        inspectArchive(layer, archiveLimits, archiveLimits.layerMembers).filter(
          ({ name }) => name.replace(/^\.\//, '').replace(/\/$/, '') === path
        )
      );
      if (matches.length !== 1)
        throw new TypeError('ambiguous runtime tar header');
      const header = matches[0];
      let digest;
      if (header.type === '0')
        digest = fileSha256(exactLayerMember(layers, path, workspace));
      else if (header.type === '2')
        digest = sha256(Buffer.from(header.linkTarget));
      else if (header.type !== '5')
        throw new TypeError('unsupported rootfs source member type');
      return {
        gid: header.gid,
        mode: mode(header),
        path,
        ...(digest ? { sha256: digest } : {}),
        type: header.type,
        uid: header.uid,
      };
    });
  return {
    rootfsRows(projection) {
      const rows = new Map();
      for (const entry of projection.values()) {
        rows.set(entry.path, lookup(entry.path));
      }
      return rows;
    },
    validateSourceProjection(source) {
      const rows =
        source?.manifest?.sourceArchive?.entries ??
        source?.sourceArchive?.entries;
      if (typeof source === 'string') return;
      if (!Array.isArray(rows))
        throw new TypeError('runtime source manifest refused');
      const runtimeEntries = [];
      for (const entry of rows) {
        if (!entry || typeof entry.path !== 'string')
          throw new TypeError('runtime source manifest refused');
        if (!entry.path.startsWith(sourcePrefix))
          throw new TypeError('source archive path outside prefix');
        const sourcePath = entry.path.slice(sourcePrefix.length);
        if (runtimeSourcePaths.has(sourcePath))
          runtimeEntries.push({ entry, sourcePath });
      }
      const counts = new Map();
      for (const { sourcePath } of runtimeEntries)
        counts.set(sourcePath, (counts.get(sourcePath) ?? 0) + 1);
      if (
        runtimeEntries.length !== runtimeSourcePaths.size ||
        [...runtimeSourcePaths].some((path) => counts.get(path) !== 1)
      )
        throw new TypeError('runtime source manifest membership refused');
      for (const { entry, sourcePath } of runtimeEntries) {
        const path = `opt/baci-cwv/${sourcePath}`;
        const member = exactLayerMember(layers, path, workspace);
        if (fileSha256(member) !== entry.blobSha256)
          throw new TypeError('runtime source byte drift');
        const selected = layers.filter((layer) =>
          listArchiveMembers(layer).some(
            (member) => canonicalArchivePath(member) === path
          )
        );
        if (selected.length !== 1)
          throw new TypeError('missing sealed runtime member');
        const installedMode = /\.(?:mjs|sh)$/.test(path) ? 555 : 444;
        if (
          !archiveMemberDetails(selected[0], path).startsWith(
            `-${installedMode}`
          )
        )
          throw new TypeError('runtime source mode drift');
      }
    },
    validateProcessMap(bytes, policy) {
      let map;
      try {
        map = JSON.parse(
          new TextDecoder('utf-8', { fatal: true }).decode(bytes)
        );
      } catch {
        throw new TypeError('invalid image process map receipt');
      }
      if (canonicalJson(map) !== bytes.toString('utf8'))
        throw new TypeError('noncanonical image process map');
      validateImageProcessMap(map, policy);
      for (const entry of [...map.entries, ...map.sealed]) {
        const header = lookup(entry.path.slice(1));
        if (
          header.sha256 !== entry.sha256 ||
          header.type !== '0' ||
          header.mode !== entry.mode ||
          `${header.uid}:${header.gid}` !== entry.owner
        )
          throw new TypeError('process map header drift');
      }
      return map;
    },
  };
}
