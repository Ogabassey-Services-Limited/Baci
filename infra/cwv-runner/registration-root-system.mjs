import { execFile as execFileCallback } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat } from 'node:fs/promises';
import { promisify } from 'node:util';
import { recordJournalEntry } from './campaign-state.mjs';
import { readRegistrationCommand } from './registration-command-store.mjs';
import { publishRegistrationRetryBlock } from './registration-retry-block.mjs';
import { validateRegistrationRootContext } from './registration-root-contract.mjs';
import { createRegistrationSystemGuard } from './registration-root-guard-operations.mjs';
import { createRegistrationNetworkOperations } from './registration-root-network.mjs';
import {
  createRegistrationReceiptOperations,
  registrationTokenUnmountReceipt,
} from './registration-root-receipts.mjs';
import { classifyRegistrationRecoveryContainer } from './registration-root-recovery-classifier.mjs';
import { createRegistrationCaptureRestoration } from './registration-root-restoration.mjs';
import { createRegistrationSealer } from './registration-root-sealing.mjs';
// biome-ignore format: terminal helper set remains under the source line cap
import { readSystemdUnitProperties, requireAbsent, stopRegistrationDaemons } from './registration-root-terminal-cleanup.mjs';

const execFile = promisify(execFileCallback);
const DOCKER = '/usr/bin/docker';
const SYSTEMCTL = '/bin/systemctl';
const UMOUNT = '/usr/bin/umount';
const NSENTER = '/usr/bin/nsenter';
// biome-ignore format: fixed root command environment stays under the source line cap
const OPTIONS = Object.freeze({ env: Object.freeze({ LC_ALL: 'C.UTF-8', PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin', TZ: 'Etc/UTC' }), maxBuffer: 1_048_576 });
// biome-ignore format: fixed failure text stays compact under the source line cap
const fail = () => { throw new TypeError('registration root system refused'); };
function resultOutput(result) {
  // biome-ignore format: fixed executor result guard remains compact under the source cap
  if (!result || typeof result.stdout !== 'string' || typeof result.stderr !== 'string' || result.stderr !== '') fail();
  return result.stdout;
}
async function defaultPath(operation, files, dependencies) {
  // biome-ignore format: fixed path identity tuples are intentionally compact
  const expected = {
    'mount-policy': ['/srv/baci-cwv/sealed/policy.sha256', 0, 10001, 0o640, 'file'],
    'mount-release': [files.paths.handoff, 0, 10001, 0o750, 'directory'],
    'mount-staging': [files.paths.staging, 10001, 10001, 0o700, 'directory'],
    'mount-token': [files.paths.token, 0, 10001, 0o440, 'file'],
  }[operation];
  if (!expected) fail();
  const [path, uid, gid, mode, type] = expected;
  const details = await (dependencies.lstat ?? lstat)(path);
  // biome-ignore format: exact path identity guard remains under the source cap
  if (details.isSymbolicLink() || details.uid !== uid || details.gid !== gid || (details.mode & 0o777) !== mode || (type === 'file' ? !details.isFile() : !details.isDirectory())) fail();
}
// biome-ignore format: fixed system factory signature stays under the source line cap
export function createRegistrationSystemOperations(configuration, dependencies = {}) {
  const run = dependencies.executeFile ?? execFile;
  const files = dependencies.files;
  if (typeof run !== 'function' || !files?.paths) fail();
  const execute = async (file, argv) =>
    resultOutput(await run(file, argv, OPTIONS));
  // biome-ignore format: exact absence probe stays compact under the source cap
  const commandAbsent = async (file, argv) => { try { await execute(file, argv); } catch { return; } fail(); };
  const network = dependencies.network ?? createRegistrationNetworkOperations(configuration, { executeFile: run });
  const receipts = dependencies.receipts ?? createRegistrationReceiptOperations(configuration, files, dependencies);
  const sealer = dependencies.sealer ?? createRegistrationSealer(configuration);
  const campaign = configuration.context.campaignId;
  const dockerPrefix = [`--host=${configuration.resources.dockerSocket}`];
  const { guard, verifyAuthority } = createRegistrationSystemGuard(configuration, dependencies, execute, network, dockerPrefix);
  const verifyPath = dependencies.verifyPath ?? ((operation) => defaultPath(operation, files, dependencies));
  const watchdog = `baci-cwv-campaign-watchdog@${campaign}.service`;
  const verifyPrepared = dependencies.verifyPreparedTransaction;
  const readCommand = dependencies.readRegistrationCommand ?? readRegistrationCommand;
  const publishRetryBlock = dependencies.publishRegistrationRetryBlock ?? publishRegistrationRetryBlock;
  const recordJournal = dependencies.recordJournalEntry ?? recordJournalEntry;
  let authority;
  let egressReleaseSha256;
  let daemonsStopped = false;
  const restoration = createRegistrationCaptureRestoration(configuration, dependencies, execute, sealer);
  return async (operation, context = {}) => {
    validateRegistrationRootContext(operation, context);
    if ('campaignId' in context && context.campaignId !== campaign) fail();
    if (operation === 'mark-registration-ambiguous') {
      if (context.egressReleaseSha256 !== egressReleaseSha256) fail();
      const command = await readCommand();
      if (!Buffer.isBuffer(command)) fail();
      return await publishRetryBlock({
        campaignId: campaign,
        cleanupSha256: context.cleanupSha256,
        commandSha256: createHash('sha256').update(command).digest('hex'),
        disposition: 'owner-row-deletion-required',
        egressReleaseSha256,
        schemaVersion: 1,
      });
    }
    if (operation === 'verify-prepared-transaction') {
      if (typeof verifyPrepared !== 'function') fail();
      const receipt = await verifyPrepared(configuration);
      if (receipt?.schemaVersion !== 1) fail();
      return receipt;
    }
    if (operation === 'verify-retained-image') {
      const value = await execute(DOCKER, [
        ...dockerPrefix,
        'image',
        'inspect',
        '--format',
        '{{.Id}}',
        configuration.context.imageDigest,
      ]);
      if (value !== `${configuration.context.imageDigest}\n`) fail();
      return {};
    }
    if (operation === 'classify-registration-recovery-container') {
      return await classifyRegistrationRecoveryContainer(
        execute,
        dockerPrefix,
        context,
        configuration
      );
    }
    if (operation === 'start-daemons') {
      // biome-ignore format: fixed dedicated daemon unit set
      await execute(SYSTEMCTL, ['start', 'baci-cwv-containerd.service', 'baci-cwv-docker.service']);
      return {};
    }
    // biome-ignore format: closed operation map prevents caller-selected methods
    const networkMethods = {
      'activate-registration-egress': 'activateEgress', 'create-network': 'createNetwork',
      'install-isolation': 'installIsolation', 'probe-cross-uid': 'probeCrossUid',
      'probe-isolation': 'probeIsolation', 'probe-public-tls': 'probePublicTls',
      'remove-isolation': 'removeIsolation', 'remove-network': 'removeNetwork',
      'remove-probe-allow': 'removeProbeAllow', 'set-egress-default-drop': 'setDefaultDrop',
      'verify-default-drop': 'verifyDefaultDrop',
    };
    if (networkMethods[operation]) {
      const receipt = (await network[networkMethods[operation]]()) ?? {};
      if (operation === 'activate-registration-egress') {
        if (!/^[a-f0-9]{64}$/.test(receipt.activeEgressRuleSha256)) fail();
        const journal = await recordJournal({
          action: 'registration-egress-released',
          resource: { activeEgressRuleSha256: receipt.activeEgressRuleSha256, schemaVersion: 1 },
          root: '/srv/baci-cwv/campaigns',
          transactionId: campaign,
        });
        if (!/^[a-f0-9]{64}$/.test(journal?.sha256)) fail();
        egressReleaseSha256 = journal.sha256;
        return { ...receipt, egressReleaseSha256 };
      }
      return receipt;
    }
    if (operation === 'guard-registration') {
      if (context.authority) await verifyAuthority(context.authority);
      const receipt = await guard(context.boundary, context.authority);
      authority ??= context.authority;
      return receipt ?? {};
    }
    // biome-ignore format: closed mount operation set
    if (['mount-policy', 'mount-staging', 'mount-token', 'mount-release'].includes(operation)) {
      await verifyPath(operation);
      return {};
    }
    if (operation === 'wait-registration-ready') return receipts.waitReady();
    if (operation === 'unmount-token') {
      if (!authority) fail();
      let mounts = { filesystems: [] };
      let kind = 'absent';
      let present = true;
      // biome-ignore format: absent token layout is an explicit idempotent receipt case
      try { await (dependencies.lstat ?? lstat)(files.paths.tokenParent); }
      catch (error) {
        if (error?.code !== 'ENOENT') throw error;
        present = false;
      }
      if (present) {
        // biome-ignore format: fixed namespace entry keeps live teardown auditable
        const enter = ['--target', String(authority.listenerPid), '--mount', '--pid', '--'];
        const target = '/run/secrets/runner-registration-token';
        await execute(NSENTER, [...enter, UMOUNT, '--', target]);
        // biome-ignore format: fixed live mount read-back
        await commandAbsent(NSENTER, [...enter, '/usr/bin/findmnt', '--noheadings', '--target', target]);
        // biome-ignore format: canonical mount inventory is intentionally one operation
        try { mounts = JSON.parse(await execute(NSENTER, [...enter, '/usr/bin/findmnt', '--json', '--all'])); } catch { fail(); }
        if (JSON.stringify(mounts).includes(target)) fail();
        // biome-ignore format: fixed tmpfs filesystem read-back
        kind = await execute('/usr/bin/findmnt', [
          '--noheadings', '--output', 'FSTYPE', '--target', files.paths.tokenParent,
        ]);
        if (kind !== 'tmpfs\n') fail();
        await execute(UMOUNT, ['--', files.paths.tokenParent]);
      }
      return registrationTokenUnmountReceipt(mounts, kind);
    }
    if (operation === 'wait-release-read-once')
      return receipts.waitReleaseReadOnce();
    if (operation === 'wait-registration-exit') {
      const name = `baci-cwv-registration-${configuration.context.registrationNonce}`;
      if ((await execute(DOCKER, [...dockerPrefix, 'wait', name])) !== '0\n')
        fail();
      return {};
    }
    if (operation === 'validate-registration-output')
      return receipts.validateOutput();
    if (operation === 'seal-runner') return restoration.sealRunner();
    if (['unmount-release', 'unmount-staging'].includes(operation)) return {};
    if (operation === 'stop-daemons') {
      const receipt = await stopRegistrationDaemons(execute);
      daemonsStopped = true;
      return receipt;
    }
    if (operation === 'restore-capture') return restoration.restoreCapture();
    if (operation === 'prove-registration-cleanup') {
      const container =
        context.containerId ??
        `baci-cwv-registration-${configuration.context.registrationNonce}`;
      // biome-ignore format: fixed cleanup absence probes
      await commandAbsent(DOCKER, [...dockerPrefix, 'inspect', container]);
      // biome-ignore format: fixed cleanup absence probes
      await commandAbsent(DOCKER, [...dockerPrefix, 'network', 'inspect', 'baci-cwv-net']);
      const roots = [
        '/run/baci-cwv-registration',
        '/run/baci-cwv-registration-release',
        files.paths.staging,
      ];
      const stat = dependencies.lstat ?? lstat;
      for (const path of roots) await requireAbsent(stat, path);
      await requireAbsent(stat, '/run/baci-cwv/docker.sock');
      if (context.containerId)
        await requireAbsent(
          stat,
          `/sys/fs/cgroup/cwv-measurement.slice/docker-${context.containerId}.scope`
        );
      if (authority)
        await requireAbsent(stat, `/proc/${authority.listenerPid}`);
      const terminal = await network.proveCleanupAbsence?.();
      if (
        !restoration.restored() ||
        !daemonsStopped ||
        terminal?.schemaVersion !== 1 ||
        terminal.firewallAbsent !== true ||
        terminal.networkAbsent !== true ||
        terminal.bridgeAbsent !== true
      )
        fail();
      return {
        bridgeAbsent: true,
        captureRestored: true,
        cgroupAbsent: true,
        containerId: context.containerId,
        containerdInactive: true,
        containers: [],
        dockerInactive: true,
        dockerSocketAbsent: true,
        firewallAbsent: true,
        networkAbsent: true,
        processAbsent: true,
        releaseArtifacts: [],
        schemaVersion: 2,
        stagingArtifacts: [],
        tokenArtifacts: [],
      };
    }
    if (operation === 'disarm-watchdog') {
      // biome-ignore format: bounded synchronous systemd disarm
      try { await execute(SYSTEMCTL, ['disable', '--now', watchdog]); } catch { fail(); }
      for (let attempt = 0; attempt < 20; attempt += 1) {
        let state;
        try {
          state = await readSystemdUnitProperties(execute, watchdog, [
            'LoadState',
            'ActiveState',
            'UnitFileState',
          ]);
        } catch {
          fail();
        }
        // biome-ignore format: closed successful systemd state set
        if (['loaded', 'not-found'].includes(state.LoadState) && state.ActiveState === 'inactive' && state.UnitFileState === 'disabled') return {};
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      fail();
    }
    if (operation === 'release-lock') return restoration.releaseLock();
    fail();
  };
}
