import assert from 'node:assert/strict';
import { execFile, spawnSync } from 'node:child_process';
import { constants } from 'node:fs';
import { mkdtemp, open, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import {
  bootstrapFileSpecs,
  buildBootstrapInput,
} from './install-bootstrap-plan.mjs';

test('reads bootstrap sources through no-follow descriptors', async () => {
  let descriptorRead = false;
  let noFollow = false;
  const sourceRoot = fileURLToPath(new URL('./', import.meta.url));
  await buildBootstrapInput(
    {
      bootstrapFileSha256: 'a'.repeat(64),
      policyFileSha256: 'b'.repeat(64),
      sourceManifestSha256: 'c'.repeat(64),
      sourceRoot,
      sourceSha: 'd'.repeat(40),
      transactionId: 'bootstrap-test',
    },
    {
      openFile: async (path, flags) => {
        noFollow ||= (flags & constants.O_NOFOLLOW) !== 0;
        const handle = await open(path, flags);
        return {
          close: () => handle.close(),
          readFile: async () => {
            descriptorRead = true;
            return await handle.readFile();
          },
          stat: (options) => handle.stat(options),
        };
      },
    }
  );
  assert.equal(noFollow, true);
  assert.equal(descriptorRead, true);
});

const run = promisify(execFile);
const root = new URL('./', import.meta.url);

test('projects the closed bootstrap helper, unit, config, and receipt closure', () => {
  const specs = bootstrapFileSpecs('a'.repeat(40));
  const sources = specs.filter((row) => row.source).map((row) => row.source);
  for (const required of [
    'policy.json',
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
    'campaign-capture-authority.mjs',
    'campaign-ownership.mjs',
    'campaign-cron-tree.mjs',
    'campaign-source-closure.mjs',
    'campaign-watchdog.sh',
    'host-idle-check.sh',
    'host-attest.sh',
    'host-sample-publisher.mjs',
    'install-prepare-acceptance.mjs',
    'install-bootstrap-installed.mjs',
    'install-account-identity.sh',
    'install-prepare-store.mjs',
    'install-prepare-content-cleanup.mjs',
    'install-prepare-content-cleanup-cli.mjs',
    'install-prepare-content-safety.mjs',
    'install-prepare-synthetic.mjs',
    'measurement-service-wrapper.sh',
    'exact-run-accounting.mjs',
    'exact-run-contract-cli.mjs',
    'exact-run-contract.mjs',
    'exact-run-controller.sh',
    'exact-run-live-sample-contract.mjs',
    'exact-run-process-contract.mjs',
    'exact-run-rearm-contract.mjs',
    'exact-run-terminal-cleanup.sh',
    'exact-run-transition-contract.mjs',
    'job-start-hook.sh',
    'cron-inventory.json',
    'identity-contract.json',
    'containerd.toml',
    'daemon.json',
  ])
    assert.ok(sources.includes(required), required);
  assert.deepEqual(
    sources.filter((source) => source.startsWith('campaign-state')).sort(),
    [
      'campaign-state-collisions.mjs',
      'campaign-state-journal-lock.mjs',
      'campaign-state.mjs',
    ]
  );
  assert.equal(new Set(specs.map((row) => row.destination)).size, specs.length);
  assert.equal(specs.filter((row) => row.renderWatchdog).length, 1);
  assert.ok(
    specs.every(
      (row) =>
        row.destination.startsWith('/etc/') ||
        row.destination.startsWith('/srv/baci-cwv/sealed/') ||
        row.destination === '/srv/baci-cwv/hooks/job-start-hook.sh'
    )
  );
  assert.deepEqual(
    specs.find((row) => row.source === 'job-start-hook.sh'),
    {
      source: 'job-start-hook.sh',
      destination: '/srv/baci-cwv/hooks/job-start-hook.sh',
      mode: '0550',
      owner: 'root:baci-cwv',
    }
  );
});

test('binds generated receipt lines without accepting a stable source alias', () => {
  const specs = bootstrapFileSpecs('b'.repeat(40));
  const watchdog = specs.find((row) => row.renderWatchdog);
  assert.equal(watchdog.sourceSha, 'b'.repeat(40));
  assert.equal(
    specs.some((row) => row.destination.includes('/current/')),
    false
  );
});

test('projects every transitive helper required by installed host collectors and root modes', async () => {
  const specs = bootstrapFileSpecs('c'.repeat(40));
  const names = new Set(specs.map((spec) => spec.source).filter(Boolean));
  const closure = [
    'archive-link-validation.mjs',
    'archive-stream.mjs',
    'attestation-evidence-store.mjs',
    'build-image.mjs',
    'canonical-json.mjs',
    'campaign-network-contract.mjs',
    'campaign-accounting-contract.mjs',
    'campaign-capture-authority.mjs',
    'campaign-ownership.mjs',
    'campaign-cron-tree.mjs',
    'campaign-lease-holder.sh',
    'campaign-restore-post-commit.sh',
    'campaign-restore-terminal-receipt.sh',
    'campaign-state.mjs',
    'campaign-state-collisions.mjs',
    'campaign-state-journal-lock.mjs',
    'campaign-traffic.mjs',
    'campaign-source-closure.mjs',
    'exact-run-terminal-cleanup.sh',
    'command-settings-contract.mjs',
    'host-attestation-normalize.mjs',
    'host-attestation.mjs',
    'host-control-evidence.mjs',
    'host-idle-evaluator.mjs',
    'host-idle-network.mjs',
    'host-idle-process-authority.mjs',
    'host-idle-snapshot.mjs',
    'host-idle-validation.mjs',
    'identity-contract.json',
    'image-archive-authority.mjs',
    'image-process-map.mjs',
    'image-projection-config.mjs',
    'image-projection.mjs',
    'install-prepare-acceptance.mjs',
    'install-prepare-runtime-receipt.mjs',
    'install-prepare-store.mjs',
    'measurement-container-projection.mjs',
    'policy.json',
    'policy.schema.mjs',
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
    'archive-index.mjs',
    'rootfs-source-membership.mjs',
    'rootfs-source-membership-input.mjs',
    'rootfs-source-inventory.mjs',
    'source-tree-projection.mjs',
    'runner-runtime-archive-snapshot.mjs',
    'runner-runtime-identity-manifest.mjs',
    'runner-runtime-manifest-producer-cli.mjs',
    'runner-runtime-manifest-producer.mjs',
    'runner-runtime-manifest-receipt-reader.mjs',
    'runner-runtime-receipt-contract.mjs',
    'runner-runtime-projection.mjs',
    'runtime-probe-controller.mjs',
  ];
  for (const required of closure) assert.ok(names.has(required), required);

  const isolated = await mkdtemp(path.join(os.tmpdir(), 'baci-cwv-closure-'));
  try {
    for (const name of names)
      await writeFile(
        path.join(isolated, name),
        await readFile(new URL(name, root))
      );
    await run(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        "await import('./host-idle-evaluator.mjs'); await import('./host-attestation-normalize.mjs'); await import('./root-runtime-executor.mjs'); await import('./registration-root-operations.mjs'); await import('./registration-root-request-stream.mjs'); await import('./install-prepare-acceptance.mjs');",
      ],
      { cwd: isolated }
    );
    const sourceDigest = await run(
      process.execPath,
      ['campaign-source-closure.mjs', 'digest', isolated],
      { cwd: isolated }
    );
    assert.match(sourceDigest.stdout, /^[0-9a-f]{64}\n$/);
    const quiesce = spawnSync(
      '/bin/sh',
      ['campaign-quiesce.sh', 'invalid-mode', 'installed-closure-test'],
      { cwd: isolated, encoding: 'utf8' }
    );
    assert.equal(quiesce.status, 64, quiesce.stderr);
    assert.match(quiesce.stderr, /usage: campaign-quiesce\.sh/);
    const installed = spawnSync(
      process.execPath,
      ['registration-root-operations.mjs', '--execute'],
      { cwd: isolated, encoding: 'utf8' }
    );
    assert.equal(installed.status, 65);
    assert.match(installed.stderr, /registration root operation refused/);
    assert.doesNotMatch(installed.stderr, /ERR_MODULE_NOT_FOUND/);
  } finally {
    await rm(isolated, { force: true, recursive: true });
  }
});
