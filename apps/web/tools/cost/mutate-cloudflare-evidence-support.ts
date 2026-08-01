import { createHash } from 'node:crypto';
import { lstat, readFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { loadEvidenceRunForCleanup } from './cloudflare-evidence-run-journal';
import {
  verifyReviewedEvidenceFile,
  verifyReviewedEvidenceRunnerModule,
} from './cloudflare-evidence-runner-modules';
import type {
  EvidenceJournal,
  EvidenceMutationDependencies,
  EvidenceReadbackClient,
  MutationMode,
} from './mutate-cloudflare-evidence-validation';

export type {
  EvidenceJournal,
  EvidenceMutationClient,
  EvidenceMutationDependencies,
  EvidenceProbeResult,
  EvidenceReadbackClient,
  EvidenceResource,
  EvidenceTemporaryRuleBinding,
  MutationMode,
} from './mutate-cloudflare-evidence-validation';
export {
  EVIDENCE_HOSTNAME,
  isEvidenceMutationClient,
  parseMutationArguments,
  REVIEWED_TEMPORARY_RULE_BINDING,
  SYNTHETIC_PATHS,
  verifyCapability,
  verifyIdentity,
  verifyResource,
} from './mutate-cloudflare-evidence-validation';

type MutationRunnerFactory = (
  input: Readonly<{
    token: string;
    runId: string;
    stateDir: string;
    mode: MutationMode;
  }>
) => Promise<EvidenceMutationDependencies>;

const OWNER_PROVISIONING_REVOCATION_READBACK_BLOCKER =
  'owner provisioning required: independent authenticated provider or audit readback is unavailable; a local receipt cannot authorize a write-token revocation phase transition';

const externalWriteTokenRevocationReceiptSchema = z
  .object({
    tokenId: z.string().min(1),
    status: z.literal('revoked'),
    providerReceiptSha256: z.string().regex(/^[a-f0-9]{64}$/),
    observedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

async function verifyReviewedCommand(
  runId: string,
  stateDir: string
): Promise<EvidenceJournal> {
  const journal = await loadEvidenceRunForCleanup(stateDir, runId);
  const workspaceRoot = process.env.EVIDENCE_WORKSPACE_ROOT;
  if (!workspaceRoot)
    throw new Error('absolute EVIDENCE_WORKSPACE_ROOT is required');
  const commandPath = resolve(
    workspaceRoot,
    'apps/web/tools/cost/mutate-cloudflare-evidence-sources.ts'
  );
  if (!process.argv[1] || resolve(process.argv[1]) !== commandPath)
    throw new Error('mutation command entrypoint is not reviewed');
  await verifyReviewedEvidenceFile(
    workspaceRoot,
    journal.toolingMergeSha,
    commandPath
  );
  return journal;
}

function parseWriteTokenRevocationReceipt(value: unknown) {
  const parsed = externalWriteTokenRevocationReceiptSchema.safeParse(value);
  if (!parsed.success)
    throw new Error('external write-token revocation receipt is invalid');
  return Object.freeze(parsed.data);
}

async function loadCredentiallessRevocationDependencies(
  journal: EvidenceJournal
): Promise<EvidenceMutationDependencies> {
  const receiptPath =
    process.env.EVIDENCE_WRITE_TOKEN_REVOCATION_READBACK_RECEIPT_PATH;
  if (!receiptPath)
    throw new Error(
      'EVIDENCE_WRITE_TOKEN_REVOCATION_READBACK_RECEIPT_PATH is required for external revocation'
    );
  if (!isAbsolute(receiptPath))
    throw new Error(
      'EVIDENCE_WRITE_TOKEN_REVOCATION_READBACK_RECEIPT_PATH must be absolute'
    );
  const stat = await lstat(receiptPath);
  if (stat.isSymbolicLink() || !stat.isFile() || (stat.mode & 0o777) !== 0o600)
    throw new Error(
      'external write-token revocation receipt is not private regular storage'
    );
  let value: unknown;
  try {
    value = JSON.parse(await readFile(receiptPath, 'utf8'));
  } catch {
    throw new Error('external write-token revocation receipt is invalid');
  }
  const receipt = parseWriteTokenRevocationReceipt(value);
  if (receipt.tokenId !== journal.writeTokenId)
    throw new Error(
      'external write-token revocation receipt does not match the journal'
    );
  // This command has no authenticated provider/audit client contract. The
  // receipt is an untrusted handoff artifact and must never become readback.
  const client: EvidenceReadbackClient = {
    readBack: () =>
      Promise.reject(new Error(OWNER_PROVISIONING_REVOCATION_READBACK_BLOCKER)),
  };
  return { client, revocationReceipt: receipt };
}

async function loadAuthenticatedMutationDependencies(
  journal: EvidenceJournal,
  runId: string,
  stateDir: string,
  mode: Exclude<MutationMode, 'record_write_revocation'>
) {
  const configuredPath = process.env.EVIDENCE_MUTATION_RUNNER_MODULE;
  const configuredSha256 = process.env.EVIDENCE_MUTATION_RUNNER_MODULE_SHA256;
  const modulePath = journal.mutationRunnerModulePath;
  const token = process.env.CLOUDFLARE_WRITE_TOKEN;
  if (!modulePath || !journal.mutationRunnerModuleSha256)
    throw new Error(
      'mutation runner module descriptor is missing from the journal'
    );
  if (configuredPath && resolve(configuredPath) !== resolve(modulePath))
    throw new Error('mutation runner module does not match the journal');
  if (
    configuredSha256 &&
    configuredSha256 !== journal.mutationRunnerModuleSha256
  )
    throw new Error('mutation runner module hash does not match the journal');
  if (!token)
    throw new Error(
      'mutation requires a provider runner module and the isolated write token'
    );
  const workspaceRoot = process.env.EVIDENCE_WORKSPACE_ROOT;
  if (!workspaceRoot)
    throw new Error('absolute EVIDENCE_WORKSPACE_ROOT is required');
  const verified = await verifyReviewedEvidenceRunnerModule(
    workspaceRoot,
    journal.toolingMergeSha,
    { path: modulePath, sha256: journal.mutationRunnerModuleSha256 }
  );
  const bytes = await readFile(verified.path);
  const actualSha256 = createHash('sha256').update(bytes).digest('hex');
  if (actualSha256 !== verified.sha256)
    throw new Error('mutation runner module hash does not match the journal');
  const loaded: unknown = await import(pathToFileURL(verified.path).href);
  const factory =
    loaded &&
    typeof loaded === 'object' &&
    'createMutationDependencies' in loaded
      ? (loaded as { createMutationDependencies?: unknown })
          .createMutationDependencies
      : undefined;
  if (typeof factory !== 'function')
    throw new Error('mutation runner module is invalid');
  return (factory as MutationRunnerFactory)({
    token,
    runId,
    stateDir,
    mode,
  });
}

export async function loadMutationDependencies(
  runId: string,
  stateDir: string,
  mode: MutationMode
) {
  const journal = await verifyReviewedCommand(runId, stateDir);
  return mode === 'record_write_revocation'
    ? loadCredentiallessRevocationDependencies(journal)
    : loadAuthenticatedMutationDependencies(journal, runId, stateDir, mode);
}
