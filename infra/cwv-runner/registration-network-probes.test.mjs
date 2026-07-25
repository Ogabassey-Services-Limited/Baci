import assert from 'node:assert/strict';
import test from 'node:test';
import { registrationNetworkAuthority } from './registration-network-authority.fixture.mjs';
import { createNetworkProbes } from './registration-network-probes.mjs';

test('keeps the DNS answer extractor as a literal awk program inside the probe shell', async () => {
  let command;
  const probes = createNetworkProbes({
    campaign: 'campaign-01',
    docker: (...args) => {
      command = args.at(-1);
      return Promise.resolve('dns-tls-sni-ok\n');
    },
    fail: () => assert.fail('probe refused'),
    image: `sha256:${'a'.repeat(64)}`,
    network: 'baci-cwv-net',
    networkAuthority: registrationNetworkAuthority,
  });
  await probes.probePublicTls();
  assert.equal(
    command,
    `answers=$(/usr/bin/getent ahostsv4 api.github.com | /usr/bin/awk '{print $1}' | /usr/bin/sort -u); [ -n "$answers" ]; for address in $answers; do case $address in 127.*|10.*|172.16.*|172.17.*|172.18.*|172.19.*|172.2[0-9].*|172.3[0-1].*|192.168.*|169.254.*) exit 1;; esac; /usr/bin/curl --fail --silent --show-error --proto =https --tlsv1.2 --connect-timeout 5 --max-time 15 --resolve api.github.com:443:$address https://api.github.com/meta >/dev/null; done; for denied in http://172.31.255.1 http://127.0.0.1 http://10.0.0.1 http://192.168.0.1; do if /usr/bin/curl --fail --silent --show-error --connect-timeout 1 --max-time 2 $denied >/dev/null 2>&1; then exit 1; fi; done; printf "%s\\n" dns-tls-sni-ok`
  );
});

test('proves every captured non-root identity, including bassey, cannot read an environment', async () => {
  const commands = [];
  const probes = createNetworkProbes({
    campaign: 'campaign-01',
    docker: (...args) => {
      commands.push(args);
      return Promise.resolve(
        args.includes('--detach')
          ? `${'a'.repeat(64)}\n`
          : 'cross-uid-environ-denied\n'
      );
    },
    fail: () => assert.fail('probe refused'),
    image: `sha256:${'a'.repeat(64)}`,
    network: 'baci-cwv-net',
    networkAuthority: registrationNetworkAuthority,
  });
  await probes.probeCrossUid();
  const commandsByUid = commands
    .map((argv) => argv.join(' '))
    .filter((argv) => argv.includes('--pid=container:'));
  for (const uid of registrationNetworkAuthority.nonrootServiceUids)
    assert.equal(
      commandsByUid.some((argv) => argv.includes(`--user=${uid}:${uid}`)),
      true
    );
  assert.equal(
    commandsByUid.some((argv) => argv.includes('/bin/cat /proc/1/environ')),
    false
  );
  assert.equal(
    commandsByUid.every((argv) => argv.includes('test ! -r /proc/1/environ')),
    true
  );
});
