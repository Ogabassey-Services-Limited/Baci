import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildSupabaseHistoryEffectDigests } from './build-supabase-history-effect-digests';
import { createSupabaseHistoryEffectTestFixture } from './supabase-history-effect-test-fixture';
import { verifyProductionOldCancellationSource } from './verify-production-old-cancellation-source';

const identity =
  'public.cancel_order_as_customer(p_order_id uuid, p_reason text)';
const querySha256 =
  '2b555af09c8a9cb7e8026b028c014b304de146a9f50a2c2f2a896a6626dfacbc';
const scopeManifestSha256 =
  'a216397b8fcc2cd0cac6f7a66023582f43b0c5e348501a94d00d771da1084245';

function sourceFixture() {
  const snapshot = createSupabaseHistoryEffectTestFixture();
  const digests = buildSupabaseHistoryEffectDigests(snapshot.components);
  const productionFixture = JSON.stringify({
    baseSha: '9e3d1b14b1931a5e441fc23f0e5417c188056e47',
    diagnostics: snapshot.diagnostics,
    digestVector: digests.digestVector,
    effectSha256: digests.effectSha256,
    effects: {
      componentCount: 76,
      customerCancellationSurfacePresent: true,
      domainEventRpcCount: 19,
      eventPolicyRolesExact: true,
      everyDomainEventProducerDisabled: true,
      fulfillmentTimestampsReady: true,
      merchantAnonProjectionExact: true,
      merchantFeatureSettingsReadWithheld: true,
      pgmqDomainEventsQueuePresent: true,
      pgmqProtectedRolesWithheld: true,
      pgmqPublicSchemaAbsent: true,
      requiredExtensionsPresent: true,
    },
    ledger: { rowCount: 439, tailVersion: '20260714225500' },
    schemaVersion: 2,
    scope: {
      componentCount: 76,
      manifestSha256: scopeManifestSha256,
      version: 'baci-p0-effects-v3',
    },
    source: {
      kind: 'supabase-management-api-read-only',
      querySha256,
      serverVersionNum: 170006,
    },
  });
  const cancellation = digests.digestVector.find(
    (digest) => digest.category === 'function' && digest.identity === identity
  );
  if (!cancellation) throw new Error('missing test cancellation digest');
  return {
    evidence: {
      componentSha256: cancellation.sha256,
      productionEffects: {
        fixtureSha256: createHash('sha256')
          .update(productionFixture)
          .digest('hex'),
        ledgerRowCount: 439,
        ledgerTailVersion: '20260714225500',
        querySha256,
        scopeManifestSha256,
      },
    },
    productionFixture,
  };
}

describe('verifyProductionOldCancellationSource', () => {
  it('cross-checks the exact source fixture metadata and cancellation digest', () => {
    const fixture = sourceFixture();

    expect(
      verifyProductionOldCancellationSource(
        fixture.evidence,
        fixture.productionFixture
      )
    ).toEqual({
      componentSha256: fixture.evidence.componentSha256,
      fixtureSha256: fixture.evidence.productionEffects.fixtureSha256,
      verified: true,
    });
  });

  it.each([
    (fixture: ReturnType<typeof sourceFixture>) => {
      fixture.evidence.productionEffects.fixtureSha256 = '0'.repeat(64);
    },
    (fixture: ReturnType<typeof sourceFixture>) => {
      fixture.evidence.componentSha256 = '0'.repeat(64);
    },
    (fixture: ReturnType<typeof sourceFixture>) => {
      fixture.evidence.productionEffects.querySha256 = '0'.repeat(64);
    },
    (fixture: ReturnType<typeof sourceFixture>) => {
      fixture.evidence.productionEffects.ledgerRowCount = 440;
    },
  ])('fails closed without exposing fixture contents', (mutate) => {
    const fixture = sourceFixture();
    mutate(fixture);

    expect(() =>
      verifyProductionOldCancellationSource(
        fixture.evidence,
        fixture.productionFixture
      )
    ).toThrow('Production-old cancellation source verification failed');
    try {
      verifyProductionOldCancellationSource(
        fixture.evidence,
        fixture.productionFixture
      );
    } catch (error) {
      expect(String(error)).not.toContain(fixture.productionFixture);
    }
  });
});
