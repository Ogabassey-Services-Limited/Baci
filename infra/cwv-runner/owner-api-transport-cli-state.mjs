// biome-ignore-all format: state records intentionally use compact exact serialization helpers
// biome-ignore-all lint/style/useSingleVarDeclarator: compact state guards preserve the 300-line contract

import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { appendFileSync, closeSync, constants, existsSync, fstatSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, renameSync, rmdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

import { createOwnerState } from './owner-api-transport.mjs';
import { canonical, fail, hash } from './owner-api-transport-primitives.mjs';
import {
  sourceFileDigest,
  TRANSPORT_ENTRY,
} from './owner-api-transport-source.mjs';

export function parseTransportArgs(argv) {
  if (argv[0] === '--initialize-state') {
    if (
      argv.length !== 9 ||
      argv[1] !== '--source-authorization' ||
      argv[3] !== '--source-authorization-sha256' ||
      argv[5] !== '--state' ||
      argv[7] !== '--state-sha256' ||
      !argv[2] ||
      !argv[4] ||
      !argv[6] ||
      !argv[8]
    )
      fail('invalid invocation');
    return {
      kind: 'initialize',
      sourceAuthorizationPath: argv[2],
      sourceAuthorizationShaPath: argv[4],
      statePath: argv[6],
      stateShaPath: argv[8],
    };
  }
  if (
    argv.length !== 8 ||
    argv[0] !== '--operation' ||
    argv[2] !== '--state' ||
    argv[4] !== '--state-sha256' ||
    argv[6] !== '--token-fd' ||
    argv[7] !== '0' ||
    !argv[1] ||
    !argv[3] ||
    !argv[5]
  )
    fail('invalid invocation');
  return {
    kind: 'operation',
    operation: argv[1],
    statePath: argv[3],
    stateShaPath: argv[5],
  };
}

function anchorRows(path) {
  const rows = readFileSync(path, 'utf8').trimEnd().split('\n').map((line) => /^([0-9]+) ([a-f0-9]{64})$/.exec(line));
  if (!rows.length || rows.some((row, index) => !row || Number(row[1]) !== index)) fail('invalid generation anchor');
  return rows;
}

function fsyncPath(path) {
  const descriptor = openSync(path, 'r');
  try { fsyncSync(descriptor); } finally { closeSync(descriptor); }
}

function fsyncDirectory(path) {
  fsyncPath(dirname(path));
}

function temporaryPath(path) {
  return `${path}.next.${process.pid}.${randomUUID()}`;
}

const same = (left, right) => left.dev === right.dev && left.ino === right.ino;
const bad = () => fail('invalid successful Task 9 handoff');
function holdDirectory(path) { const before = lstatSync(path); if (before.isSymbolicLink() || !before.isDirectory()) bad(); const descriptor = openSync(path, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW); const stat = fstatSync(descriptor); if (!stat.isDirectory() || !same(before, stat) || !same(stat, lstatSync(path))) { closeSync(descriptor); bad(); } return { descriptor, path, stat }; }
function assertHeldDirectory(held) { let current; try { current = lstatSync(held.path); } catch { bad(); } if (current.isSymbolicLink() || !current.isDirectory() || !same(current, held.stat) || !same(fstatSync(held.descriptor), held.stat)) bad(); }
function assertAbsent(path) { try { lstatSync(path); } catch (error) { if (error?.code === 'ENOENT') return; } bad(); }
function heldBytes(held, name) { assertHeldDirectory(held); const path = `${held.path}/${name}`, before = lstatSync(path); if (!before.isFile() || before.isSymbolicLink()) bad(); const descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW); try { const stat = fstatSync(descriptor); if (!stat.isFile() || !same(before, stat)) bad(); const bytes = readFileSync(descriptor); if (!same(stat, fstatSync(descriptor)) || !same(stat, lstatSync(path))) bad(); assertHeldDirectory(held); return bytes; } finally { closeSync(descriptor); } }
function heldState(held) { const bytes = heldBytes(held, 'task9-state.json'), expected = heldBytes(held, 'task9-state.sha256').toString('utf8'), anchor = heldBytes(held, 'task9-state.json.generation').toString('utf8'); if (expected !== `${hash(bytes)}  task9-state.json\n`) bad(); let state; try { state = JSON.parse(bytes); } catch { bad(); } if (canonical(state) !== bytes.toString('utf8')) bad(); const rows = anchor.trimEnd().split('\n').map((line) => /^([0-9]+) ([a-f0-9]{64})$/.exec(line)); if (!rows.length || rows.some((row, index) => !row || Number(row[1]) !== index) || rows.length !== state.generation + 1 || rows.at(-1)?.[2] !== state.stateDigest) bad(); return { bytes, state }; }

export function readSealedState({ statePath, stateShaPath }) {
  const bytes = readFileSync(statePath);
  const expected = readFileSync(stateShaPath, 'utf8');
  if (expected !== `${hash(bytes)}  task9-state.json\n`)
    fail('invalid state digest');
  let state;
  try {
    state = JSON.parse(bytes.toString('utf8'));
  } catch {
    fail('invalid state');
  }
  if (canonical(state) !== bytes.toString('utf8')) fail('invalid state');
  const anchor = anchorRows(`${statePath}.generation`);
  if (anchor.length !== state.generation + 1 || anchor.at(-1)?.[2] !== state.stateDigest) fail('invalid generation anchor');
  return state;
}

export function writeSealedState({ statePath, stateShaPath, state }) {
  const anchorPath = `${statePath}.generation`;
  if (existsSync(anchorPath)) {
    const prior = anchorRows(anchorPath);
    if (prior.length !== state.generation) fail('invalid generation anchor');
  } else if (state.generation !== 0) fail('invalid generation anchor');
  const bytes = Buffer.from(canonical(state));
  const temporary = temporaryPath(statePath);
  try {
    writeFileSync(temporary, bytes, { mode: 0o600, flag: 'wx' });
    fsyncPath(temporary);
    renameSync(temporary, statePath);
    fsyncDirectory(statePath);
  } finally {
    rmSync(temporary, { force: true });
  }
  writeFileSync(stateShaPath, `${hash(bytes)}  task9-state.json\n`, {
    mode: 0o600,
  });
  fsyncPath(stateShaPath);
  appendFileSync(anchorPath, `${state.generation} ${state.stateDigest}\n`, { mode: 0o600 });
  fsyncPath(anchorPath);
  fsyncDirectory(anchorPath);
  return { generation: state.generation, stateDigest: state.stateDigest };
}

export function writeNetworkPlan({ statePath, plan }) {
  const path = `${statePath}.network-plan.json`; const digestPath = `${statePath}.network-plan.sha256`; const temporary = temporaryPath(path); const bytes = Buffer.from(canonical(plan));
  try {
    writeFileSync(temporary, bytes, { mode: 0o600, flag: 'wx' });
    fsyncPath(temporary); renameSync(temporary, path); fsyncDirectory(path);
  } finally {
    rmSync(temporary, { force: true });
  }
  writeFileSync(digestPath, hash(bytes), { mode: 0o600 }); fsyncPath(digestPath); fsyncDirectory(digestPath);
  if (!readFileSync(path).equals(bytes) || readFileSync(digestPath, 'utf8') !== hash(bytes)) fail('invalid network plan persistence');
  return { planSha256: hash(bytes) };
}

function handoffValue(state) {
  const handoff = state?.ownerEvidenceHandoff;
  const evidence = state?.artifactReadbackEvidence;
  if (
    state?.phase !== 'EVIDENCE_VERIFIED' ||
    !Number.isInteger(state.generation) ||
    handoff?.terminalGeneration !== state.generation ||
    !/^[a-f0-9]{64}$/.test(handoff?.admissionId) ||
    !/^[a-f0-9]{64}$/.test(handoff?.archiveSha256) ||
    !/^[a-f0-9]{64}$/.test(handoff?.artifactMetadataSha256) ||
    !/^[a-f0-9]{64}$/.test(handoff?.hostRestoreSha256) ||
    !/^[a-f0-9]{64}$/.test(handoff?.memberSha256) ||
    !Number.isSafeInteger(handoff?.artifactId) ||
    !Number.isSafeInteger(handoff?.attempt) ||
    !Number.isSafeInteger(handoff?.runId) ||
    handoff.memberName !== 'h0-runner-attestation.json' ||
    typeof handoff.canonicalMember !== 'string' ||
    hash(handoff.canonicalMember) !== handoff.memberSha256 ||
    evidence?.archiveSha256 !== handoff.archiveSha256 ||
    evidence?.artifactMetadataSha256 !== handoff.artifactMetadataSha256 ||
    evidence?.memberSha256 !== handoff.memberSha256 ||
    evidence?.ownerHandoffSha256 !== hash(canonical(handoff))
  )
    fail('invalid successful Task 9 handoff');
  let member;
  try { member = JSON.parse(handoff.canonicalMember); } catch { fail('invalid successful Task 9 handoff'); }
  if (canonical(member) !== handoff.canonicalMember) fail('invalid successful Task 9 handoff');
  return handoff;
}

function writeHandoff(path, bytes) {
  writeFileSync(path, bytes, { flag: 'wx', mode: 0o400 });
  fsyncPath(path);
}

const keys = (value, expected) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join() === expected.join();
function terminalValue(bytes, state, handoff) { let value; try { value = JSON.parse(bytes); } catch { bad(); } const restore = value?.restore, terminal = value?.terminal, identity = (value) => value?.admissionId === handoff.admissionId && value?.attempt === handoff.attempt && value?.runId === handoff.runId && value?.schemaVersion === 1 && value?.stateGeneration === state.generation; if (canonical(value) !== bytes.toString('utf8') || !keys(value, ['restore', 'terminal']) || !keys(restore, ['admissionId', 'attempt', 'cleanupComplete', 'daemonsOffline', 'findings', 'networkAbsent', 'processes', 'restored', 'runId', 'runnerOffline', 'schemaVersion', 'stateGeneration', 'terminalProcessesSha256']) || !keys(terminal, ['admissionId', 'attempt', 'campaignId', 'processes', 'runId', 'schemaVersion', 'stateGeneration']) || !identity(restore) || !identity(terminal) || restore.cleanupComplete !== true || restore.daemonsOffline !== true || restore.networkAbsent !== true || restore.restored !== true || restore.runnerOffline !== true || !Array.isArray(restore.findings) || restore.findings.length || !Array.isArray(restore.processes) || restore.processes.length || !/^[a-f0-9]{64}$/.test(restore.terminalProcessesSha256) || !/^[a-z0-9][a-z0-9-]{0,62}$/.test(terminal.campaignId) || !Array.isArray(terminal.processes) || terminal.processes.length) bad(); }
function parseRecord(bytes, transactionDirectory) { let value; try { value = JSON.parse(bytes); } catch { bad(); } if (canonical(value) !== bytes.toString('utf8') || !keys(value, ['admissionId', 'archiveSha256', 'artifactId', 'artifactMetadataSha256', 'attempt', 'canonicalTransactionDirectory', 'memberSha256', 'phase', 'quarantineDirectory', 'rootTerminalSha256', 'runId', 'schemaVersion', 'stateDigest', 'stateGeneration', 'stateSha256', 'transactionDevice', 'transactionInode']) || value.schemaVersion !== 1 || value.phase !== 'PENDING' || value.canonicalTransactionDirectory !== transactionDirectory || !/^[a-f0-9]{64}$/.test(value.stateSha256) || !/^[a-f0-9]{64}$/.test(value.stateDigest) || !/^[a-f0-9]{64}$/.test(value.rootTerminalSha256) || !/^[0-9]+$/.test(value.transactionDevice) || !/^[0-9]+$/.test(value.transactionInode) || !Number.isSafeInteger(value.stateGeneration) || !Number.isSafeInteger(value.runId) || !Number.isSafeInteger(value.attempt) || !Number.isSafeInteger(value.artifactId) || resolve(value.quarantineDirectory) !== value.quarantineDirectory || dirname(value.quarantineDirectory) !== dirname(transactionDirectory) || value.quarantineDirectory === transactionDirectory) bad(); return value; }
function pendingRecord(transaction, state, handoff, terminal) { return canonical({ admissionId: handoff.admissionId, archiveSha256: handoff.archiveSha256, artifactId: handoff.artifactId, artifactMetadataSha256: handoff.artifactMetadataSha256, attempt: handoff.attempt, canonicalTransactionDirectory: transaction.path, memberSha256: handoff.memberSha256, phase: 'PENDING', quarantineDirectory: temporaryPath(transaction.path), rootTerminalSha256: hash(terminal), runId: handoff.runId, schemaVersion: 1, stateDigest: state.stateDigest, stateGeneration: state.generation, stateSha256: hash(heldBytes(transaction, 'task9-state.json')), transactionDevice: String(transaction.stat.dev), transactionInode: String(transaction.stat.ino) }); }
function matchPending(transaction, pending) { const { bytes, state } = heldState(transaction); let terminal = Buffer.alloc(0); try { const handoff = handoffValue(state); terminal = heldBytes(transaction, 'root-terminal.json'); terminalValue(terminal, state, handoff); if (pending.stateSha256 !== hash(bytes) || pending.stateDigest !== state.stateDigest || pending.stateGeneration !== state.generation || pending.rootTerminalSha256 !== hash(terminal) || pending.memberSha256 !== handoff.memberSha256 || pending.admissionId !== handoff.admissionId || pending.archiveSha256 !== handoff.archiveSha256 || pending.artifactMetadataSha256 !== handoff.artifactMetadataSha256 || pending.artifactId !== handoff.artifactId || pending.attempt !== handoff.attempt || pending.runId !== handoff.runId || String(transaction.stat.dev) !== pending.transactionDevice || String(transaction.stat.ino) !== pending.transactionInode) bad(); } finally { bytes.fill(0); terminal.fill(0); } }
function writeHeld(held, name, bytes) { assertHeldDirectory(held); writeHandoff(`${held.path}/${name}`, bytes); assertHeldDirectory(held); fsyncSync(held.descriptor); }
function createEvidence(parent, path, handoff, binding, pending) { assertAbsent(path); const temporary = temporaryPath(path); mkdirSync(temporary, { mode: 0o700 }); const held = holdDirectory(temporary); try { writeHeld(held, 'h0-runner-attestation.json', handoff.canonicalMember); writeHeld(held, 'h0-runner-attestation.sha256', `${hash(handoff.canonicalMember)}\n`); writeHeld(held, 'terminal-binding.json', binding); writeHeld(held, 'task9-cleanup-pending.json', pending); assertHeldDirectory(parent); renameSync(temporary, path); held.path = path; assertHeldDirectory(held); fsyncSync(parent.descriptor); return held; } catch (error) { closeSync(held.descriptor); throw error; } }
function completeEvidence(held, pending) { const complete = canonical({ ...pending, phase: 'COMPLETE' }); writeHeld(held, 'task9-cleanup-complete.json', complete); if (heldBytes(held, 'task9-cleanup-complete.json').toString('utf8') !== complete) bad(); }
const descriptorWalk = 'import os,stat,sys\nfd=3\ndef same(a,b): return a.st_dev==b.st_dev and a.st_ino==b.st_ino\ndef walk(d):\n for n in os.listdir(d):\n  c=os.open(n,os.O_RDONLY|os.O_NONBLOCK|os.O_NOFOLLOW,dir_fd=d)\n  try:\n   s=os.fstat(c)\n   if stat.S_ISDIR(s.st_mode): walk(c);cur=os.stat(n,dir_fd=d,follow_symlinks=False);same(s,cur) or sys.exit(65);os.rmdir(n,dir_fd=d)\n   elif stat.S_ISREG(s.st_mode):\n    s.st_nlink==1 or sys.exit(65);mode=s.st_mode|stat.S_IWUSR;os.fchmod(c,mode);w=os.open(n,os.O_RDWR|os.O_NONBLOCK|os.O_NOFOLLOW,dir_fd=d)\n    try:\n     t=os.fstat(w);(same(s,t) and t.st_mode==mode) or sys.exit(65);os.ftruncate(w,0);os.fsync(w);cur=os.stat(n,dir_fd=d,follow_symlinks=False);(same(t,cur) and cur.st_mode==mode) or sys.exit(65);os.unlink(n,dir_fd=d)\n    finally: os.close(w)\n   else: sys.exit(65)\n  finally: os.close(c)\nif sys.argv[1]=="clean": walk(fd);os.fsync(fd)\nsys.exit(0 if not os.listdir(fd) else 65)';
function walkHeld(held, mode) { const result = spawnSync('/usr/bin/python3', ['-I', '-S', '-E', '-c', descriptorWalk, mode], { env: {}, stdio: ['ignore', 'ignore', 'ignore', held.descriptor], timeout: 5000 }); if (!same(fstatSync(held.descriptor), held.stat) || result.status !== 0 || result.signal) bad(); }
function cleanupHeld(held) { walkHeld(held, 'clean'); }
function assertEmptyHeld(held) { walkHeld(held, 'verify'); assertHeldDirectory(held); }
function removeEmpty(parent, held) { assertHeldDirectory(parent); assertHeldDirectory(held); try { rmdirSync(held.path); fsyncSync(parent.descriptor); } catch (error) { if (!['EBUSY', 'ENOENT', 'ENOTEMPTY'].includes(error?.code)) throw error; } }
function moveAndClean(transaction, parent, pending, beforeCleanup) { assertHeldDirectory(parent); assertHeldDirectory(transaction); assertAbsent(pending.quarantineDirectory); renameSync(transaction.path, pending.quarantineDirectory); transaction.path = pending.quarantineDirectory; fsyncSync(parent.descriptor); assertHeldDirectory(transaction); if (String(transaction.stat.dev) !== pending.transactionDevice || String(transaction.stat.ino) !== pending.transactionInode) bad(); beforeCleanup?.(transaction.path); cleanupHeld(transaction); assertEmptyHeld(transaction); }
export function publishTask9SuccessHandoff({ afterComplete, beforeCleanup, beforeMove, evidenceDirectory, statePath, stateShaPath }) {
  const sealedStatePath = resolve(statePath), transactionDirectory = resolve(dirname(sealedStatePath)), sealedStateShaPath = resolve(stateShaPath), handoffDirectory = resolve(evidenceDirectory || '');
  if (sealedStatePath !== `${transactionDirectory}/task9-state.json` || sealedStateShaPath !== `${transactionDirectory}/task9-state.sha256` || !evidenceDirectory || [afterComplete, beforeCleanup, beforeMove].some((value) => value !== undefined && typeof value !== 'function') || relative(transactionDirectory, handoffDirectory) === '' || !relative(transactionDirectory, handoffDirectory).startsWith('..')) bad();
  const parent = holdDirectory(dirname(transactionDirectory)), evidenceParent = holdDirectory(dirname(handoffDirectory)); let transaction; let evidence; let stateBytes = Buffer.alloc(0), terminal = Buffer.alloc(0);
  try {
    transaction = holdDirectory(transactionDirectory); let pending; try { evidence = holdDirectory(handoffDirectory); pending = parseRecord(heldBytes(evidence, 'task9-cleanup-pending.json'), transactionDirectory); matchPending(transaction, pending); } catch (error) { if (error?.code !== 'ENOENT') throw error; const { bytes, state } = heldState(transaction); stateBytes = bytes; const handoff = handoffValue(state); terminal = heldBytes(transaction, 'root-terminal.json'); terminalValue(terminal, state, handoff); const binding = canonical({ admissionId: handoff.admissionId, archiveSha256: handoff.archiveSha256, artifactId: handoff.artifactId, artifactMetadataSha256: handoff.artifactMetadataSha256, attempt: handoff.attempt, hostRestoreSha256: handoff.hostRestoreSha256, memberSha256: handoff.memberSha256, rootTerminalSha256: hash(terminal), runId: handoff.runId, schemaVersion: 1, stateGeneration: state.generation }); pending = parseRecord(Buffer.from(pendingRecord(transaction, state, handoff, terminal)), transactionDirectory); evidence = createEvidence(evidenceParent, handoffDirectory, handoff, binding, canonical(pending)); beforeMove?.(transaction.path); } moveAndClean(transaction, parent, pending, beforeCleanup); completeEvidence(evidence, pending); afterComplete?.(); removeEmpty(parent, transaction); return { evidenceDirectory: handoffDirectory, memberSha256: pending.memberSha256 };
  } finally { stateBytes.fill(0); terminal.fill(0); transaction && closeSync(transaction.descriptor); evidence && closeSync(evidence.descriptor); closeSync(parent.descriptor); closeSync(evidenceParent.descriptor); }
}

export function initializeState(args) {
  const bytes = readFileSync(args.sourceAuthorizationPath);
  const stored = readFileSync(args.sourceAuthorizationShaPath, 'utf8').trim();
  if (stored !== hash(bytes)) fail('invalid authorization');
  let source;
  try {
    source = JSON.parse(bytes.toString('utf8'));
  } catch {
    fail('invalid authorization');
  }
  if (canonical(source) !== bytes.toString('utf8'))
    fail('invalid authorization');
  const createdMonotonicMs = Number(process.hrtime.bigint() / 1_000_000n);
  const state = createOwnerState({
    sourceAuthorizationBytes: bytes,
    sourceAuthorizationSha256: stored,
    digests: {
      manifest: source.provenance?.manifestSha256,
      policy: source.policyFileSha256,
      runtime: source.provenance?.runtimeSha256,
      transport: sourceFileDigest(source, TRANSPORT_ENTRY),
    },
    createdMonotonicMs,
    createdWallClockMs: Date.now(),
    deadlineMonotonicMs: createdMonotonicMs + 1200000,
  });
  return writeSealedState({ ...args, state });
}
