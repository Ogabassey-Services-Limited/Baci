import { lstatSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { canonicalJson } from './canonical-json.mjs';
import {
  rootfsSourceInventoryPath,
  serializeRootfsSourceInventory,
} from './rootfs-source-inventory.mjs';
import { rootfsSourceMembershipPath } from './rootfs-source-membership.mjs';

const tarBlock = 512;
const octal = (bytes) =>
  Number.parseInt(
    bytes.toString('latin1').replace(/\0.*$/, '').trim() || '0',
    8
  );
const writeOctal = (header, offset, width, value) => {
  const text = value.toString(8).padStart(width - 1, '0');
  header.write(`${text}\0`, offset, width, 'latin1');
};
export function tamperTarHeader(archive, expected, changes) {
  const bytes = readFileSync(archive);
  for (let offset = 0; offset + tarBlock <= bytes.length; ) {
    const header = bytes.subarray(offset, offset + tarBlock);
    if (header.every((value) => value === 0)) break;
    const prefix = header
      .subarray(345, 500)
      .toString('latin1')
      .replace(/\0.*$/, '');
    const name = header
      .subarray(0, 100)
      .toString('latin1')
      .replace(/\0.*$/, '');
    const path = `${prefix}${prefix ? '/' : ''}${name}`
      .replace(/^\.\//, '')
      .replace(/\/$/, '');
    const size = octal(header.subarray(124, 136));
    if (path === expected) {
      if (changes.mode !== undefined) writeOctal(header, 100, 8, changes.mode);
      if (changes.uid !== undefined) writeOctal(header, 108, 8, changes.uid);
      if (changes.gid !== undefined) writeOctal(header, 116, 8, changes.gid);
      if (changes.type !== undefined) header[156] = changes.type.charCodeAt(0);
      if (changes.rawName !== undefined) {
        header.fill(0, 0, 100);
        header.fill(0, 345, 500);
        header.write(changes.rawName, 0, 'latin1');
      }
      header.fill(32, 148, 156);
      const checksum = [...header].reduce((sum, value) => sum + value, 0);
      header.write(
        `${checksum.toString(8).padStart(6, '0')}\0 `,
        148,
        8,
        'latin1'
      );
      writeFileSync(archive, bytes);
      return;
    }
    offset += tarBlock + Math.ceil(size / tarBlock) * tarBlock;
  }
  throw new TypeError('missing fixture tar header');
}

export function configureProjectionAuthorityFixture({
  chain,
  digest,
  policy,
  projectionEntry,
  sha256,
  write,
}) {
  // biome-ignore format: executable fixture paths stay compact under the audited file-size gate.
  const processPaths = [...Object.values(policy.processAllowSet.executables).map(({ path }) => path.slice(1)), 'opt/node/bin/node', 'opt/pnpm/bin/pnpm.cjs', 'opt/google/chrome/chrome', 'opt/baci-cwv/canonical-json.mjs', 'opt/baci-cwv/policy.schema.mjs', 'opt/baci-cwv/sealed-runner.mjs'];
  // biome-ignore format: sealed authority paths are one closed fixture inventory.
  const sealedProcessPaths = [...new Set([...Object.values(policy.processAllowSet.executables).map(({ path }) => path), '/opt/baci-cwv/container-attest-runtime.mjs', '/opt/baci-cwv/cwv-runner-authority.mjs', '/opt/baci-cwv/cwv-runner-authority-core.mjs', '/opt/baci-cwv/cwv-runner-authority-filters.mjs', '/opt/baci-cwv/cwv-runner-authority-runtime.mjs', '/opt/baci-cwv/cwv-runner-stable-attestation-builder.mjs', '/opt/baci-cwv/direct-listener-conformance.mjs', '/opt/baci-cwv/entrypoint-runtime.mjs', '/opt/baci-cwv/entrypoint.mjs', '/opt/baci-cwv/entrypoint.sh', '/opt/baci-cwv/normal-release.mjs', '/opt/baci-cwv/process-inventory.mjs', '/opt/baci-cwv/registration-release.mjs', '/opt/baci-cwv/runner-identity-gate.mjs', `/${rootfsSourceInventoryPath}`, `/${rootfsSourceMembershipPath}`, '/opt/runner/entrypoint.mjs', ...processPaths.map((path) => `/${path}`)])].sort();
  const processEntry = (path, root) => ({
    mode:
      /rootfs-source-(?:inventory|membership)\.json$/.test(path) ||
      path === '/opt/runner/entrypoint.mjs'
        ? '0444'
        : '0555',
    owner: '0:0',
    path,
    realpath: path,
    sha256: /rootfs-source-(?:inventory|membership)\.json$/.test(path)
      ? sha256(readFileSync(join(root, path.slice(1))))
      : sha256('sealed'),
  });
  return {
    processPaths,
    sealedProcessPaths,
    writeProcessMap(root) {
      write(
        join(root, 'opt/baci-cwv/image-process-map.json'),
        canonicalJson({
          entries: Object.entries(policy.processAllowSet.executables).map(
            ([role, rule]) => ({
              role,
              ...processEntry(rule.path, root),
              maxInstancesByPhase: rule.maxInstancesByPhase,
            })
          ),
          phases: policy.processAllowSet.phases,
          receiptBinding: 'image-process-map-v1',
          schemaVersion: 1,
          sealed: sealedProcessPaths.map((path) => processEntry(path, root)),
        }),
        0o444
      );
    },
    writeSourceInventory(root) {
      const candidates = [];
      const collect = (directory, prefix = '') => {
        for (const name of readdirSync(directory)) {
          const path = prefix ? `${prefix}/${name}` : name;
          const absolute = join(directory, name);
          if (lstatSync(absolute).isDirectory()) collect(absolute, path);
          else {
            const entry = projectionEntry(path);
            if (entry.kind === 'artifact')
              candidates.push(
                `${entry.owner === 'chrome' ? 'deb' : 'tarball'}\t${entry.owner === 'chrome' ? 'google-chrome-stable' : entry.owner}\t${chain[entry.owner].sha256}\t${path}`
              );
            else if (entry.kind === 'package')
              candidates.push(`deb\t${entry.owner}\t${digest}\t${path}`);
            else if (entry.kind === 'closure')
              candidates.push(
                `deb\t${entry.owner === 'shell' ? 'dash' : entry.owner === 'isolation-probe' ? 'mawk' : 'libc6'}\t${digest}\t${path}`
              );
          }
        }
      };
      collect(root);
      const inventory = JSON.parse(
        serializeRootfsSourceInventory(Buffer.from(candidates.join('\n')), root)
      );
      for (const row of inventory.entries) {
        row.gid = 0;
        row.uid = 0;
      }
      write(
        join(root, rootfsSourceInventoryPath),
        canonicalJson(inventory),
        0o444
      );
      const sources = new Map();
      for (const row of inventory.entries) {
        const key = `${row.kind}\t${row.owner}\t${row.sourceSha256}`;
        const mapping =
          row.owner === 'node'
            ? ['opt/node', 1, `node-root/${row.path.slice(9)}`]
            : row.owner === 'pnpm'
              ? ['opt/pnpm', 1, `package/${row.path.slice(9)}`]
              : row.owner === 'runner'
                ? ['opt/runner', 0, row.path.slice(11)]
                : ['', 0, row.path];
        const entry = {
          gid: row.gid,
          linkTarget: row.linkTarget,
          mode: row.mode,
          path: row.path,
          sha256: row.sha256,
          sourcePath: mapping[2],
          type: row.type,
          uid: row.uid,
        };
        const source =
          row.kind === 'deb'
            ? {
                architecture: 'amd64',
                filename:
                  row.owner === 'google-chrome-stable'
                    ? new URL(chain.chrome.url).pathname.split('/deb/')[1]
                    : 'pool/a.deb',
                name: row.owner,
                sha256: row.sourceSha256,
                version:
                  row.owner === 'google-chrome-stable'
                    ? chain.chrome.version
                    : '1',
              }
            : { sha256: row.sourceSha256 };
        const group = sources.get(key) ?? {
          entries: [],
          installPrefix: mapping[0],
          kind: row.kind,
          owner: row.owner,
          source,
          stripComponents: mapping[1],
        };
        group.entries.push(entry);
        sources.set(key, group);
      }
      write(
        join(root, rootfsSourceMembershipPath),
        canonicalJson({
          schemaVersion: 1,
          sources: [...sources.values()].sort((left, right) =>
            `${left.kind}\0${left.owner}\0${left.source.sha256}`.localeCompare(
              `${right.kind}\0${right.owner}\0${right.source.sha256}`
            )
          ),
        }),
        0o444
      );
    },
  };
}
