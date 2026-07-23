import { z } from 'zod';
import type {
  ProductionOldCancellationProofReceipt,
  ReplayCommand,
  SupabaseHistoryEffectComparisonMode,
} from './supabase-history-replay-types';

const CANCELLATION_IDENTITY =
  'public.cancel_order_as_customer(p_order_id uuid, p_reason text)';
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const digestSchema = z
  .object({
    category: z.string().min(1),
    identity: z.string().min(1),
    sha256: sha256Schema,
  })
  .strict();
const comparisonSchema = z
  .object({
    changedComponents: z
      .array(
        z
          .object({
            category: z.string().min(1),
            identity: z.string().min(1),
            localSha256: sha256Schema.nullable(),
            productionSha256: sha256Schema.nullable(),
          })
          .strict()
      )
      .max(76),
    converged: z.boolean(),
    mode: z.enum(['classify', 'enforce']),
    productionEffectSha256: sha256Schema,
  })
  .strict();
const resultSchema = z.object({
  comparison: comparisonSchema,
  digestVector: z.array(digestSchema).length(76),
  effectSha256: sha256Schema,
  serverVersionNum: z.literal(170006),
});
const proofSchema = z
  .object({
    productionSha256: sha256Schema,
    repairedSha256: sha256Schema,
    verified: z.literal(true),
  })
  .strict();

function assertCancellationProof(
  result: z.infer<typeof resultSchema>,
  proof: ProductionOldCancellationProofReceipt
): void {
  const cancellationDigests = result.digestVector.filter(
    ({ category, identity }) =>
      category === 'function' && identity === CANCELLATION_IDENTITY
  );
  if (
    cancellationDigests.length !== 1 ||
    cancellationDigests[0]?.sha256 !== proof.repairedSha256
  ) {
    throw new Error('mismatch');
  }
  if (result.comparison.mode !== 'classify') return;
  const cancellationDrift = result.comparison.changedComponents.filter(
    ({ category, identity }) =>
      category === 'function' && identity === CANCELLATION_IDENTITY
  );
  if (
    cancellationDrift.length !== 1 ||
    cancellationDrift[0]?.localSha256 !== proof.repairedSha256 ||
    cancellationDrift[0]?.productionSha256 !== proof.productionSha256
  ) {
    throw new Error('mismatch');
  }
}

export async function executeSupabaseHistoryReplayVerification(options: {
  comparisonMode: SupabaseHistoryEffectComparisonMode;
  databaseUrl: string;
  psqlBin: string;
  productionOldCancellationProof?: ProductionOldCancellationProofReceipt;
  readEffects: (input: {
    comparisonMode: SupabaseHistoryEffectComparisonMode;
    databaseUrl: string;
    psqlBin: string;
    repositoryRoot: string;
    runCommand: ReplayCommand;
  }) => Promise<unknown>;
  repositoryRoot: string;
  runCommand: ReplayCommand;
}) {
  try {
    const result = resultSchema.parse(
      await options.readEffects({
        comparisonMode: options.comparisonMode,
        databaseUrl: options.databaseUrl,
        psqlBin: options.psqlBin,
        repositoryRoot: options.repositoryRoot,
        runCommand: options.runCommand,
      })
    );
    const comparison = result.comparison;
    const validEnforce =
      comparison.mode === 'enforce' &&
      comparison.converged &&
      comparison.changedComponents.length === 0;
    const validClassify =
      comparison.mode === 'classify' && !comparison.converged;
    if (
      comparison.mode !== options.comparisonMode ||
      (options.comparisonMode === 'enforce' ? !validEnforce : !validClassify)
    ) {
      throw new Error('mismatch');
    }
    if (options.productionOldCancellationProof) {
      assertCancellationProof(
        result,
        proofSchema.parse(options.productionOldCancellationProof)
      );
    }
    return {
      comparison: result.comparison,
      effectSha256: result.effectSha256,
      serverVersionNum: result.serverVersionNum,
    };
  } catch {
    throw new Error('Supabase replay effect verification failed');
  }
}
