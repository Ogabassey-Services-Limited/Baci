// biome-ignore-all format: compact security fixtures stay within the 300-line contract
// biome-ignore-all lint/style/useSingleVarDeclarator: compact fixtures preserve the line limit
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, linkSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, readFile, readFile as readSourceFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { OPERATIONS } from './owner-api-transport.mjs';
import { initializeState, publishTask9SuccessHandoff, readSealedState, writeNetworkPlan } from './owner-api-transport-cli-state.mjs';
import { canonical } from './owner-api-transport-primitives.mjs';
import { TRANSPORT_ENTRY, TRANSPORT_SOURCE_FILES } from './owner-api-transport-source.mjs';

const hash = (value) => createHash('sha256').update(value).digest('hex');
async function writeAuthorization(root) {
  const authorization = {
    generation: 1,
    operationSet: OPERATIONS,
    operationSetDigest: hash(canonical(OPERATIONS)),
    policyFileSha256: 'c'.repeat(64),
    provenance: {
      manifestSha256: 'd'.repeat(64),
      nodeProvenanceSha256: '1'.repeat(64),
      runtimeSha256: 'f'.repeat(64),
      sourceArchiveSha256: '2'.repeat(64),
    },
    purpose: 'task9-exact-run',
    schemaVersion: 1,
    sourceBinding: {
      base: { ref: 'refs/heads/main', sha: '6'.repeat(40) },
      deploymentSha: 'a'.repeat(40),
      exactRun: {
        admissionId: 'b'.repeat(64),
        workflow: {
          id: 2,
          path: '.github/workflows/cwv-runner-attestation.yml',
          ref: 'refs/heads/main',
        },
      },
      mergeSha: '8'.repeat(40),
      pullRequest: { headRef: 'h0/task9', number: 9 },
      ref: 'refs/pull/9/merge',
      repository: { id: 1100488586, name: 'ogabasseyy/Baci' },
      reviewedSha: '7'.repeat(40),
    },
    sourceFiles: TRANSPORT_SOURCE_FILES.map((entry) => ({
      path: entry,
      sha256: entry === TRANSPORT_ENTRY ? 'e'.repeat(64) : '1'.repeat(64),
    })),
    transactionId: 'baci-cwv-1',
  };
  const bytes = Buffer.from(canonical(authorization));
  const sourceAuthorizationPath = path.join(root, 'source.json');
  const sourceAuthorizationShaPath = path.join(root, 'source.sha256');
  await writeFile(sourceAuthorizationPath, bytes);
  await writeFile(sourceAuthorizationShaPath, hash(bytes));
  return { sourceAuthorizationPath, sourceAuthorizationShaPath };
}
test('fsyncs sealed records and network-plan publications', async () => {
  const source = await readSourceFile(new URL('./owner-api-transport-cli-state.mjs', import.meta.url), 'utf8');
  for (const expression of [/renameSync\(temporary, statePath\);\s*fsyncDirectory\(statePath\);/, /appendFileSync\(anchorPath,[\s\S]*?fsyncDirectory\(anchorPath\);/, /renameSync\(temporary, path\);\s*fsyncDirectory\(path\);/, /writeFileSync\(digestPath,[\s\S]*?fsyncPath\(digestPath\);\s*fsyncDirectory\(digestPath\);/, /\['-I', '-S', '-E', '-c', descriptorWalk, mode\][\s\S]*timeout: 5000/, /c=os\.open\(n,os\.O_RDONLY\|os\.O_NONBLOCK\|os\.O_NOFOLLOW,dir_fd=d\)[\s\S]*s\.st_nlink==1[\s\S]*os\.fchmod\(c,mode\);w=os\.open\(n,os\.O_RDWR\|os\.O_NONBLOCK\|os\.O_NOFOLLOW,dir_fd=d\)[\s\S]*t=os\.fstat\(w\);\(same\(s,t\) and t\.st_mode==mode\)[\s\S]*os\.ftruncate\(w,0\);os\.fsync\(w\)/]) assert.match(source, expression);
});
test('initializes a sealed state from the canonical sourceFiles transport digest, never sourceHashes', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'baci-owner-state-'));
  const statePath = path.join(root, 'state.json');
  const stateShaPath = path.join(root, 'state.sha256');
  const { sourceAuthorizationPath, sourceAuthorizationShaPath } =
    await writeAuthorization(root);
  try {
    initializeState({
      sourceAuthorizationPath,
      sourceAuthorizationShaPath,
      statePath,
      stateShaPath,
    });
    const state = readSealedState({ statePath, stateShaPath });
    assert.equal(state.digests.transport, 'e'.repeat(64));
    assert.equal(
      (await readFile(stateShaPath, 'utf8')).startsWith(
        hash(await readFile(statePath))
      ),
      true
    );
    assert.equal(
      await readFile(`${statePath}.generation`, 'utf8'),
      `0 ${state.stateDigest}\n`
    );
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
test('initializes a sealed state despite an abandoned fixed temporary file', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'baci-owner-state-stale-'));
  const statePath = path.join(root, 'state.json');
  const stateShaPath = path.join(root, 'state.sha256');
  const { sourceAuthorizationPath, sourceAuthorizationShaPath } =
    await writeAuthorization(root);
  await writeFile(`${statePath}.next`, 'abandoned state temporary');
  try {
    initializeState({
      sourceAuthorizationPath,
      sourceAuthorizationShaPath,
      statePath,
      stateShaPath,
    });
    assert.equal(readSealedState({ statePath, stateShaPath }).generation, 0);
    assert.equal(
      await readFile(`${statePath}.next`, 'utf8'),
      'abandoned state temporary'
    );
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
test('publishes a network plan despite an abandoned fixed temporary file', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'baci-owner-plan-stale-'));
  const statePath = path.join(root, 'state.json');
  const plan = { address: '127.0.0.1', deadlineMonotonicMs: 1 };
  const temporary = `${statePath}.network-plan.json.next`;
  await writeFile(temporary, 'abandoned network plan temporary');
  try {
    assert.deepEqual(writeNetworkPlan({ statePath, plan }), {
      planSha256: hash(canonical(plan)),
    });
    assert.equal(
      await readFile(temporary, 'utf8'),
      'abandoned network plan temporary'
    );
    assert.equal(
      await readFile(`${statePath}.network-plan.json`, 'utf8'),
      canonical(plan)
    );
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

async function successFixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'baci-cwv-task9-success-'));
  const statePath = path.join(root, 'task9-state.json');
  const stateShaPath = path.join(root, 'task9-state.sha256');
  const evidenceDirectory = `${root}-evidence`;
  const member = canonical({ schemaVersion: 1, status: 'verified' });
  const handoff = {
    admissionId: 'd'.repeat(64), archiveSha256: 'a'.repeat(64), artifactId: 9,
    artifactMetadataSha256: 'b'.repeat(64), artifactName: 'h0-runner-attestation-8-1',
    attempt: 1, canonicalMember: member, expectedSha: 'e'.repeat(40),
    hostRestoreSha256: 'f'.repeat(64), memberName: 'h0-runner-attestation.json',
    memberSha256: hash(member), publicArtifactSha256: hash(member), runId: 8,
    runnerIdentitySha256: '0'.repeat(64), schemaVersion: 1,
    sourceAuthorizationSha256: '1'.repeat(64), stateBeforeFileSha256: '2'.repeat(64),
    stateBeforeGeneration: 6, stateBeforeSha256: '3'.repeat(64), terminalGeneration: 0,
  };
  const state = {
    artifactReadbackEvidence: {
      archiveSha256: 'a'.repeat(64),
      artifactMetadataSha256: 'b'.repeat(64),
      memberSha256: hash(member),
      ownerHandoffSha256: hash(canonical(handoff)),
    },
    generation: 0,
    ownerEvidenceHandoff: handoff,
    phase: 'EVIDENCE_VERIFIED', sourceAuthorization: { transactionId: 'baci-cwv-transaction-1' }, stateDigest: '4'.repeat(64),
  };
  const bytes = Buffer.from(canonical(state));
  await writeFile(statePath, bytes);
  await writeFile(stateShaPath, `${hash(bytes)}  task9-state.json\n`);
  await writeFile(`${statePath}.generation`, `0 ${state.stateDigest}\n`);
  await writeFile(`${statePath}.network-plan.json`, canonical({ path: '/actions-results/a?sig=capability&sp=r' }));
  await writeFile(`${statePath}.network-plan.sha256`, 'network-plan-digest');
  const rootTerminal = canonical({
    restore: {
      admissionId: handoff.admissionId, attempt: handoff.attempt, cleanupComplete: true,
      daemonsOffline: true, findings: [], networkAbsent: true, processes: [], restored: true,
      runId: handoff.runId, runnerOffline: true, schemaVersion: 1, stateGeneration: 0,
      terminalProcessesSha256: '9'.repeat(64),
    },
    terminal: {
      admissionId: handoff.admissionId, attempt: handoff.attempt, campaignId: 'cwv-h0',
      processes: [], runId: handoff.runId, schemaVersion: 1, stateGeneration: 0,
    },
  });
  await writeFile(path.join(root, 'root-terminal.json'), rootTerminal);
  await mkdir(path.join(root, 'tools'));
  await writeFile(path.join(root, 'tools', 'gh'), 'tool');
  await writeFile(path.join(root, 'authorized-source.json'), 'source');
  for (const file of [path.join(root, 'root-terminal.json'), path.join(root, 'tools', 'gh'), path.join(root, 'authorized-source.json')]) chmodSync(file, 0o400);
  return { evidenceDirectory, member, root, rootTerminal, statePath, stateShaPath };
}

test('removes the artifact redirect capability from the successful Task 9 transaction after publishing the fixed evidence handoff', async () => {
  const fixture = await successFixture();
  const priorPythonPath = Reflect.get(process.env, 'PYTHONPATH'); Reflect.set(process.env, 'PYTHONPATH', fixture.root); await writeFile(path.join(fixture.root, 'sitecustomize.py'), 'raise SystemExit(65)');
  try {
    await publishTask9SuccessHandoff(fixture);
    if (priorPythonPath === undefined) Reflect.deleteProperty(process.env, 'PYTHONPATH'); else Reflect.set(process.env, 'PYTHONPATH', priorPythonPath);
    assert.equal(await readFile(path.join(fixture.evidenceDirectory, 'h0-runner-attestation.json'), 'utf8'), fixture.member);
    assert.equal(await readFile(path.join(fixture.evidenceDirectory, 'h0-runner-attestation.sha256'), 'utf8'), `${hash(fixture.member)}\n`);
    assert.equal(JSON.parse(await readFile(path.join(fixture.evidenceDirectory, 'terminal-binding.json'), 'utf8')).rootTerminalSha256, hash(fixture.rootTerminal));
    assert.equal(JSON.parse(await readFile(path.join(fixture.evidenceDirectory, 'task9-cleanup-complete.json'), 'utf8')).phase, 'COMPLETE');
    await assert.rejects(readFile(`${fixture.statePath}.network-plan.json`, 'utf8'), /ENOENT/);
    await assert.rejects(readFile(fixture.statePath, 'utf8'), /ENOENT/);
    await assert.rejects(readFile(path.join(fixture.root, 'tools', 'gh'), 'utf8'), /ENOENT/);
    await assert.rejects(readFile(path.join(fixture.root, 'authorized-source.json'), 'utf8'), /ENOENT/);
  } finally {
    if (priorPythonPath === undefined) Reflect.deleteProperty(process.env, 'PYTHONPATH'); else Reflect.set(process.env, 'PYTHONPATH', priorPythonPath);
    await rm(fixture.root, { force: true, recursive: true });
    await rm(fixture.evidenceDirectory, { force: true, recursive: true });
  }
});

test('records a durable pending quarantine and leaves post-COMPLETE evidence for external inspection', async () => {
  const fixture = await successFixture(), vanished = await successFixture(); let quarantine = '';
  try {
    assert.throws(() => publishTask9SuccessHandoff({ ...fixture, beforeCleanup: (value) => { quarantine = value; throw new Error('crash after rename'); } }), /crash after rename/);
    assert.equal((await readFile(path.join(fixture.evidenceDirectory, 'task9-cleanup-pending.json'), 'utf8')).includes('PENDING'), true);
    assert.equal(await readFile(path.join(quarantine, 'task9-state.json.network-plan.json'), 'utf8'), canonical({ path: '/actions-results/a?sig=capability&sp=r' }));
    assert.equal(await readFile(fixture.statePath, 'utf8').catch((error) => error.code), 'ENOENT');
    await assert.rejects(readFile(path.join(fixture.evidenceDirectory, 'task9-cleanup-complete.json'), 'utf8'), /ENOENT/);
    assert.throws(() => publishTask9SuccessHandoff({ ...vanished, afterComplete: () => { throw new Error('crash after complete'); } }), /crash after complete/);
    const pending = JSON.parse(await readFile(path.join(vanished.evidenceDirectory, 'task9-cleanup-pending.json'), 'utf8'));
    assert.equal(await readFile(vanished.statePath, 'utf8').catch((error) => error.code), 'ENOENT');
    assert.deepEqual(await readdir(pending.quarantineDirectory), []);
    assert.equal(JSON.parse(await readFile(path.join(vanished.evidenceDirectory, 'task9-cleanup-complete.json'), 'utf8')).phase, 'COMPLETE');
  } finally { await Promise.all([fixture.root, quarantine, fixture.evidenceDirectory, vanished.root, vanished.evidenceDirectory].map((entry) => rm(entry, { force: true, recursive: true }))); }
});

test('resumes when a crash leaves the canonical transaction beside a pending receipt', async () => {
  const fixture = await successFixture();
  try {
    assert.throws(() => publishTask9SuccessHandoff({ ...fixture, beforeMove: () => { throw new Error('crash before rename'); } }), /crash before rename/);
    assert.equal(await readFile(fixture.statePath, 'utf8').then(() => true), true);
    publishTask9SuccessHandoff(fixture);
    assert.equal(await readFile(path.join(fixture.evidenceDirectory, 'task9-cleanup-complete.json'), 'utf8').then(() => true), true);
  } finally { await rm(fixture.root, { force: true, recursive: true }); await rm(fixture.evidenceDirectory, { force: true, recursive: true }); }
});

test('refuses a hard-linked cleanup child without scrubbing its outside content or completing', async () => {
  const fixture = await successFixture(), outside = `${fixture.root}-outside`;
  try {
    linkSync(path.join(fixture.root, 'authorized-source.json'), outside); assert.throws(() => publishTask9SuccessHandoff(fixture), /invalid successful Task 9 handoff/);
    assert.equal(await readFile(outside, 'utf8'), 'source');
    await assert.rejects(readFile(path.join(fixture.evidenceDirectory, 'task9-cleanup-complete.json'), 'utf8'), /ENOENT/);
  } finally {
    await rm(fixture.root, { force: true, recursive: true });
    await rm(outside, { force: true });
    await rm(fixture.evidenceDirectory, { force: true, recursive: true });
  }
});
test('refuses after pending quarantine relocation or an in-flight path swap', async () => {
  const relocated = await successFixture(), swapped = await successFixture(); let sibling = '', recorded = '';
  try {
    assert.throws(() => publishTask9SuccessHandoff({ ...relocated, beforeCleanup: (value) => { sibling = `${value}.unrecorded`; renameSync(value, sibling); } }), /invalid successful Task 9 handoff/);
    assert.deepEqual(await readdir(sibling), []); await assert.rejects(readFile(path.join(relocated.evidenceDirectory, 'task9-cleanup-complete.json'), 'utf8'), /ENOENT/);
    assert.throws(() => publishTask9SuccessHandoff({ ...swapped, beforeCleanup: (value) => { recorded = value; renameSync(value, `${value}.moved`); mkdirSync(value); writeFileSync(path.join(value, 'secret'), 'manual'); } }), /invalid successful Task 9 handoff/);
    assert.equal(await readFile(path.join(JSON.parse(await readFile(path.join(swapped.evidenceDirectory, 'task9-cleanup-pending.json'), 'utf8')).quarantineDirectory, 'secret'), 'utf8'), 'manual');
  } finally { await Promise.all([relocated.root, sibling, relocated.evidenceDirectory, swapped.root, recorded, `${recorded}.moved`, swapped.evidenceDirectory].map((entry) => rm(entry, { force: true, recursive: true }))); }
});

test('bounds FIFO cleanup refusal without completing', async () => { const fixture = await successFixture(), fifo = path.join(fixture.root, 'blocked'); try { assert.equal(spawnSync('/usr/bin/mkfifo', [fifo]).status, 0); const started = Date.now(); assert.throws(() => publishTask9SuccessHandoff(fixture), /invalid successful Task 9 handoff/); assert.ok(Date.now() - started < 1500); await assert.rejects(readFile(path.join(fixture.evidenceDirectory, 'task9-cleanup-complete.json'), 'utf8'), /ENOENT/); } finally { await rm(fixture.root, { force: true, recursive: true }); await rm(fixture.evidenceDirectory, { force: true, recursive: true }); } });

test('refuses an arbitrary root terminal even when the state and handoff are canonical', async () => {
  const fixture = await successFixture();
  try {
    chmodSync(path.join(fixture.root, 'root-terminal.json'), 0o600); await writeFile(path.join(fixture.root, 'root-terminal.json'), canonical({ cleanupComplete: true, schemaVersion: 1 }));
    assert.throws(() => publishTask9SuccessHandoff(fixture), /invalid successful Task 9 handoff/);
    assert.equal(await readFile(`${fixture.statePath}.network-plan.json`, 'utf8'), canonical({ path: '/actions-results/a?sig=capability&sp=r' }));
  } finally {
    await rm(fixture.root, { force: true, recursive: true });
    await rm(fixture.evidenceDirectory, { force: true, recursive: true });
  }
});
test('preserves the transaction for manual reconciliation when Task 9 never reaches verified evidence', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'baci-cwv-task9-failure-'));
  const statePath = path.join(root, 'task9-state.json');
  const stateShaPath = path.join(root, 'task9-state.sha256');
  const state = { generation: 0, phase: 'CANCELED', stateDigest: 'a'.repeat(64) };
  const bytes = Buffer.from(canonical(state));
  try {
    await writeFile(statePath, bytes);
    await writeFile(stateShaPath, `${hash(bytes)}  task9-state.json\n`);
    await writeFile(`${statePath}.generation`, `0 ${state.stateDigest}\n`);
    await writeFile(`${statePath}.network-plan.json`, '/actions-results/a?sig=forensic');

    assert.throws(
      () => publishTask9SuccessHandoff({
        evidenceDirectory: `${root}-evidence`, statePath, stateShaPath,
      }),
      /invalid successful Task 9 handoff/
    );

    assert.equal(await readFile(`${statePath}.network-plan.json`, 'utf8'), '/actions-results/a?sig=forensic');
  } finally {
    await rm(root, { force: true, recursive: true });
    await rm(`${root}-evidence`, { force: true, recursive: true });
  }
});
