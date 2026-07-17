import { createHash } from 'node:crypto';
import { productionOldCancellationSourceEffectsSchema } from './schemas/production-old-cancellation-source-effects-schema';

const CANCELLATION_IDENTITY =
  'public.cancel_order_as_customer(p_order_id uuid, p_reason text)';

type SourceEvidence = {
  componentSha256: string;
  productionEffects: {
    fixtureSha256: string;
    ledgerRowCount: number;
    ledgerTailVersion: string;
    querySha256: string;
    scopeManifestSha256: string;
  };
};

const sha256 = (value: string | Buffer) =>
  createHash('sha256').update(value).digest('hex');

export function verifyProductionOldCancellationSource(
  evidence: SourceEvidence,
  productionFixture: string
) {
  try {
    if (
      sha256(productionFixture) !== evidence.productionEffects.fixtureSha256
    ) {
      throw new Error('mismatch');
    }
    const production = productionOldCancellationSourceEffectsSchema.parse(
      JSON.parse(productionFixture)
    );
    const cancellation = production.digestVector.filter(
      ({ category, identity }) =>
        category === 'function' && identity === CANCELLATION_IDENTITY
    );
    if (
      cancellation.length !== 1 ||
      cancellation[0]?.sha256 !== evidence.componentSha256 ||
      production.source.querySha256 !==
        evidence.productionEffects.querySha256 ||
      production.scope.manifestSha256 !==
        evidence.productionEffects.scopeManifestSha256 ||
      production.ledger.rowCount !==
        evidence.productionEffects.ledgerRowCount ||
      production.ledger.tailVersion !==
        evidence.productionEffects.ledgerTailVersion
    ) {
      throw new Error('mismatch');
    }
    return {
      componentSha256: evidence.componentSha256,
      fixtureSha256: evidence.productionEffects.fixtureSha256,
      verified: true as const,
    };
  } catch {
    throw new Error('Production-old cancellation source verification failed');
  }
}
