import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = () =>
  readFile(new URL('./host-idle-check.sh', import.meta.url), 'utf8');

function liveIdentityFilter(shell) {
  const match =
    /\/usr\/bin\/jq -e --arg campaign "\$campaign_id" '\n([\s\S]*?)' "\$directory\/runtime-identity\.json" >"\$target"/.exec(
      shell
    );
  assert.ok(match, 'live runtime identity jq filter is present');
  return match[1];
}

test('live runtime identity jq filter preserves its validated object', async () => {
  const identity = {
    campaignId: 'campaign-01',
    campaignMark: 1,
    externalIfindex: 2,
    externalInterface: 'eth0',
    generation: 1,
    runnerContainerId: 'a'.repeat(64),
    runnerIp: '172.31.0.2',
    runnerPeerIfindex: 3,
    runnerVeth: 'veth0',
  };
  const result = spawnSync(
    '/usr/bin/jq',
    [
      '-e',
      '--arg',
      'campaign',
      identity.campaignId,
      liveIdentityFilter(await source()),
    ],
    { encoding: 'utf8', input: JSON.stringify(identity) }
  );

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), identity);
});
