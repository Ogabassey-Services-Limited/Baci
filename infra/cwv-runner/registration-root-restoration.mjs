import { lstat } from 'node:fs/promises';

import { canonicalJson } from './canonical-json.mjs';
import { readRegistrationTerminalEvidence } from './registration-terminal-evidence.mjs';
import { readRestoredRegistration } from './registration-terminal-lease-recovery.mjs';

const RESTORE = '/srv/baci-cwv/sealed/campaign-restore.sh';
const SHA256 = /^[a-f0-9]{64}$/;
const fail = () => {
  throw new TypeError('registration root system refused');
};

export function createRegistrationCaptureRestoration(
  configuration,
  dependencies,
  execute,
  sealer
) {
  const campaign = configuration.context.campaignId;
  let capturePresent = false;
  let captureRestored = false;
  let sealed;
  const capturePath = `/srv/baci-cwv/campaigns/${campaign}/capture.json`;
  const terminalCandidate = async () => {
    const restored = await (
      dependencies.readRestoredRegistration ?? readRestoredRegistration
    )(
      {
        campaignId: campaign,
        captureSha256: configuration.context.captureSha256,
        imageDigest: configuration.context.imageDigest,
      },
      dependencies
    );
    if (restored) return canonicalJson(restored);
    if (!sealed) {
      return canonicalJson({
        captureSha256: configuration.context.captureSha256,
        disposition: 'retry-block',
        schemaVersion: 1,
      });
    }
    if (
      !SHA256.test(sealed.runnerIdentitySha256) ||
      !SHA256.test(sealed.sealedRunnerSha256)
    )
      fail();
    const evidence = await (
      dependencies.readRegistrationTerminalEvidence ??
      readRegistrationTerminalEvidence
    )({
      campaignId: campaign,
      captureSha256: configuration.context.captureSha256,
      imageDigest: configuration.context.imageDigest,
      registrationNonce: configuration.context.registrationNonce,
      releaseNonce: configuration.context.releaseNonce,
    });
    return canonicalJson({
      ...evidence,
      runnerIdentitySha256: sealed.runnerIdentitySha256,
      sealedRunnerSha256: sealed.sealedRunnerSha256,
    });
  };
  return Object.freeze({
    async restoreCapture() {
      try {
        await (dependencies.lstat ?? lstat)(capturePath);
      } catch (error) {
        if (error?.code === 'ENOENT') {
          captureRestored = true;
          return { capture: 'absent', schemaVersion: 1 };
        }
        throw error;
      }
      const candidate = await terminalCandidate();
      await execute(RESTORE, [
        campaign,
        configuration.context.captureSha256,
        '--defer-lease-release',
        candidate,
      ]);
      capturePresent = true;
      captureRestored = true;
      return { capture: 'restored', schemaVersion: 1 };
    },
    async releaseLock() {
      if (capturePresent)
        await execute(RESTORE, [
          campaign,
          configuration.context.captureSha256,
          '--release-lease',
        ]);
      return {};
    },
    async sealRunner() {
      sealed = await sealer.sealRunner();
      return sealed;
    },
    restored: () => captureRestored,
  });
}
