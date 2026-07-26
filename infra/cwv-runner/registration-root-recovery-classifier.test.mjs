import assert from 'node:assert/strict';
import test from 'node:test';

import { observedAuthority } from './controller-contract.fixture.mjs';
import { classifyRegistrationRecoveryContainer } from './registration-root-recovery-classifier.mjs';

const configuration = {
  context: {
    imageDigest: `sha256:${'b'.repeat(64)}`,
    registrationNonce: 'c'.repeat(32),
  },
};
const context = { containerId: observedAuthority.containerId };
const prefix = ['--host=unix:///run/baci-cwv/docker.sock'];
const identity = `${context.containerId} /baci-cwv-registration-${configuration.context.registrationNonce} ${configuration.context.imageDigest}\n`;

test('classifies only empty or exact-ID dedicated-socket output', async () => {
  const absent = await classifyRegistrationRecoveryContainer(
    async () => '',
    prefix,
    context,
    configuration
  );
  assert.deepEqual(absent, { present: false });
  const calls = [];
  const present = await classifyRegistrationRecoveryContainer(
    (_file, argv) => {
      calls.push(argv);
      return argv.includes('ps') ? `${context.containerId}\n` : identity;
    },
    prefix,
    context,
    configuration
  );
  assert.deepEqual(present, { present: true });
  assert.deepEqual(calls[0], [
    ...prefix,
    'ps',
    '-a',
    '--no-trunc',
    '--filter',
    `id=${context.containerId}`,
    '--format',
    '{{.ID}}',
  ]);
});

test('fails closed for ambiguous output, command failures, and identity drift', async () => {
  for (const result of [
    `${context.containerId}\n${context.containerId}\n`,
    `${'f'.repeat(64)}\n`,
  ])
    await assert.rejects(
      classifyRegistrationRecoveryContainer(
        async () => result,
        prefix,
        context,
        configuration
      ),
      /recovery classifier refused/
    );
  await assert.rejects(
    classifyRegistrationRecoveryContainer(
      () => {
        throw new Error('docker failed');
      },
      prefix,
      context,
      configuration
    ),
    /docker failed/
  );
  await assert.rejects(
    classifyRegistrationRecoveryContainer(
      async (_file, argv) =>
        argv.includes('ps')
          ? `${context.containerId}\n`
          : `${context.containerId} /wrong ${configuration.context.imageDigest}\n`,
      prefix,
      context,
      configuration
    ),
    /recovery classifier refused/
  );
});
