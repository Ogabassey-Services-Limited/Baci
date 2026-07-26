import assert from 'node:assert/strict';
import test from 'node:test';

import { stopRegistrationDaemons } from './registration-root-terminal-cleanup.mjs';

test('classifies stopped and absent daemons from keyed systemd properties in any order', async () => {
  const calls = [];
  const execute = (file, argv) => {
    calls.push([file, argv]);
    if (argv[0] === 'stop') return '';
    if (argv[1] === 'baci-cwv-containerd.service')
      return 'LoadState=loaded\nActiveState=inactive\n';
    return 'ActiveState=inactive\nLoadState=not-found\n';
  };

  const receipt = await stopRegistrationDaemons(execute);

  assert.deepEqual(receipt, {
    containerd: 'stopped',
    docker: 'absent',
    schemaVersion: 1,
  });
  assert.equal(
    calls
      .filter(([, argv]) => argv[0] === 'show')
      .every(([, argv]) => !argv.includes('--value')),
    true
  );
});

test('rejects active, malformed, duplicate, or incomplete daemon state', async () => {
  for (const output of [
    'LoadState=loaded\nActiveState=active\n',
    'LoadState=loaded\nActiveState=inactive\nActiveState=inactive\n',
    'LoadState=loaded\n',
    'loaded\ninactive\n',
  ]) {
    const execute = (_file, argv) => (argv[0] === 'stop' ? '' : output);

    await assert.rejects(
      stopRegistrationDaemons(execute),
      /registration cleanup refused/
    );
  }
});
