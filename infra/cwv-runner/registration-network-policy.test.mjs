import assert from 'node:assert/strict';
import test from 'node:test';
import { registrationNetworkAuthority } from './registration-network-authority.fixture.mjs';
import { firewallPolicy, policyRows } from './registration-network-policy.mjs';

test('derives a closed egress policy from captured destinations and external interface', () => {
  const policy = firewallPolicy({
    forward: 'BCWV-R-TEST',
    input: 'BCWV-I-TEST',
    networkAuthority: registrationNetworkAuthority,
  });
  const forward = policyRows('BCWV-R-TEST', policy.forward).join('\n');
  assert.match(
    forward,
    /^-A BCWV-R-TEST -i baci-cwv0 ! -s 172\.31\.255\.0\/28 -j REJECT/m
  );
  assert.match(forward, /-d 172\.31\.255\.1\/32 -j REJECT/);
  assert.match(forward, /-d 172\.18\.0\.0\/16 -j REJECT/);
  assert.match(
    forward,
    /-i eth0 -o baci-cwv0 -d 172\.31\.255\.0\/28 -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT/
  );
  assert.match(
    forward,
    /-i baci-cwv0 -s 172\.31\.255\.0\/28 -o eth0 -p udp --dport 53 -j ACCEPT/
  );
  assert.ok(
    forward.indexOf('--dport 53 -j ACCEPT') <
      forward.indexOf('--dport 443 -j ACCEPT')
  );
  assert.match(forward, /-i baci-cwv0 -j REJECT$/m);
});
