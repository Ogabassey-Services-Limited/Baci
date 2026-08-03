import { constants } from 'node:fs';
import { type FileHandle, open } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { z } from 'zod';
import { verifyAuthenticatedEvidenceRunnerModule } from './cloudflare-evidence-authenticated-runner';
import {
  evidenceExecutionRoot,
  mapEvidenceExecutionPath,
} from './cloudflare-evidence-execution-path';
import { getReadTokenRevocationReadbackFactory } from './cloudflare-evidence-read-revocation-factory';
import { importReviewedEvidenceModule } from './cloudflare-evidence-reviewed-module-loader';
import {
  type CloudflareEvidenceRunJournal,
  loadEvidenceRunForCleanup,
  recordEvidencePhase,
  recordTokenRevocation,
  type TokenRevocationClient,
  type TokenRevocationReceipt,
} from './cloudflare-evidence-run-journal';
import {
  evidenceRunnerModuleEnvironmentNames,
  verifyReviewedEvidenceFile,
} from './cloudflare-evidence-runner-modules';
import { assertMeasurementObservationWindow } from './measurement-observation-window';

const hash = /^[a-f0-9]{64}$/u;
const receiptPathEnvironment =
  'EVIDENCE_READ_TOKEN_REVOCATION_READBACK_RECEIPT_PATH';

const externalReadTokenRevocationReceiptSchema = z
  .object({
    tokenId: z.string().min(1),
    status: z.literal('revoked'),
    providerReceiptSha256: z.string().regex(hash),
    observedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export type EvidenceReadRevocationDependencies = Readonly<{
  revocationReceipt: TokenRevocationReceipt;
  client: Pick<TokenRevocationClient, 'readBack'>;
}>;
type TokenReadback = Awaited<ReturnType<TokenRevocationClient['readBack']>>;

function parseReadback(value: unknown): TokenReadback {
  if (
    !value ||
    typeof value !== 'object' ||
    typeof (value as { tokenId?: unknown }).tokenId !== 'string' ||
    !['inactive', 'absent', 'active'].includes(
      (value as { status?: unknown }).status as string
    ) ||
    !hash.test(
      (value as { auditReceiptSha256?: unknown }).auditReceiptSha256 as string
    ) ||
    typeof (value as { observedAt?: unknown }).observedAt !== 'string' ||
    Number.isNaN(
      new Date((value as { observedAt: string }).observedAt).valueOf()
    )
  )
    throw new Error('authenticated read-token revocation readback is invalid');
  return value as TokenReadback;
}

function parseReceipt(value: unknown): TokenRevocationReceipt {
  const parsed = externalReadTokenRevocationReceiptSchema.safeParse(value);
  if (!parsed.success)
    throw new Error('external read-token revocation receipt is invalid');
  return Object.freeze(parsed.data);
}

async function readReceipt(pathValue: string) {
  if (!isAbsolute(pathValue))
    throw new Error(
      'external read-token revocation receipt path must be absolute'
    );
  let handle: FileHandle | undefined;
  try {
    handle = await open(pathValue, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = await handle.stat();
    if (!stat.isFile() || (stat.mode & 0o777) !== 0o600)
      throw new Error(
        'external read-token revocation receipt is not private regular storage'
      );
    return parseReceipt(JSON.parse(await handle.readFile('utf8')));
  } catch (error) {
    if (error instanceof Error && error.message.includes('external read-token'))
      throw error;
    throw new Error('external read-token revocation receipt is invalid');
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

async function loadReadbackClient(
  runId: string,
  stateDir: string,
  receipt: TokenRevocationReceipt,
  journal: Pick<
    CloudflareEvidenceRunJournal,
    'readRevocationRunnerModulePath' | 'readRevocationRunnerModuleSha256'
  >
): Promise<Pick<TokenRevocationClient, 'readBack'>> {
  if (
    process.env.CLOUDFLARE_WRITE_TOKEN !== undefined ||
    process.env.CLOUDFLARE_READ_TOKEN !== undefined
  )
    throw new Error(
      'external read-token revocation must not receive a Cloudflare token'
    );
  const modulePath = journal.readRevocationRunnerModulePath;
  const moduleSha256 = journal.readRevocationRunnerModuleSha256;
  if (!modulePath || !moduleSha256)
    throw new Error(
      'read-token revocation readback module descriptor is missing from the journal'
    );
  if (!isAbsolute(modulePath) || !hash.test(moduleSha256))
    throw new Error(
      'journaled read-token revocation module descriptor is invalid'
    );
  const executionModulePath = mapEvidenceExecutionPath(modulePath);
  const names = evidenceRunnerModuleEnvironmentNames('readRevocation');
  const configuredPath = process.env[names.path];
  const configuredSha256 = process.env[names.sha256];
  if (
    configuredPath &&
    resolve(configuredPath) !== resolve(executionModulePath)
  )
    throw new Error(
      'read-token revocation readback module does not match the journal'
    );
  if (configuredSha256 && configuredSha256 !== moduleSha256)
    throw new Error(
      'read-token revocation readback module hash does not match the journal'
    );
  const verified = await verifyAuthenticatedEvidenceRunnerModule(
    evidenceExecutionRoot(),
    { path: executionModulePath, sha256: moduleSha256 }
  );
  return importReviewedEvidenceModule(
    evidenceExecutionRoot(),
    verified.path,
    verified.files,
    async (loaded) => {
      const factory = getReadTokenRevocationReadbackFactory(loaded);
      const client = await factory({ runId, stateDir });
      const readBack =
        client && typeof client === 'object'
          ? (client as { readBack?: unknown }).readBack
          : undefined;
      if (typeof readBack !== 'function')
        throw new Error(
          'authenticated read-token revocation readback is invalid'
        );
      const verifiedReadback = parseReadback(
        await (readBack as (id: string) => Promise<unknown>)(receipt.tokenId)
      );
      return Object.freeze({
        readBack: (tokenId: string) => {
          if (tokenId !== receipt.tokenId)
            throw new Error(
              'external read-token revocation receipt does not match the journal'
            );
          return Promise.resolve(verifiedReadback);
        },
      });
    }
  );
}

async function verifyReviewedCommand(runId: string, stateDir: string) {
  const journal = await loadEvidenceRunForCleanup(stateDir, runId);
  const workspaceRoot = evidenceExecutionRoot();
  const commandPath = resolve(
    workspaceRoot,
    'apps/web/tools/cost/measure-cloudflare-evidence-sources.ts'
  );
  if (!process.argv[1] || resolve(process.argv[1]) !== commandPath)
    throw new Error('measurement command entrypoint is not reviewed');
  await verifyReviewedEvidenceFile(
    workspaceRoot,
    journal.toolingMergeSha,
    commandPath
  );
  return journal;
}

export async function loadReadTokenRevocationDependencies(
  runId: string,
  stateDir: string
): Promise<EvidenceReadRevocationDependencies> {
  if (
    process.env.CLOUDFLARE_WRITE_TOKEN !== undefined ||
    process.env.CLOUDFLARE_READ_TOKEN !== undefined
  )
    throw new Error(
      'external read-token revocation must not receive a Cloudflare token'
    );
  const journal = await verifyReviewedCommand(runId, stateDir);
  const receiptPath = process.env[receiptPathEnvironment];
  if (!receiptPath)
    throw new Error(
      `${receiptPathEnvironment} is required for external revocation`
    );
  const receipt = await readReceipt(receiptPath);
  if (receipt.tokenId !== journal.readTokenId)
    throw new Error(
      'external read-token revocation receipt does not match the journal'
    );
  const client = await loadReadbackClient(runId, stateDir, receipt, journal);
  return { revocationReceipt: receipt, client };
}

/**
 * A read-only measurement token cannot delete API tokens. The owner revokes it
 * on a separate control surface, then this credentialless recovery command
 * verifies the external receipt and closes the journal.
 */
export async function recordCloudflareEvidenceReadTokenRevocation(
  stateDir: string,
  runId: string,
  dependencies: EvidenceReadRevocationDependencies
) {
  const journal = await recordTokenRevocation(
    stateDir,
    runId,
    'read',
    dependencies.revocationReceipt,
    dependencies.client
  );
  if (journal.phase === 'closed_stop' || journal.phase === 'proof_complete')
    return journal;
  if (
    journal.phase !== 'read_token_revoked' ||
    !journal.measurementVerifiedAt ||
    !journal.readTokenRevocationReceipt
  )
    throw new Error(
      'read-token revocation did not produce a measured revocation receipt'
    );

  try {
    assertMeasurementObservationWindow(
      journal,
      journal.measurementVerifiedAt,
      new Date(journal.readTokenRevocationReceipt.observedAt)
    );
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : 'unknown observation error';
    return recordEvidencePhase(stateDir, runId, 'closed_stop', {
      measurementIncomplete: true,
      readBackEvidence: [
        ...journal.readBackEvidence,
        `measurement evidence outside active run window; STOP: ${reason}`,
      ],
    });
  }
  return recordEvidencePhase(stateDir, runId, 'proof_complete');
}
