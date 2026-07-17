import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { canonicalJsonValue } from './canonical-json-value';
import { replayRepository } from './replay-repository-root';
import { productionHistoryEffectsSchema } from './schemas/production-history-effects-schema';
import { productionOldCancellationProofSchema } from './schemas/production-old-cancellation-proof-schema';

const CANCELLATION_IDENTITY =
  'public.cancel_order_as_customer(p_order_id uuid, p_reason text)';
const EVIDENCE_PATH =
  'apps/web/tools/db/fixtures/production-old-cancellation-proof.json';
const PRODUCTION_EFFECTS_PATH =
  'apps/web/tools/db/fixtures/production-history-effects.json';

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
    const production = productionHistoryEffectsSchema.parse(
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

async function verifyCheckedSource(): Promise<void> {
  const root = replayRepository.root(import.meta.dirname);
  try {
    const [evidenceBytes, productionBytes] = await Promise.all([
      replayRepository.readSource(root, EVIDENCE_PATH),
      replayRepository.readSource(root, PRODUCTION_EFFECTS_PATH),
    ]);
    const evidence = productionOldCancellationProofSchema.parse(
      JSON.parse(evidenceBytes.toString('utf8'))
    );
    const receipt = verifyProductionOldCancellationSource(
      evidence,
      productionBytes.toString('utf8')
    );
    process.stdout.write(canonicalJsonValue(receipt));
  } catch {
    throw new Error('Production-old cancellation source verification failed');
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  verifyCheckedSource().catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : 'Production-old cancellation source verification failed'}\n`
    );
    process.exitCode = 1;
  });
}
