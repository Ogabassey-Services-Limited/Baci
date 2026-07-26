// biome-ignore-all format: compact integration fixtures stay within the source ceiling.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createRegistrationCaptureEvidence, deriveRegistrationCaptureAuthority } from './campaign-capture-authority.mjs';
import {
  campaignSourceClosure,
  campaignSourceDigest,
} from './campaign-source-closure.mjs';
import { createCapture, setPhase, sha256 } from './campaign-state.mjs';

const read = (name) => fs.readFile(new URL(name, import.meta.url), 'utf8');
const matches = (value, patterns) => {
  for (const pattern of patterns) assert.match(value, pattern);
};

test('restore reconciles capture state and watchdog handles timeout, reboot, and failure', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cwv-restore-'));
  const source = path.join(root, 'source');
  const stateRoot = path.join(root, 'campaigns');
  const bin = path.join(root, 'bin');
  const log = path.join(root, 'calls.log');
  const crontab = path.join(root, 'crontab');
  // biome-ignore format: keeps the integration fixture below the source ceiling.
  await Promise.all([source, stateRoot, bin, path.join(root, 'sealed')].map((dir) => fs.mkdir(dir)));
  await fs.chmod(stateRoot, 0o700);
  for (const name of campaignSourceClosure) {
    await fs.cp(new URL(`./${name}`, import.meta.url), path.join(source, name));
  }
  const policy = Object.fromEntries([
    ['/dedicatedRuntime/dockerSocket', path.join(root, 'missing.sock')],
    [
      '/dedicatedRuntime/containerdSocket',
      path.join(root, 'missing-containerd.sock'),
    ],
    ['/dedicatedRuntime/networkName', 'baci-cwv-net'],
    ['/dedicatedRuntime/bridgeName', 'baci-cwv0'],
    ['/dedicatedRuntime/dockerService', 'dedicated-docker.service'],
    ['/dedicatedRuntime/containerdService', 'dedicated-containerd.service'],
    ['/dedicatedRuntime/ownedInputChainPrefix', 'BACI_CWV_IN_'],
    ['/dedicatedRuntime/ownedForwardChainPrefix', 'BACI_CWV_FW_'],
    ['/dedicatedRuntime/ruleCommentPrefix', 'baci-cwv:'],
    ['/dedicatedRuntime/subnet', '172.31.255.0/28'],
    ['/networkAccounting/family', 'inet'],
    ['/networkAccounting/table', 'baci_cwv_measurement'],
    ['/host/adminAccount', 'bassey'],
  ]);
  await fs.writeFile(
    path.join(source, 'policy.schema.mjs'),
    `export const parseRunnerPolicy=(value)=>value;const p=${JSON.stringify(policy)};if(process.argv[1]===new URL(import.meta.url).pathname){if(process.argv[2]!=='get'||!(process.argv[3] in p))process.exit(1);process.stdout.write(p[process.argv[3]]);}\n`
  );
  const policyBytes = `${JSON.stringify({ schemaVersion: 1 })}\n`;
  await fs.writeFile(path.join(source, 'policy.json'), policyBytes);
  await fs.writeFile(
    path.join(root, 'sealed/policy.sha256'),
    `${sha256(policyBytes)}\n`
  );
  const makeStub = async (name, body) => {
    const file = path.join(bin, name);
    await fs.writeFile(
      file,
      `#!/bin/sh\nset -eu\nprintf '%s\\n' '${name} '"$*" >>'${log}'\n${body}\n`
    );
    await fs.chmod(file, 0o755);
    return file;
  };
  const positionals = [
    'case "$',
    '{1:-}:$',
    '{2:-}:$',
    '{3:-}:$',
    '{4:-}" in ',
  ].join('');
  const systemctl = await makeStub(
    'systemctl',
    `${positionals}show:system.slice:-p:*) printf "0-3\\n";; show:dedicated-*:-p:MainPID) printf "0\\n";; show:dedicated-*:-p:ControlGroup) printf "/cwv-test\\n";; is-active:--quiet:baci-cwv-host-sampler.timer:*|is-active:--quiet:dedicated-*:*|is-enabled:--quiet:apt.timer:*) exit 3;; esac`
  );
  const docker = await makeStub(
    'docker',
    ['[ "$', '{1:-}" != inspect ] || printf "0-3 true\\n"'].join('')
  );
  const tools = {
    nft: await makeStub('nft', 'exit 1'),
    iptables: await makeStub('iptables', ':'),
    iptablesSave: await makeStub('iptables-save', ':'),
    ip: await makeStub('ip', 'exit 1'),
    date: await makeStub(
      'date',
      'case "$*" in "-u +%s") printf "0\\n";; *) printf "4070908800\\n";; esac'
    ),
    flock: await makeStub('flock', 'exit 0'),
    id: await makeStub(
      'id',
      ['[ "$', '{1:-}" = -u ] && printf "0\\n"'].join('')
    ),
    stat: await makeStub(
      'stat',
      'case "$*" in *restored.json|*watchdog-ready.json|*lease-holder.json|*lease-release.json) printf "0:600\\n";; *) printf "0:700\\n";; esac'
    ),
    cron: await makeStub(
      'crontab',
      `if [ "$*" = '-u bassey -l' ]; then cat '${crontab}'; else cp "$3" '${crontab}'; fi`
    ),
    sha256sum: await makeStub('sha256sum', `exec '${process.execPath}' -e 'const c=require("node:crypto"),f=require("node:fs"),a=process.argv.slice(1),p=(v,n)=>process.stdout.write(c.createHash("sha256").update(v).digest("hex")+"  "+n+"\\n");if(a.length)for(const n of a)p(f.readFileSync(n),n);else p(f.readFileSync(0),"-");' "$@"`),
    sleep: await makeStub(
      'sleep',
      `for release in '${stateRoot}'/*/lease-release.json; do [ -e "$release" ] || continue; /bin/rm -f -- "$(/usr/bin/dirname "$release")/lease-holder.json"; done`
    ),
  };
  const archive = 'MAILTO=""\n*/5 * * * * /opt/maintain\n';
  await fs.writeFile(crontab, archive);
  const cronSha = sha256(archive);
  // biome-ignore format: keeps the integration fixture below the source ceiling.
  const inventoryKeys = 'nftables iptables ip6tables ipRules4 ipRules6 tc conntrack addresses routes dockerNetworks'.split(' ');
  const registrationAddresses = Buffer.from(JSON.stringify([{ addr_info: [{ family: 'inet', local: '82.29.190.219' }] }]));
  const registrationDockerNetworks = Buffer.from(JSON.stringify([{ IPAM: { Config: [{ Subnet: '172.18.0.0/16' }] } }]));
  const registrationServices = [{ uid: 2, unit: 'baci.service' }];
  // biome-ignore format: keeps the integration fixture below the source ceiling.
  const registrationAuthorityEvidence = createRegistrationCaptureEvidence({ addresses: registrationAddresses, dockerNetworks: registrationDockerNetworks, services: registrationServices });
  // biome-ignore format: keeps the integration fixture below the source ceiling.
  const registrationAuthority = deriveRegistrationCaptureAuthority({ addresses: registrationAddresses, dockerNetworks: registrationDockerNetworks, externalInterface: { ifindex: 2, name: 'eth0' }, services: registrationServices });
  // biome-ignore format: keeps the integration fixture below the source ceiling.
  const inventories = Object.fromEntries(inventoryKeys.map((key) => [key, 'b'.repeat(64)]));
  inventories.addresses = sha256(registrationAddresses);
  inventories.dockerNetworks = sha256(registrationDockerNetworks);
  const priorState = JSON.parse(
    `{"schemaVersion":1,"cron":{"sha256":"${cronSha}","archiveSha256":"${cronSha}","archivePath":"/unused","serviceActive":true,"serviceEnabled":true},"resources":{"runners":[{"id":"runner.service","active":true,"runnerRoot":"/runner"}],"timers":[{"id":"apt.timer","active":true,"enabled":false}],"containers":[{"id":"container-a","running":true,"cpuset":"0-3","role":"application"}],"slices":[{"id":"system.slice","allowedCpus":"0-3"}]},"network":{"ipForward":1,"campaignMark":2971886951,"collisions":[],"accountingTablePresent":false,"baselineSha256":"${'a'.repeat(64)}","externalInterface":{"name":"eth0","ifindex":2},"inventories":${JSON.stringify(inventories)}}}`
  );
  const replacements = new Map([
    ['/srv/baci-cwv/campaigns', stateRoot],
    ['/usr/bin/node', process.execPath],
    ['/usr/bin/sha256sum', `/bin/sh ${tools.sha256sum}`],
    ['/usr/bin/sync', '/bin/sync'],
    ['/bin/systemctl', `/bin/sh ${systemctl}`],
    ['/usr/bin/docker', `/bin/sh ${docker}`],
    ['/usr/sbin/nft', `/bin/sh ${tools.nft}`],
    ['/usr/sbin/iptables-save', `/bin/sh ${tools.iptablesSave}`],
    ['/usr/sbin/iptables', `/bin/sh ${tools.iptables}`],
    ['/usr/sbin/ip', `/bin/sh ${tools.ip}`],
    ['/usr/bin/crontab', `/bin/sh ${tools.cron}`],
    ['/usr/bin/id', `/bin/sh ${tools.id}`],
    ['/usr/bin/stat', `/bin/sh ${tools.stat}`],
    ['/usr/bin/flock', `/bin/sh ${tools.flock}`],
    ['/bin/sleep', `/bin/sh ${tools.sleep}`],
    ['/bin/date', `/bin/sh ${tools.date}`],
    ['/proc/sys/net/ipv4/ip_forward', path.join(root, 'ip_forward')],
    ['/sys/fs/cgroup', path.join(root, 'cgroup')],
    ['/proc/$holder_pid', path.join(root, 'holder')],
  ]);
  const transform = async (name) => {
    let value = await read(`./${name}`);
    for (const [from, to] of replacements) value = value.replaceAll(from, to);
    return value.replaceAll('/bin/mv -T', '/bin/mv');
  };
  await fs.mkdir(path.join(root, 'cgroup/cwv-test'), { recursive: true });
  await Promise.all([
    fs.writeFile(path.join(root, 'ip_forward'), '1\n'),
    fs.writeFile(path.join(root, 'boot_id'), 'boot-a\n'),
    fs.writeFile(path.join(root, 'uptime'), '10.00 10.00\n'),
    fs.writeFile(path.join(root, 'cgroup/cwv-test/cgroup.procs'), ''),
  ]);
  const restore = path.join(source, 'campaign-restore.sh');
  await fs.writeFile(restore, await transform('campaign-restore.sh'));
  await fs.writeFile(path.join(source, 'campaign-restore-post-commit.sh'), await transform('campaign-restore-post-commit.sh'));
  await fs.chmod(restore, 0o755);
  const watchdogPath = path.join(source, 'campaign-watchdog.sh');
  const watchdogBody = (await transform('campaign-watchdog.sh'))
    .replaceAll('/proc/sys/kernel/random/boot_id', path.join(root, 'boot_id'))
    .replaceAll('/proc/uptime', path.join(root, 'uptime'))
    .replaceAll(
      '"/proc/$lease_holder_pid/stat"',
      `"${path.join(root, 'holder/stat')}"`
    )
    .replaceAll('"/proc/$lease_holder_pid"', `"${path.join(root, 'holder')}"`)
    .replaceAll(
      '"$RESTORE" "$transaction_id" "$capture_sha"',
      '/bin/sh "$RESTORE" "$transaction_id" "$capture_sha"'
    );
  assert.match(await read('./campaign-watchdog.sh'), /\/usr\/bin\/sha256sum/, 'RED: production watchdog keeps its fixed checksum path');
  assert.doesNotMatch(watchdogBody, /\/(?:usr|sbin)\/sha256sum/, 'GREEN: fixture injects a portable checksum command');
  await fs.writeFile(watchdogPath, watchdogBody);
  const sourceDigest = await campaignSourceDigest(source);
  const createTransaction = async (id, deadline = '999999999') => {
    const capture = await createCapture({
      root: stateRoot,
      transactionId: id,
      mode: 'registration',
      host: { bootId: 'boot-a', hostname: 'host' },
      registrationAuthority,
      registrationAuthorityEvidence,
      priorState: {
        ...priorState,
        cron: {
          ...priorState.cron,
          archivePath: `${stateRoot}/${id}/crontab.before`,
        },
      },
    });
    await fs.writeFile(`${stateRoot}/${id}/crontab.before`, archive);
    await fs.mkdir(path.join(root, 'holder'), { recursive: true });
    await fs.writeFile(
      path.join(root, 'holder/stat'),
      '9 (holder) S 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 123\n'
    );
    const holderPid = 9;
    const holderStartTime = 123;
    const token = 'c'.repeat(64);
    await fs.writeFile(
      `${stateRoot}/${id}/lease-holder.json`,
      JSON.stringify({
        captureSha256: capture.sha256,
        holderPid,
        holderStartTime,
        lockDevice: 1,
        lockHeld: true,
        lockInode: 2,
        mode: 'registration',
        schemaVersion: 1,
        token,
        transactionId: id,
      })
    );
    await fs.chmod(`${stateRoot}/${id}/lease-holder.json`, 0o600);
    await fs.writeFile(
      `${stateRoot}/${id}/watchdog.env`,
      `TRANSACTION_ID=${id}\nMODE=registration\nCAPTURE_SHA=${capture.sha256}\nSOURCE_DIGEST=${sourceDigest}\nCREATION_BOOT_ID=boot-a\nUTC_DEADLINE=2099-01-01T00:00:00Z\nMONOTONIC_DEADLINE=${deadline}\n`
    );
    await setPhase({ root: stateRoot, transactionId: id, phase: 'active' });
    return capture;
  };

  const capture = await createTransaction('tx');
  const result = spawnSync('/bin/sh', [restore, 'tx', capture.sha256], {
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const calls = await fs.readFile(log, 'utf8');
  assert.ok(
    calls.indexOf(
      'systemctl set-property --runtime system.slice AllowedCPUs=0-3'
    ) < calls.indexOf('docker update --cpuset-cpus 0-3 container-a')
  );
  matches(calls, [
    /systemctl start runner\.service/,
    /systemctl enable cron\.service/,
  ]);
  assert.equal(await fs.readFile(crontab, 'utf8'), archive);
  const receipt = JSON.parse(
    await fs.readFile(`${stateRoot}/tx/restored.json`, 'utf8')
  );
  assert.equal(receipt.reconciled, true);
  assert.equal(receipt.policyFileSha256, sha256(policyBytes));
  assert.equal(receipt.sourceDigest, sourceDigest);
  assert.deepEqual(receipt.residualState, {
    accountingTablePresent: false,
    cronSha256: cronSha,
    dedicatedNetworkPresent: false,
    dedicatedServicesActive: false,
    ownedFirewallPresent: false,
    samplerActive: false,
    transactionContainerCount: 0,
  });
  assert.equal(
    spawnSync('/bin/sh', [restore, 'tx', capture.sha256]).status,
    73
  );
  assert.equal(spawnSync('/bin/sh', [watchdogPath, 'tx']).status, 0);

  await createTransaction('tx-timeout', '1');
  assert.equal(spawnSync('/bin/sh', [watchdogPath, 'tx-timeout']).status, 0);
  assert.equal(
    JSON.parse(await fs.readFile(`${stateRoot}/tx-timeout/restored.json`))
      .reconciled,
    true
  );
  await createTransaction('tx-reboot');
  await fs.writeFile(path.join(root, 'boot_id'), 'boot-b\n');
  assert.equal(spawnSync('/bin/sh', [watchdogPath, 'tx-reboot']).status, 0);
  assert.equal(
    JSON.parse(await fs.readFile(`${stateRoot}/tx-reboot/restored.json`))
      .reconciled,
    true
  );

  const failure = await createTransaction('tx-failure');
  await makeStub('systemctl', ':');
  assert.equal(
    spawnSync('/bin/sh', [restore, 'tx-failure', failure.sha256]).status,
    1
  );
  assert.equal(
    JSON.parse(await fs.readFile(`${stateRoot}/tx-failure/restore-failed.json`))
      .reconciled,
    false
  );
  await assert.rejects(fs.readFile(`${stateRoot}/tx-failure/restored.json`));
});
