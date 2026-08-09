// biome-ignore-all format: The Task 5 fixed-tool parser is intentionally compact to remain within the 300-line runtime cap.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  lstatSync,
  readFileSync,
  realpathSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { canonicalJson, canonicalSha256 } from './canonical-json.mjs';
import { createSourceArchive, verifySourceArchive } from './source-archive.mjs';

export { createSourceArchive, verifySourceArchive } from './source-archive.mjs';

const PREFIX = 'infra/cwv-runner/';
const LIMITS = { archive: 16_777_216, members: 1024, member: 1_048_576 };
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

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const fail = (message) => {
  throw new TypeError(message);
};
const pathCompare = (left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right));

function git(cwd, args, input, encoding = 'utf8') {
  return execFileSync(TRUSTED_GIT, args, {
    cwd,
    encoding,
    input,
    env: trustedGitEnvironment(),
    maxBuffer: LIMITS.archive * 8,
  });
}

const verifiedObjects = new Map();
function verifyObjects(cwd, objectIds) {
  const ids = [...new Set(objectIds)].filter((id) => !verifiedObjects.has(`${cwd}\0${id}`));
  if (!ids.length) return;
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
    verifiedObjects.set(`${cwd}\0${objectId}`, { type, bytes: Buffer.from(bytes) });
    offset = start + size + 1;
  }
}

function checkedSha(value, field) {
  if (typeof value !== 'string' || !/^[0-9a-f]{40,64}$/.test(value)) fail(`invalid ${field}`);
  return value;
}

function checkedPath(value) {
  if (typeof value !== 'string' || !value || value.includes('\0') || isAbsolute(value)) fail('invalid path');
  const parts = value.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..') || Buffer.from(value).toString('utf8') !== value) fail('ambiguous path');
  return value;
}

function checkedMode(mode) {
  if (mode !== '100644' && mode !== '100755') fail('unsupported Git mode');
  return mode;
}

function objectBytes(cwd, objectId) {
  if (!/^[0-9a-f]{40,64}$/.test(objectId)) fail('invalid Git object id');
  const key = `${cwd}\0${objectId}`;
  if (!verifiedObjects.has(key)) verifyObjects(cwd, [objectId]);
  const object = verifiedObjects.get(key);
  if (!object || object.type !== 'blob') fail('invalid Git blob');
  return Buffer.from(object.bytes);
}

function treeRows(cwd, sha, prefix = '') {
  checkedSha(sha, 'tree SHA');
  const output = git(cwd, ['ls-tree', '-r', '-z', sha, '--', prefix], null, null);
  const rows = [];
  for (const item of output.toString('utf8').split('\0').filter(Boolean)) {
    const match = /^(\d{6}) (\S+) ([0-9a-f]{40,64})\t(.+)$/.exec(item);
    if (!match) fail('malformed Git tree row');
    const [, mode, type, objectId, path] = match;
    checkedPath(path);
    if (type !== 'blob') fail('non-blob source-tree leaf');
    rows.push({ path, mode: checkedMode(mode), objectId });
  }
  const tree = git(cwd, ['rev-parse', `${sha}^{tree}`]).trim();
  const directories = git(cwd, ['ls-tree', '-d', '-r', '-z', sha, '--', prefix], null, null)
    .toString('utf8').split('\0').filter(Boolean).map((item) => {
      const match = /^(\d{6}) tree ([0-9a-f]{40,64})\t(.+)$/.exec(item);
      if (!match) fail('malformed Git tree row');
      return match[2];
    });
  verifyObjects(cwd, [sha, tree, ...directories, ...rows.map(({ objectId }) => objectId)]);
  return rows.sort((left, right) => pathCompare(left.path, right.path));
}

function blobEntry(cwd, row) {
  const bytes = objectBytes(cwd, row.objectId);
  if (bytes.length > LIMITS.member) fail('source member exceeds size limit');
  return { path: row.path, mode: row.mode, blobSha256: sha256(bytes), bytes };
}

function changedEntries(cwd, baseSha, reviewedHeadSha, mergeSha) {
  checkedSha(baseSha, 'base SHA');
  checkedSha(reviewedHeadSha, 'reviewed head SHA');
  checkedSha(mergeSha, 'merge SHA');
  verifyObjects(cwd, [baseSha, reviewedHeadSha, mergeSha]);
  const output = git(cwd, ['diff', '--name-status', '-z', '--no-renames', baseSha, reviewedHeadSha], null, null);
  const entries = [];
  for (let index = 0, fields = output.toString('utf8').split('\0'); index < fields.length - 1; index += 2) {
    const [status, path] = [fields[index], fields[index + 1]];
    if (!status || !path || !/^[AMD]$/.test(status)) fail('ambiguous changed-path status');
    checkedPath(path);
    if (status === 'D') {
      if (treeRows(cwd, mergeSha, path).length) fail('deleted path remains in merge tree');
      entries.push({ path, status, absent: true });
      continue;
    }
    const reviewed = treeRows(cwd, reviewedHeadSha, path);
    const merged = treeRows(cwd, mergeSha, path);
    if (reviewed.length !== 1 || merged.length !== 1 || reviewed[0].path !== path || merged[0].path !== path) fail('ambiguous changed path');
    const entry = blobEntry(cwd, reviewed[0]);
    const mergedBytes = objectBytes(cwd, merged[0].objectId);
    if (entry.mode !== merged[0].mode || entry.blobSha256 !== sha256(mergedBytes)) fail('merge tree differs from reviewed path');
    entries.push({ path, status, mode: entry.mode, blobSha256: entry.blobSha256 });
  }
  return entries.sort((left, right) => pathCompare(left.path, right.path));
}

function sourceEntries(cwd, mergeSha) {
  const entries = treeRows(cwd, mergeSha, PREFIX).map((row) => blobEntry(cwd, row));
  if (!entries.length || entries.some((entry) => !entry.path.startsWith(PREFIX))) fail('invalid source archive projection');
  if (entries.find((entry) => entry.path === `${PREFIX}vps-ssh.sh`)?.mode !== '100755')
    fail('vps SSH wrapper must be executable');
  return entries;
}

function exactKeys(value, keys) { return value && typeof value === 'object' && !Array.isArray(value) && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort()); }
function policyProjection(policy) {
  if (!exactKeys(policy, ['artifactRetentionDays', 'authority', 'dedicatedRuntime', 'host', 'installationImport', 'networkAccounting', 'processAllowSet', 'repository', 'repositoryAuthority', 'resources', 'ruleset', 'runner', 'schemaVersion', 'supplyChain', 'supplyChainProvenance', 'thresholds', 'workflowActions']) || !Number.isSafeInteger(policy.schemaVersion) || policy.schemaVersion !== 1 || !exactKeys(policy.authority, ['normativeContractPath', 'normativeContractSha256', 'implementationBaseSha', 'deploymentRunId', 'deploymentRunAttempt', 'deploymentMarker'])) fail('invalid reviewed policy schema');
  return policy.authority;
}

function outputPaths(paths) {
  const parent = dirname(paths[0]);
  const directory = lstatSync(parent);
  if (!directory.isDirectory() || directory.isSymbolicLink() || directory.uid !== process.getuid() || (directory.mode & 0o077)) fail('unsafe output directory');
  for (const path of paths) if (dirname(path) !== parent || relative(parent, path).includes('/') || lstatSync(path, { throwIfNoEntry: false })?.isSymbolicLink()) fail('unsafe output path');
}

function atomicWrite(path, value) {
  const temporary = `${path}.tmp-${process.pid}`;
  if (lstatSync(path, { throwIfNoEntry: false })) fail('refusing existing output');
  writeFileSync(temporary, value, { mode: 0o600, flag: 'wx' });
  renameSync(temporary, path);
}

function policyForTree(cwd, reviewedHeadSha, mergeSha = reviewedHeadSha) {
  const reviewed = treeRows(cwd, reviewedHeadSha, `${PREFIX}policy.json`);
  const merged = treeRows(cwd, mergeSha, `${PREFIX}policy.json`);
  if (reviewed.length !== 1 || merged.length !== 1 || reviewed[0].path !== `${PREFIX}policy.json` || merged[0].path !== `${PREFIX}policy.json`) fail('ambiguous policy source');
  const bytes = objectBytes(cwd, reviewed[0].objectId);
  if (sha256(bytes) !== sha256(objectBytes(cwd, merged[0].objectId))) fail('merge policy differs from reviewed tree');
  try { const policy = JSON.parse(bytes); policyProjection(policy); return { policy, policyFileSha256: sha256(bytes) }; }
  catch { fail('invalid reviewed policy'); }
}

export function freezeSourceManifest({ cwd, prNumber, reviewedHeadSha, baseSha, mergeSha, output, outputDigest, sourceArchive, sourceArchiveDigest }) {
  if (!Number.isSafeInteger(Number(prNumber)) || Number(prNumber) <= 0) fail('invalid PR number');
  outputPaths([output, outputDigest, sourceArchive, sourceArchiveDigest]);
  const { policy, policyFileSha256 } = policyForTree(cwd, reviewedHeadSha, mergeSha);
  const entries = changedEntries(cwd, baseSha, reviewedHeadSha, mergeSha);
  const archiveEntries = sourceEntries(cwd, mergeSha);
  const archive = createSourceArchive(archiveEntries);
  const manifest = { schemaVersion: 1, policyFileSha256, policyCanonicalSha256: canonicalSha256(policy), authority: policyProjection(policy), prNumber: Number(prNumber), reviewedHeadSha, baseSha, mergeSha, entries, sourceArchive: { prefix: PREFIX, entries: archiveEntries.map(({ path, mode, blobSha256 }) => ({ path, mode, blobSha256 })) } };
  const bytes = Buffer.from(canonicalJson(manifest));
  atomicWrite(output, bytes); atomicWrite(outputDigest, `${sha256(bytes)}\n`); atomicWrite(sourceArchive, archive); atomicWrite(sourceArchiveDigest, `${sha256(archive)}\n`);
  return manifest;
}

export function verifySourceManifest({ cwd, prNumber, reviewedHeadSha, baseSha, mergeSha, input, inputDigest, sourceArchive, sourceArchiveDigest }) {
  outputPaths([input, inputDigest, sourceArchive, sourceArchiveDigest]);
  const digest = readFileSync(inputDigest, 'utf8');
  if (!/^[0-9a-f]{64}\n$/.test(digest)) fail('invalid manifest digest file');
  const bytes = readFileSync(input);
  if (sha256(bytes) !== digest.trim() || canonicalJson(JSON.parse(bytes)) !== bytes.toString('utf8')) fail('manifest is not canonical');
  const manifest = JSON.parse(bytes);
  const expected = freezeExpected(cwd, prNumber, reviewedHeadSha, baseSha, mergeSha);
  if (canonicalJson(manifest) !== canonicalJson(expected)) fail('manifest identity mismatch');
  const archive = readFileSync(sourceArchive);
  if (readFileSync(sourceArchiveDigest, 'utf8') !== `${sha256(archive)}\n`) fail('invalid source archive digest');
  verifySourceArchive(archive, manifest.sourceArchive.entries);
  return manifest;
}

function preflightExpected(cwd, prNumber, reviewedHeadSha, baseSha) {
  const { policy, policyFileSha256 } = policyForTree(cwd, reviewedHeadSha);
  const entries = changedEntries(cwd, baseSha, reviewedHeadSha, reviewedHeadSha);
  const archiveEntries = sourceEntries(cwd, reviewedHeadSha);
  return { schemaVersion: 'preflight-v1', policyFileSha256, policyCanonicalSha256: canonicalSha256(policy), authority: policyProjection(policy), prNumber: Number(prNumber), reviewedHeadSha, baseSha, sourceArchive: { prefix: PREFIX, entries: archiveEntries.map(({ path, mode, blobSha256 }) => ({ path, mode, blobSha256 })) }, entries };
}

function preflightWrite(manifest, output, outputDigest, sourceArchive, sourceArchiveDigest, cwd, reviewedHeadSha) {
  outputPaths([output, outputDigest, sourceArchive, sourceArchiveDigest]);
  const entries = sourceEntries(cwd, reviewedHeadSha);
  const archive = createSourceArchive(entries);
  const bytes = Buffer.from(canonicalJson(manifest));
  atomicWrite(output, bytes); atomicWrite(outputDigest, `${sha256(bytes)}\n`); atomicWrite(sourceArchive, archive); atomicWrite(sourceArchiveDigest, `${sha256(archive)}\n`);
  return manifest;
}

export function freezePreflightSourceManifest({ cwd, prNumber, reviewedHeadSha, baseSha, output, outputDigest, sourceArchive, sourceArchiveDigest }) {
  if (!Number.isSafeInteger(Number(prNumber)) || Number(prNumber) <= 0) fail('invalid PR number');
  return preflightWrite(preflightExpected(cwd, prNumber, reviewedHeadSha, baseSha), output, outputDigest, sourceArchive, sourceArchiveDigest, cwd, reviewedHeadSha);
}

export function verifyPreflightSourceManifest({ cwd, prNumber, reviewedHeadSha, baseSha, input, inputDigest, sourceArchive, sourceArchiveDigest }) {
  outputPaths([input, inputDigest, sourceArchive, sourceArchiveDigest]);
  const bytes = readFileSync(input);
  const recorded = readFileSync(inputDigest, 'utf8');
  if (!/^[0-9a-f]{64}\n$/.test(recorded) || sha256(bytes) !== recorded.trim()) fail('invalid preflight digest');
  const manifest = JSON.parse(bytes);
  const expected = preflightExpected(cwd, prNumber, reviewedHeadSha, baseSha);
  if (canonicalJson(manifest) !== bytes.toString() || canonicalJson(manifest) !== canonicalJson(expected)) fail('preflight identity mismatch');
  const archive = readFileSync(sourceArchive);
  if (readFileSync(sourceArchiveDigest, 'utf8') !== `${sha256(archive)}\n`) fail('invalid preflight archive digest');
  verifySourceArchive(archive, manifest.sourceArchive.entries); return manifest;
}

function freezeExpected(cwd, prNumber, reviewedHeadSha, baseSha, mergeSha) {
  const { policy, policyFileSha256 } = policyForTree(cwd, reviewedHeadSha, mergeSha);
  const entries = changedEntries(cwd, baseSha, reviewedHeadSha, mergeSha);
  const archiveEntries = sourceEntries(cwd, mergeSha);
  return { schemaVersion: 1, policyFileSha256, policyCanonicalSha256: canonicalSha256(policy), authority: policyProjection(policy), prNumber: Number(prNumber), reviewedHeadSha, baseSha, mergeSha, entries, sourceArchive: { prefix: PREFIX, entries: archiveEntries.map(({ path, mode, blobSha256 }) => ({ path, mode, blobSha256 })) } };
}

function argumentsFor(command) {
  const preflight = command.endsWith('preflight');
  const write = command.startsWith('freeze');
  const names = ['prNumber', 'reviewedHeadSha', 'baseSha', ...(preflight ? [] : ['mergeSha']), ...(write ? ['output', 'outputDigest'] : ['input', 'inputDigest']), 'sourceArchive', 'sourceArchiveDigest'];
  const values = Object.fromEntries(names.map((name) => [name, undefined]));
  const flags = new Map(names.map((name) => [`--${({ prNumber: 'pr-number', reviewedHeadSha: 'reviewed-head', baseSha: 'base', mergeSha: 'merge' })[name] ?? name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`, name]));
  const args = process.argv.slice(3);
  if (args.length !== names.length * 2) fail('invalid source-manifest arguments');
  for (let index = 0; index < args.length; index += 2) {
    const key = flags.get(args[index]);
    if (!key || values[key] !== undefined) fail(`invalid source-manifest flag: ${args[index]}`);
    values[key] = args[index + 1];
  }
  return values;
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const command = process.argv[2];
  if (!['freeze', 'verify', 'freeze-preflight', 'verify-preflight'].includes(command)) fail('usage: source-manifest.mjs freeze|verify|freeze-preflight|verify-preflight');
  const values = { cwd: process.cwd(), ...argumentsFor(command) };
  const result = command === 'freeze' ? freezeSourceManifest(values) : command === 'verify' ? verifySourceManifest(values) : command === 'freeze-preflight' ? freezePreflightSourceManifest(values) : verifyPreflightSourceManifest(values);
  process.stdout.write(`${sha256(canonicalJson(result))}\n`);
}
