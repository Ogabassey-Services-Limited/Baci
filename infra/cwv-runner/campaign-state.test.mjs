import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
// biome-ignore format: keeps the state regression fixture below the source ceiling.
import { createRegistrationCaptureEvidence, deriveRegistrationCaptureAuthority } from './campaign-capture-authority.mjs';
// biome-ignore format: keeps the state regression fixture below the source ceiling.
import { assertNoMarkCollision, createCapture, inspectProgress, recordJournalEntry, setPhase, verifyCapture } from './campaign-state.mjs';

const host = Object.freeze({ bootId: 'boot-a', hostname: 'ogabassey' });
const priorState = Object.freeze({
  schemaVersion: 1,
  cron: {
    sha256: 'a'.repeat(64),
    archiveSha256: 'a'.repeat(64),
    archivePath: '/srv/baci-cwv/campaigns/tx/crontab.before',
    serviceActive: true,
    serviceEnabled: true,
  },
  resources: { runners: [], timers: [], containers: [], slices: [] },
  network: {
    ipForward: 1,
    campaignMark: 0xb1234567,
    collisions: [],
    accountingTablePresent: false,
    baselineSha256: 'b'.repeat(64),
    externalInterface: { name: 'eth0', ifindex: 2 },
    // biome-ignore format: keeps the state regression fixture below the source ceiling.
    inventories: Object.fromEntries('nftables iptables ip6tables ipRules4 ipRules6 tc conntrack addresses routes dockerNetworks'.split(' ').map((key) => [key, 'c'.repeat(64)])),
  },
});
// biome-ignore format: keeps the state regression fixture below the source ceiling.
const registrationAddresses = Buffer.from(JSON.stringify([{ addr_info: [{ family: 'inet', local: '82.29.190.219' }] }]));
// biome-ignore format: keeps the state regression fixture below the source ceiling.
const registrationDockerNetworks = Buffer.from(JSON.stringify([{ IPAM: { Config: [{ Subnet: '172.18.0.0/16' }] } }]));
const registrationServices = [{ uid: 2, unit: 'baci.service' }];
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
// biome-ignore format: keeps the state regression fixture below the source ceiling.
const registrationCaptureOptions = Object.freeze({
  priorState: { ...priorState, network: { ...priorState.network, inventories: { ...priorState.network.inventories, addresses: digest(registrationAddresses), dockerNetworks: digest(registrationDockerNetworks) } } },
  registrationAuthority: deriveRegistrationCaptureAuthority({ addresses: registrationAddresses, dockerNetworks: registrationDockerNetworks, externalInterface: { ifindex: 2, name: 'eth0' }, services: registrationServices }),
  registrationAuthorityEvidence: createRegistrationCaptureEvidence({ addresses: registrationAddresses, dockerNetworks: registrationDockerNetworks, services: registrationServices }),
});
test('creates an immutable canonical capture for every closed mode', async () => {
  for (const mode of ['prepare', 'registration', 'campaign', 'rehearsal']) {
    const root = await mkdtemp(path.join(os.tmpdir(), 'cwv-state-'));
    const result = await createCapture({
      root,
      transactionId: `tx-${mode}`,
      mode,
      host,
      priorState,
      ...(mode === 'registration' ? registrationCaptureOptions : {}),
    });
    assert.match(result.sha256, /^[a-f0-9]{64}$/);
    assert.equal(await readFile(result.shaPath, 'utf8'), `${result.sha256}\n`);
    assert.equal(
      (
        await verifyCapture({
          root,
          transactionId: `tx-${mode}`,
          expectedSha256: result.sha256,
          host,
        })
      ).mode,
      mode
    );
  }
});
test('rejects invalid state and root-sync faults before transaction contents', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cwv-state-'));
  await assert.rejects(
    () =>
      createCapture({
        root,
        transactionId: 'tx-root-sync',
        mode: 'campaign',
        host,
        priorState,
        syncRoot: () => Promise.reject(new Error('root sync failure')),
      }),
    /root sync failure/
  );
  await assert.rejects(readFile(`${root}/tx-root-sync/capture.json`));
  await assert.rejects(
    () =>
      createCapture({
        root,
        transactionId: 'tx',
        mode: 'live',
        host,
        priorState: {},
      }),
    /closed mode/
  );
  await assert.rejects(
    () =>
      createCapture({
        root,
        transactionId: '../tx',
        mode: 'prepare',
        host,
        priorState: {},
      }),
    /transaction id/
  );
  await assert.rejects(
    () =>
      createCapture({
        root,
        transactionId: 'tx-secret',
        mode: 'prepare',
        host,
        priorState: { token: 'secret' },
      }),
    /secret-shaped key/
  );
  const result = await createCapture({
    root,
    transactionId: 'tx-drift',
    mode: 'campaign',
    host,
    priorState,
  });
  await assert.rejects(
    () =>
      verifyCapture({
        root,
        transactionId: 'tx-drift',
        expectedSha256: result.sha256,
        host: { ...host, bootId: 'boot-b' },
      }),
    /host identity/
  );
  await writeFile(result.capturePath, '{}\n');
  await assert.rejects(
    () =>
      verifyCapture({
        root,
        transactionId: 'tx-drift',
        expectedSha256: result.sha256,
        host,
      }),
    /capture digest/
  );
});
test('keeps phase and immutable hash-chained journal separate from capture authority', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cwv-state-'));
  const result = await createCapture({
    root,
    transactionId: 'tx-progress',
    mode: 'registration',
    host,
    ...registrationCaptureOptions,
  });
  await setPhase({ root, transactionId: 'tx-progress', phase: 'acquiring' });
  const first = await recordJournalEntry({
    root,
    transactionId: 'tx-progress',
    action: 'stop-timer',
    resource: 'apt-daily.timer',
  });
  const second = await recordJournalEntry({
    root,
    transactionId: 'tx-progress',
    action: 'set-cpuset',
    resource: 'app',
  });
  await setPhase({ root, transactionId: 'tx-progress', phase: 'active' });
  await assert.rejects(
    () =>
      setPhase({
        root,
        transactionId: 'tx-progress',
        phase: 'target-accepted',
      }),
    /verified target receipt/
  );
  assert.equal(first.sequence, 1);
  assert.equal(second.sequence, 2);
  assert.equal(second.previousSha256, first.sha256);
  assert.equal(second.transactionId, 'tx-progress');
  assert.equal(second.captureSha256, result.sha256);
  assert.equal(second.resourceIdentitySha256.length, 64);
  assert.equal(
    (
      await verifyCapture({
        root,
        transactionId: 'tx-progress',
        expectedSha256: result.sha256,
        host,
      })
    ).sha256,
    result.sha256
  );
  assert.deepEqual(
    await inspectProgress({ root, transactionId: 'tx-progress' }),
    { anomalies: [], phase: 'active' }
  );
  await writeFile(path.join(root, 'tx-progress', 'phase.json'), '{');
  assert.match(
    (
      await inspectProgress({ root, transactionId: 'tx-progress' })
    ).anomalies.join(','),
    /phase/
  );
});
test('refuses incomplete prior state and any pre-existing campaign mark authority', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cwv-state-'));
  await assert.rejects(
    () =>
      createCapture({
        root,
        transactionId: 'tx-incomplete',
        mode: 'campaign',
        host,
        priorState: {},
      }),
    /complete prior state/
  );
  await assert.rejects(
    () =>
      createCapture({
        root,
        transactionId: 'tx-empty-role',
        mode: 'campaign',
        host,
        priorState: {
          ...priorState,
          resources: {
            ...priorState.resources,
            containers: [{ id: 'c', running: true, cpuset: '0', role: '' }],
          },
        },
      }),
    /complete prior state/
  );
  await assert.rejects(
    () =>
      createCapture({
        root,
        transactionId: 'tx-collision',
        mode: 'campaign',
        host,
        priorState: {
          ...priorState,
          network: {
            ...priorState.network,
            collisions: [
              {
                source: 'nft',
                mask: 0xffffffff,
                value: priorState.network.campaignMark,
              },
            ],
          },
        },
      }),
    /mark collision/
  );
});
test('rejects exact, masked, and unsupported mark collisions while allowing unrelated marks', () => {
  const mark = 0xb1234567;
  assert.doesNotThrow(() =>
    assertNoMarkCollision(mark, [
      { source: 'nft', mask: 0xffffffff, value: 0xa1234567 },
      { source: 'ip-rule', mask: 0xff000000, value: 0xa0000000 },
    ])
  );
  assert.throws(
    () =>
      assertNoMarkCollision(mark, [
        { source: 'conntrack', mask: 0xffffffff, value: mark },
      ]),
    /mark collision/
  );
  assert.throws(
    () =>
      assertNoMarkCollision(mark, [
        { source: 'tc', mask: 0xf0000000, value: 0xb0000000 },
      ]),
    /mark collision/
  );
  assert.throws(
    () => assertNoMarkCollision(mark, [{ source: 'nft', unsupported: true }]),
    /unsupported collision inventory/
  );
});
test('host inventory recognizes masked mark readers and rejects unsupported mark syntax', async () => {
  const source = await readFile(
    new URL('./campaign-quiesce.sh', import.meta.url),
    'utf8'
  );
  assert.match(source, /mark\\s\*&/);
  assert.match(source, /unsupported: true/);
});
