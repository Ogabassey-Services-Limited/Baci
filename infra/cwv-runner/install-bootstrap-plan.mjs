import { createHash } from 'node:crypto';
import { lstat } from 'node:fs/promises';
import { readPinnedBootstrapFile } from './install-bootstrap-installed.mjs';

const [SOURCE, HEX] = [/^[0-9a-f]{40}$/, /^[0-9a-f]{64}$/];
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const units = Object.freeze(
  'baci-cwv-containerd.service baci-cwv-docker.service baci-cwv-measurement.service baci-cwv-host-sampler.service baci-cwv-host-sampler.timer cwv-measurement-control.slice cwv-measurement.slice'.split(
    ' '
  )
);
const helpers = [
  'archive-link-validation.mjs',
  'archive-index.mjs',
  'archive-stream.mjs',
  'build-image.mjs',
  'canonical-json.mjs',
  'command-settings-contract.mjs',
  'image-archive-authority.mjs',
  'image-process-map.mjs',
  'image-projection-config.mjs',
  'image-projection.mjs',
  'policy.schema.mjs',
  'campaign-state.mjs',
  'campaign-state-collisions.mjs',
  'campaign-state-journal-lock.mjs',
  'campaign-traffic.mjs',
  'campaign-terminal-cleanup.mjs',
  'campaign-lease-holder.sh',
  'campaign-quiesce.sh',
  'campaign-restore.sh',
  'campaign-restore-post-commit.sh',
  'campaign-restore-terminal-receipt.sh',
  'campaign-restore-network.mjs',
  'campaign-restore-baseline.mjs',
  'campaign-network-contract.mjs',
  'campaign-accounting-contract.mjs',
  'campaign-ownership.mjs',
  'campaign-cron-tree.mjs',
  'campaign-source-closure.mjs',
  'campaign-watchdog.sh',
  'host-idle-check.sh',
  'host-idle-evaluator.mjs',
  'host-idle-network.mjs',
  'host-idle-process-authority.mjs',
  'host-idle-snapshot.mjs',
  'host-idle-validation.mjs',
  'host-attest.sh',
  'host-attestation-normalize.mjs',
  'host-attestation.mjs',
  'attestation-evidence-store.mjs',
  'host-control-evidence.mjs',
  'host-sample-publisher.mjs',
  'install-prepare-acceptance.mjs',
  'install-prepare-store.mjs',
  'install-prepare-content-cleanup.mjs',
  'install-prepare-content-cleanup-cli.mjs',
  'install-prepare-content-safety.mjs',
  'install-prepare-synthetic.mjs',
  'install-prepare-runtime-receipt.mjs',
  ...'install-bootstrap.mjs install-bootstrap-atomic-state-file.mjs install-bootstrap-capture-persistence.mjs install-bootstrap-installed.mjs install-bootstrap-journal.mjs install-bootstrap-plan-publication.mjs install-bootstrap-watchdog-residue.mjs install-account-identity.sh'.split(
    ' '
  ),
  'install-bootstrap-rename-exchange.pl',
  'campaign-capture-authority.mjs',
  'measurement-container-projection.mjs',
  'measurement-service-wrapper.sh',
  'registration-controller-cleanup.mjs',
  'registration-controller-flow.mjs',
  'registration-controller-normal-mode.mjs',
  'registration-controller-state.mjs',
  'registration-controller.mjs',
  'registration-terminal-receipt.mjs',
  'registration-terminal-evidence.mjs',
  'registration-terminal-lease-recovery.mjs',
  'registration-command-prepare.mjs',
  'registration-command-retry-block.mjs',
  'registration-command-store.mjs',
  'registration-retry-block.mjs',
  'registration-runtime-contract.mjs',
  'registration-root-contract.mjs',
  'registration-root-configuration.mjs',
  'registration-root-docker.mjs',
  'registration-root-filesystem.mjs',
  'registration-root-inspection.mjs',
  'registration-network-cleanup.mjs',
  'registration-network-policy.mjs',
  'registration-network-probes.mjs',
  'registration-post-egress-recovery.mjs',
  'registration-root-network.mjs',
  'registration-root-authority.mjs',
  'registration-authority-parent-sync.mjs',
  'registration-root-guard.mjs',
  'registration-root-guard-operations.mjs',
  'registration-root-mount-namespace.mjs',
  'registration-root-observer.mjs',
  'registration-root-observer-live.mjs',
  'registration-root-operations.mjs',
  'registration-root-request-stream.mjs',
  'registration-token-fd.mjs',
  'registration-token-mount.mjs',
  'registration-root-receipts.mjs',
  'registration-root-recovery-classifier.mjs',
  'registration-root-restoration.mjs',
  'registration-root-sealing.mjs',
  'runner-identity-contract.mjs',
  'runner-runtime-projection.mjs',
  'registration-root-system.mjs',
  'registration-root-terminal-cleanup.mjs',
  'root-registration-backend-client.mjs',
  'root-registration-operation-adapter.mjs',
  'root-runtime-executor.mjs',
  'root-runtime-owned-read.mjs',
  'root-runtime-installed-receipt.mjs',
  'root-runtime-registration-adapter.mjs',
  'root-runtime-post-egress-recovery.mjs',
  'root-runtime-operations.mjs',
  'rootfs-projection-contract.mjs',
  'rootfs-source-membership.mjs',
  'rootfs-source-membership-input.mjs',
  'rootfs-source-inventory.mjs',
  'source-tree-projection.mjs',
  'runner-runtime-archive-snapshot.mjs',
  'runner-runtime-identity-manifest.mjs',
  'runner-runtime-manifest-producer-cli.mjs',
  'runner-runtime-manifest-producer.mjs',
  'runner-runtime-output-paths.mjs',
  'runner-runtime-manifest-receipt-reader.mjs',
  'runner-runtime-receipt-contract.mjs',
  'runtime-probe-controller.mjs',
  'exact-run-accounting.mjs',
  'exact-run-contract-cli.mjs',
  'exact-run-contract.mjs',
  'normal-release.mjs',
  'exact-run-controller.sh',
  'exact-run-live-sample-contract.mjs',
  'exact-run-process-contract.mjs',
  'exact-run-rearm-contract.mjs',
  'exact-run-terminal-cleanup.sh',
  'exact-run-transition-contract.mjs',
];
export function bootstrapFileSpecs(sourceSha) {
  if (!SOURCE.test(sourceSha)) throw new TypeError('invalid source sha');
  return [
    ...units.map((source) => ({
      source,
      destination: `/etc/systemd/system/${source}`,
      mode: '0644',
      owner: 'root:root',
    })),
    ...['containerd.toml', 'daemon.json'].map((source) => ({
      source,
      destination: `/etc/baci-cwv/${source}`,
      mode: '0644',
      owner: 'root:root',
    })),
    {
      source: 'baci-cwv-campaign-watchdog@.service',
      destination: '/etc/systemd/system/baci-cwv-campaign-watchdog@.service',
      mode: '0644',
      owner: 'root:root',
      renderWatchdog: true,
      sourceSha,
    },
    {
      source: 'policy.json',
      destination: '/srv/baci-cwv/sealed/policy.json',
      mode: '0400',
      owner: 'root:root',
    },
    ...helpers.map((source) => ({
      source,
      destination: `/srv/baci-cwv/sealed/${source}`,
      mode: '0500',
      owner: 'root:root',
    })),
    ...['cron-inventory.json', 'identity-contract.json'].map((source) => ({
      source,
      destination: `/srv/baci-cwv/sealed/${source}`,
      mode: '0400',
      owner: 'root:root',
    })),
    {
      source: 'job-start-hook.sh',
      destination: '/srv/baci-cwv/hooks/job-start-hook.sh',
      mode: '0550',
      owner: 'root:baci-cwv',
    },
    {
      generated: 'policy',
      destination: '/srv/baci-cwv/sealed/policy.sha256',
      mode: '0640',
      owner: 'root:baci-cwv',
    },
    {
      generated: 'bootstrap',
      destination: '/srv/baci-cwv/sealed/bootstrap.sha256',
      mode: '0600',
      owner: 'root:root',
    },
    {
      generated: 'manifest',
      destination: '/srv/baci-cwv/sealed/source-manifest.sha256',
      mode: '0600',
      owner: 'root:root',
    },
  ];
}
async function priorMetadata(path, reader) {
  try {
    const { bytes, details } = await reader(path);
    const owner =
      details.uid === 0 && details.gid === 0
        ? 'root:root'
        : details.uid === 0 && details.gid === 10001
          ? 'root:baci-cwv'
          : null;
    if (!owner) throw new Error(`unsafe prior bootstrap owner: ${path}`);
    return {
      sha256: sha256(bytes),
      mode: (details.mode & 0o777).toString(8).padStart(4, '0'),
      owner,
    };
  } catch (error) {
    if (error.code === 'ENOENT') return { absent: true };
    throw error;
  }
}
export async function buildBootstrapInput(options, descriptor = {}) {
  const {
    sourceRoot,
    sourceSha,
    sourceManifestSha256,
    policyFileSha256,
    bootstrapFileSha256,
    transactionId,
    fileSpecs = bootstrapFileSpecs(sourceSha),
  } = options;
  if (
    ![sourceManifestSha256, policyFileSha256, bootstrapFileSha256].every(
      (value) => HEX.test(value)
    )
  )
    throw new TypeError('invalid bootstrap digest');
  const files = {};
  const prior = {};
  const readPinned = (path) =>
    readPinnedBootstrapFile(path, { lstatFile: lstat, ...descriptor });
  for (const spec of fileSpecs) {
    let bytes;
    if (spec.source) {
      const path = `${sourceRoot}/${spec.source}`;
      bytes = (await readPinned(path)).bytes;
      if (spec.renderWatchdog) {
        const text = bytes.toString('utf8');
        if ((text.match(/@BACI_CWV_SOURCE_SHA@/g) ?? []).length !== 1)
          throw new Error('invalid watchdog token count');
        bytes = Buffer.from(text.replace('@BACI_CWV_SOURCE_SHA@', sourceSha));
      }
    } else {
      const value = {
        policy: policyFileSha256,
        bootstrap: bootstrapFileSha256,
        manifest: sourceManifestSha256,
      }[spec.generated];
      bytes = Buffer.from(`${value}\n`);
    }
    files[spec.destination] = {
      sha256: sha256(bytes),
      mode: spec.mode,
      owner: spec.owner,
    };
    prior[spec.destination] = await priorMetadata(spec.destination, readPinned);
  }
  return {
    transactionId,
    sourceSha,
    sourceManifestSha256,
    policyFileSha256,
    files,
    prior,
  };
}
if (import.meta.filename === process.argv[1]) {
  const [sourceRoot, sourceSha, manifest, policy, bootstrap, transactionId] =
    process.argv.slice(2);
  buildBootstrapInput({
    sourceRoot,
    sourceSha,
    sourceManifestSha256: manifest,
    policyFileSha256: policy,
    bootstrapFileSha256: bootstrap,
    transactionId,
  })
    .then((value) => process.stdout.write(`${JSON.stringify(value)}\n`))
    .catch((error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    });
}
