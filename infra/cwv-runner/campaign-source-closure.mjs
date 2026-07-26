import { createHash } from 'node:crypto';
import { lstat, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';

export const campaignSourceClosure = Object.freeze([
  'campaign-accounting-contract.mjs',
  'campaign-capture-authority.mjs',
  'campaign-cron-tree.mjs',
  'campaign-lease-holder.sh',
  'campaign-network-contract.mjs',
  'campaign-ownership.mjs',
  'campaign-quiesce.sh',
  'exact-run-terminal-cleanup.sh',
  'campaign-restore-baseline.mjs',
  'campaign-restore-network.mjs',
  'campaign-restore-post-commit.sh',
  'campaign-restore-terminal-receipt.sh',
  'campaign-restore.sh',
  'campaign-source-closure.mjs',
  'campaign-state-collisions.mjs',
  'campaign-state-journal-lock.mjs',
  'campaign-state.mjs',
  'campaign-terminal-cleanup.mjs',
  'campaign-traffic.mjs',
  'campaign-watchdog.sh',
  'canonical-json.mjs',
  'command-settings-contract.mjs',
  'cron-inventory.json',
  'archive-link-validation.mjs',
  'archive-index.mjs',
  'archive-stream.mjs',
  'build-image.mjs',
  'image-archive-authority.mjs',
  'image-process-map.mjs',
  'image-projection-config.mjs',
  'image-projection.mjs',
  'install-prepare-acceptance.mjs',
  'install-prepare-content-cleanup-cli.mjs',
  'install-prepare-content-cleanup.mjs',
  'install-prepare-content-safety.mjs',
  'install-prepare-runtime-receipt.mjs',
  'install-prepare-store.mjs',
  'policy.schema.mjs',
  'policy.json',
  'registration-authority-parent-sync.mjs',
  'registration-command-prepare.mjs',
  'registration-command-retry-block.mjs',
  'registration-command-store.mjs',
  'registration-post-egress-recovery.mjs',
  'registration-retry-block.mjs',
  'registration-runtime-contract.mjs',
  'registration-terminal-evidence.mjs',
  'registration-terminal-lease-recovery.mjs',
  'registration-terminal-receipt.mjs',
  'registration-token-mount.mjs',
  'registration-root-restoration.mjs',
  'rootfs-projection-contract.mjs',
  'rootfs-source-membership.mjs',
  'rootfs-source-membership-input.mjs',
  'rootfs-source-inventory.mjs',
  'source-tree-projection.mjs',
  'root-runtime-installed-receipt.mjs',
  'runner-runtime-manifest-receipt-reader.mjs',
  'runner-runtime-manifest-producer.mjs',
  'runner-runtime-output-paths.mjs',
  'runner-runtime-archive-snapshot.mjs',
  'runner-runtime-identity-manifest.mjs',
  'runner-runtime-projection.mjs',
  'runner-runtime-receipt-contract.mjs',
  'root-runtime-registration-adapter.mjs',
  'root-runtime-owned-read.mjs',
]);

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

const requireRegularWithin = async (root, name) => {
  const candidate = await realpath(path.join(root, name));
  if (
    path.dirname(candidate) !== root ||
    (await lstat(candidate)).isFile() === false
  ) {
    throw new Error(`campaign source must be a regular direct child: ${name}`);
  }
  return candidate;
};

export const campaignSourceDigest = async (sourceRoot) => {
  const root = await realpath(sourceRoot);
  const entries = await Promise.all(
    campaignSourceClosure.map(async (name) => ({
      name,
      path: await requireRegularWithin(root, name),
    }))
  );
  const paths = entries.map((entry) => entry.path);
  if (new Set(paths).size !== campaignSourceClosure.length)
    throw new Error(
      'campaign source closure contains duplicate physical paths'
    );
  const rows = await Promise.all(
    entries
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(
        async ({ name, path: file }) =>
          `${sha256(await readFile(file))}  ${name}\n`
      )
  );
  return sha256(rows.join(''));
};

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const [command, sourceRoot] = process.argv.slice(2);
  if (command !== 'digest' || !sourceRoot) process.exitCode = 64;
  else
    campaignSourceDigest(sourceRoot).then(
      (digest) => process.stdout.write(`${digest}\n`),
      (error) => {
        process.stderr.write(
          `campaign source digest failed: ${error.message}\n`
        );
        process.exitCode = 65;
      }
    );
}
