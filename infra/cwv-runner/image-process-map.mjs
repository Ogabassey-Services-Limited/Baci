import { createHash } from 'node:crypto';
import {
  closeSync,
  constants,
  fstatSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { fileURLToPath } from 'node:url';

import { canonicalJson } from './canonical-json.mjs';
import { parseRunnerPolicy } from './policy.schema.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const mode = (stat) => (stat.mode & 0o7777).toString(8).padStart(4, '0');
export const sealedPaths = Object.freeze([
  '/opt/baci-cwv/canonical-json.mjs',
  '/opt/baci-cwv/container-attest-runtime.mjs',
  '/opt/baci-cwv/cwv-runner-authority.mjs',
  '/opt/baci-cwv/cwv-runner-authority-core.mjs',
  '/opt/baci-cwv/cwv-runner-authority-filters.mjs',
  '/opt/baci-cwv/cwv-runner-authority-runtime.mjs',
  '/opt/baci-cwv/cwv-runner-stable-attestation-builder.mjs',
  '/opt/baci-cwv/direct-listener-conformance.mjs',
  '/opt/baci-cwv/entrypoint-runtime.mjs',
  '/opt/baci-cwv/entrypoint.mjs',
  '/opt/baci-cwv/entrypoint.sh',
  '/opt/baci-cwv/normal-release.mjs',
  '/opt/baci-cwv/process-inventory.mjs',
  '/opt/baci-cwv/registration-release.mjs',
  '/opt/baci-cwv/runner-identity-gate.mjs',
  '/opt/baci-cwv/rootfs-source-inventory.json',
  '/opt/baci-cwv/rootfs-source-membership.json',
  '/opt/runner/entrypoint.mjs',
  '/opt/baci-cwv/sealed-runner.mjs',
  '/opt/baci-cwv/policy.schema.mjs',
  '/opt/node/bin/node',
  '/opt/pnpm/bin/pnpm.cjs',
  '/opt/google/chrome/chrome',
]);
const exactKeys = (value, keys) =>
  value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());

function member(path, root = '') {
  const absolute = `${root}${path}`;
  const realpath = realpathSync(absolute);
  if (realpath !== absolute)
    throw new TypeError('ambiguous image executable path');
  let descriptor;
  try {
    descriptor = openSync(absolute, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = fstatSync(descriptor);
    if (!stat.isFile()) throw new TypeError('ambiguous image executable path');
    return {
      mode: mode(stat),
      owner: `${stat.uid}:${stat.gid}`,
      path,
      realpath,
      sha256: sha256(readFileSync(descriptor)),
    };
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

export function imageProcessMap(policy, root = '') {
  const entries = Object.entries(policy.processAllowSet.executables).map(
    ([role, rule]) => ({
      role,
      ...member(rule.path, root),
      maxInstancesByPhase: rule.maxInstancesByPhase,
    })
  );
  const sealed = [
    ...new Set([...sealedPaths, ...entries.map((entry) => entry.path)]),
  ]
    .sort()
    .map((path) => member(path, root));
  return {
    entries,
    phases: policy.processAllowSet.phases,
    receiptBinding: 'image-process-map-v1',
    schemaVersion: 1,
    sealed,
  };
}

export function validateImageProcessMap(value, policy) {
  const roles = Object.keys(policy.processAllowSet.executables);
  if (
    !exactKeys(value, [
      'entries',
      'phases',
      'receiptBinding',
      'schemaVersion',
      'sealed',
    ]) ||
    value.schemaVersion !== 1 ||
    value.receiptBinding !== 'image-process-map-v1' ||
    canonicalJson(value.phases) !==
      canonicalJson(policy.processAllowSet.phases) ||
    !Array.isArray(value.entries) ||
    value.entries.length !== roles.length ||
    !Array.isArray(value.sealed)
  )
    throw new TypeError('invalid image process map');
  const entryKeys = [
    'maxInstancesByPhase',
    'mode',
    'owner',
    'path',
    'realpath',
    'role',
    'sha256',
  ];
  for (const [index, entry] of value.entries.entries()) {
    const rule = policy.processAllowSet.executables[roles[index]];
    if (
      !exactKeys(entry, entryKeys) ||
      entry.role !== roles[index] ||
      entry.path !== rule.path ||
      entry.realpath !== entry.path ||
      !/^[0-7]{4}$/.test(entry.mode) ||
      entry.owner !== '0:0' ||
      (Number.parseInt(entry.mode, 8) & 0o022) !== 0 ||
      (Number.parseInt(entry.mode, 8) & 0o111) === 0 ||
      !/^[0-9a-f]{64}$/.test(entry.sha256) ||
      canonicalJson(entry.maxInstancesByPhase) !==
        canonicalJson(rule.maxInstancesByPhase)
    )
      throw new TypeError('invalid image process entry');
  }
  const sealedKeys = ['mode', 'owner', 'path', 'realpath', 'sha256'];
  const expected = [
    ...new Set([
      ...sealedPaths,
      ...Object.values(policy.processAllowSet.executables).map(
        (rule) => rule.path
      ),
    ]),
  ].sort();
  if (value.sealed.length !== expected.length)
    throw new TypeError('incomplete image sealed projection');
  for (const [index, entry] of value.sealed.entries())
    if (
      !exactKeys(entry, sealedKeys) ||
      entry.path !== expected[index] ||
      entry.realpath !== entry.path ||
      !/^[0-7]{4}$/.test(entry.mode) ||
      entry.owner !== '0:0' ||
      (Number.parseInt(entry.mode, 8) & 0o022) !== 0 ||
      !/^[0-9a-f]{64}$/.test(entry.sha256)
    )
      throw new TypeError('invalid sealed runtime entry');
  return value;
}

export function writeImageProcessMap(
  policy,
  outputPath,
  root = '',
  { replace = renameSync } = {}
) {
  if (typeof outputPath !== 'string' || outputPath.length === 0)
    throw new TypeError('invalid image process map output path');
  const temporaryPath = `${outputPath}.${process.pid}.tmp`;
  let replaced = false;
  try {
    writeFileSync(temporaryPath, canonicalJson(imageProcessMap(policy, root)), {
      mode: 0o444,
    });
    replace(temporaryPath, outputPath);
    replaced = true;
  } finally {
    if (!replaced) rmSync(temporaryPath, { force: true });
  }
}

if (
  process.argv[1] === fileURLToPath(import.meta.url) &&
  process.argv[2] === 'write'
) {
  const [policyPath, outputPath, root = ''] = process.argv.slice(3);
  if (!policyPath || !outputPath || process.argv.length > 6)
    throw new TypeError('invalid image process map command');
  const policy = parseRunnerPolicy(
    JSON.parse(readFileSync(policyPath, 'utf8'))
  );
  writeImageProcessMap(policy, outputPath, root);
}
