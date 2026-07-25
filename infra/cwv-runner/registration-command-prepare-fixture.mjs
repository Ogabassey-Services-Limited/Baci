import { createHash } from 'node:crypto';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

export function createRegistrationCommandPreparationFixture() {
  const authority = Object.freeze({
    campaignId: 'registration-123e4567-e89b-12d3-a456-426614174000',
    registrationNonce: '1'.repeat(32),
    releaseNonce: '2'.repeat(32),
    schemaVersion: 1,
    stagingNonce: '3'.repeat(32),
  });
  const command = Object.freeze({
    context: { campaignId: authority.campaignId },
    resources: {},
    schemaVersion: 2,
  });
  const canonical = (value) => Buffer.from(JSON.stringify(value));
  const beginDependencies = (events, overrides = {}) => {
    const authorityBytes = canonical(authority);
    const capture = canonical({
      expectedEgressPlan: {},
      externalIfindex: 2,
      externalInterface: 'eth0',
      hostIpv4Addresses: ['10.0.0.1'],
      nonrootServiceUids: [10001],
      productionDockerSubnets: ['172.17.0.0/16'],
    });
    return {
      createAuthority: () => authority,
      deriveCommand: async () => command,
      persistCampaignAuthority: (bytes) => events.push(['persist', bytes]),
      publishCommand: async (bytes) => events.push(['publish', bytes]),
      quiesceRegistration: async (value) => events.push(['quiesce', value]),
      readCampaign: async () => authorityBytes,
      readCapture: async () => capture,
      readCaptureDigest: async () => Buffer.from(`${sha256(capture)}\n`),
      readExistingCommand: async () => undefined,
      readImageReceipt: async () => canonical({ image: true }),
      readLease: async () =>
        canonical({
          captureSha256: sha256(capture),
          lockHeld: true,
          mode: 'registration',
          transactionId: authority.campaignId,
        }),
      readPhase: async () => canonical({ phase: 'active' }),
      readPolicy: async () => canonical({ policy: true }),
      readRuntimeReceipt: async () => canonical({ runtime: true }),
      readRetryBlock: async () => undefined,
      readWatchdog: async () =>
        canonical({
          captureSha256: sha256(capture),
          lockHeld: true,
          mode: 'registration',
          transactionId: authority.campaignId,
        }),
      ...overrides,
    };
  };
  return Object.freeze({
    authority,
    beginDependencies,
    canonical,
    command,
    sha256,
  });
}
