import assert from 'node:assert/strict';
import test from 'node:test';
import {
  finalizeRegistrationCommand,
  prepareRegistrationCommand,
} from './registration-command-prepare.mjs';
import { createRegistrationCommandPreparationFixture } from './registration-command-prepare-fixture.mjs';

const { authority, beginDependencies, canonical, command, sha256 } =
  createRegistrationCommandPreparationFixture();
test('begin persists fresh authority before sealed quiesce and atomically publishes schema v2', async () => {
  const events = [];
  const result = await prepareRegistrationCommand(
    'begin',
    beginDependencies(events)
  );
  assert.deepEqual(result, command);
  assert.deepEqual(
    events.map(([name]) => name),
    ['persist', 'quiesce', 'publish']
  );
  assert.deepEqual(events[1][1], {
    campaignId: authority.campaignId,
    mode: 'registration',
  });
  assert.deepEqual(events[2][1], canonical(command));
});
test('begin resumes a persisted authority before active command publication without new randomness', async () => {
  const events = [];
  const result = await prepareRegistrationCommand(
    'begin',
    beginDependencies(events, {
      createAuthority: () => {
        throw new Error('must not generate authority');
      },
      persistCampaignAuthority: () => {
        throw new Error('must not persist again');
      },
      readPersistedAuthority: async () => canonical(authority),
    })
  );
  assert.deepEqual(result, command);
  assert.deepEqual(
    events.map(([name]) => name),
    ['quiesce', 'publish']
  );
});
test('begin refuses when persisted authority no longer matches the campaign', async () => {
  const other = { ...authority, registrationNonce: '4'.repeat(32) };
  await assert.rejects(
    prepareRegistrationCommand(
      'begin',
      beginDependencies([], {
        createAuthority: () => {
          throw new Error('must not generate authority');
        },
        readCampaign: async () => canonical(other),
        readPersistedAuthority: async () => canonical(authority),
      })
    ),
    /campaign authority drift/
  );
});
test('begin rejects watchdog receipts that do not bind the canonical capture', async () => {
  const events = [];
  await assert.rejects(
    prepareRegistrationCommand(
      'begin',
      beginDependencies(events, {
        readWatchdog: async () =>
          canonical({
            captureSha256: '0'.repeat(64),
            lockHeld: true,
            mode: 'registration',
            transactionId: authority.campaignId,
          }),
      })
    ),
    /watchdog captureSha256 mismatch/
  );
  assert.deepEqual(
    events.map(([name]) => name),
    ['persist', 'quiesce']
  );
});
test('begin reports capture authority fields that the current campaign capture lacks', async () => {
  const events = [];
  const legacyCapture = Buffer.from(
    `${canonical({ schemaVersion: 1, transactionId: authority.campaignId })}\n`
  );
  await assert.rejects(
    prepareRegistrationCommand(
      'begin',
      beginDependencies(events, {
        readCapture: async () => legacyCapture,
      })
    ),
    /capture missing required authority: expectedEgressPlan, externalIfindex, externalInterface, hostIpv4Addresses, nonrootServiceUids, productionDockerSubnets/
  );
  assert.deepEqual(
    events.map(([name]) => name),
    ['persist', 'quiesce']
  );
});
test('recovery reuses the persisted command without creating new authority', async () => {
  const events = [];
  const result = await prepareRegistrationCommand('recover', {
    readCampaign: async () => canonical(authority),
    readCommand: async () => canonical(command),
    readExistingCommand: async () => undefined,
    readRetryBlock: async () => undefined,
    reconcileCommand: async (value) => events.push(value),
  });
  assert.deepEqual(result, command);
  assert.equal(events.length, 1);
  assert.equal(events[0].command.context.campaignId, authority.campaignId);
});
test('refuses a retry block before begin can create authority or recover can reconcile', async () => {
  const block = {
    campaignId: authority.campaignId,
    cleanupSha256: '4'.repeat(64),
    commandSha256: '5'.repeat(64),
    disposition: 'owner-row-deletion-required',
    egressReleaseSha256: '6'.repeat(64),
    schemaVersion: 1,
  };
  const events = [];
  await assert.rejects(
    prepareRegistrationCommand(
      'begin',
      beginDependencies(events, { readRetryBlock: async () => block })
    ),
    /owner row deletion required/
  );
  await assert.rejects(
    prepareRegistrationCommand('recover', {
      readCampaign: async () => canonical(authority),
      readCommand: async () => canonical(command),
      readRetryBlock: async () => block,
      reconcileCommand: async () => events.push('reconcile'),
    }),
    /owner row deletion required/
  );
  assert.deepEqual(events, []);
});
test('recovers a post-egress crash by publishing and rereading the block before archive', async () => {
  const bytes = canonical(command);
  const block = {
    campaignId: authority.campaignId,
    cleanupSha256: '4'.repeat(64),
    commandSha256: sha256(bytes),
    disposition: 'owner-row-deletion-required',
    egressReleaseSha256: '6'.repeat(64),
    schemaVersion: 1,
  };
  const events = [];
  let persistedBlock;
  const dependencies = {
    archiveCommand: async () => events.push('archive'),
    publishRetryBlock: (value) => {
      events.push('publish');
      persistedBlock = value;
      return value;
    },
    readCampaign: async () => canonical(authority),
    readCommand: async () => bytes,
    readPostEgressRecovery: async () => canonical(block),
    readRetryBlock: async () => persistedBlock,
    reconcileCommand: async () => events.push('reconcile'),
  };
  await assert.rejects(
    prepareRegistrationCommand('recover', dependencies),
    /owner row deletion required/
  );
  assert.deepEqual(events, ['publish', 'archive']);
  await assert.rejects(
    prepareRegistrationCommand('recover', dependencies),
    /owner row deletion required/
  );
  assert.deepEqual(events, ['publish', 'archive']);
});
test('does not archive or retry when a restart finds a block before archive', async () => {
  const bytes = canonical(command);
  const block = {
    campaignId: authority.campaignId,
    cleanupSha256: '4'.repeat(64),
    commandSha256: sha256(bytes),
    disposition: 'owner-row-deletion-required',
    egressReleaseSha256: '6'.repeat(64),
    schemaVersion: 1,
  };
  const events = [];
  await assert.rejects(
    prepareRegistrationCommand('recover', {
      archiveCommand: async () => events.push('archive'),
      readCampaign: async () => canonical(authority),
      readCommand: async () => bytes,
      readPostEgressRecovery: async () => canonical(block),
      readRetryBlock: async () => block,
      reconcileCommand: async () => events.push('reconcile'),
    }),
    /owner row deletion required/
  );
  assert.deepEqual(events, []);
});
test('begin recovers an active post-egress command before it can create another authority', async () => {
  const bytes = canonical(command);
  const block = {
    campaignId: authority.campaignId,
    cleanupSha256: '4'.repeat(64),
    commandSha256: sha256(bytes),
    disposition: 'owner-row-deletion-required',
    egressReleaseSha256: '6'.repeat(64),
    schemaVersion: 1,
  };
  const events = [];
  let persistedBlock;
  await assert.rejects(
    prepareRegistrationCommand('begin', {
      archiveCommand: async () => events.push('archive'),
      createAuthority: () => events.push('create-authority'),
      publishRetryBlock: (value) => {
        persistedBlock = value;
        return value;
      },
      readCampaign: async () => canonical(authority),
      readCommand: async () => bytes,
      readExistingCommand: async () => bytes,
      readPostEgressRecovery: async () => canonical(block),
      readRetryBlock: async () => persistedBlock,
      reconcileCommand: async () => events.push('reconcile'),
    }),
    /owner row deletion required/
  );
  assert.deepEqual(events, ['archive']);
});
test('finalize binds the active command digest to its campaign receipt before archiving', async () => {
  const events = [];
  const bytes = canonical(command);
  const receipt = {
    campaignId: authority.campaignId,
    cleanupSha256: '4'.repeat(64),
    commandSha256: sha256(bytes),
    disposition: 'registered',
    schemaVersion: 1,
  };
  const result = await finalizeRegistrationCommand({
    archiveCommand: async (value) => events.push(value),
    readCampaign: async () => canonical(authority),
    readCommand: async () => bytes,
    readFinalization: async () => canonical(receipt),
  });

  assert.deepEqual(result, receipt);
  assert.equal(events.length, 1);
  assert.equal(events[0].receipt.commandSha256, sha256(bytes));
});
