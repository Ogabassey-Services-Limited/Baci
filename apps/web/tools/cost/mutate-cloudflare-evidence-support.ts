import { constants } from 'node:fs';
import { type FileHandle, open } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { z } from 'zod';
import { importReviewedEvidenceModule } from './cloudflare-evidence-reviewed-module-loader';
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

/**
 * The recovery command receives no Cloudflare token. Its reviewed module must
 * obtain authentication from an independent audit/provider boundary and only
 * expose the narrow token read-back operation needed by the journal.
 */
type RevocationReadbackFactory = (
  input: Readonly<{
    runId: string;
    stateDir: string;
  }>
) => Promise<EvidenceReadbackClient>;

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

function verifyReviewedModule(
  workspaceRoot: string,
  toolingMergeSha: string,
  descriptor: Readonly<{ path: string; sha256: string }>
) {
  return verifyReviewedEvidenceRunnerModule(
    workspaceRoot,
    toolingMergeSha,
    descriptor
  );
}
async function loadAuthenticatedRevocationReadbackClient(
  journal: EvidenceJournal,
  runId: string,
  stateDir: string,
  receipt: Readonly<{
    tokenId: string;
    providerReceiptSha256: string;
    observedAt: string;
  }>
): Promise<EvidenceReadbackClient> {
  if (process.env.CLOUDFLARE_WRITE_TOKEN || process.env.CLOUDFLARE_READ_TOKEN)
    throw new Error(
      'external write-token revocation must not receive a Cloudflare token'
    );
  const modulePath =
    process.env.EVIDENCE_WRITE_TOKEN_REVOCATION_READBACK_MODULE;
  const moduleSha256 =
    process.env.EVIDENCE_WRITE_TOKEN_REVOCATION_READBACK_MODULE_SHA256;
  if (!modulePath || !moduleSha256)
    throw new Error(
      `${OWNER_PROVISIONING_REVOCATION_READBACK_BLOCKER}; an authenticated revocation readback module descriptor is required`
    );
  if (!isAbsolute(modulePath) || !/^[a-f0-9]{64}$/.test(moduleSha256))
    throw new Error(
      'authenticated revocation readback module descriptor is invalid'
    );
  const workspaceRoot = process.env.EVIDENCE_WORKSPACE_ROOT;
  if (!workspaceRoot)
    throw new Error('absolute EVIDENCE_WORKSPACE_ROOT is required');
  const verified = await verifyReviewedModule(
    workspaceRoot,
    journal.toolingMergeSha,
    { path: modulePath, sha256: moduleSha256 }
  );
  return importReviewedEvidenceModule(
    workspaceRoot,
    verified.path,
    verified.files,
    async (loaded) => {
      const factory =
        loaded && typeof loaded === 'object'
          ? // Keep the legacy name for already-deployed reviewed modules.
            'createRevocationReadbackClient' in loaded
            ? (loaded as { createRevocationReadbackClient?: unknown })
                .createRevocationReadbackClient
            : 'createRevocationReadbackDependencies' in loaded
              ? (loaded as { createRevocationReadbackDependencies?: unknown })
                  .createRevocationReadbackDependencies
              : undefined
          : undefined;
      if (typeof factory !== 'function')
        throw new Error('authenticated revocation readback module is invalid');
      const client = await (factory as RevocationReadbackFactory)({
        runId,
        stateDir,
      });
      if (
        !client ||
        typeof client !== 'object' ||
        typeof client.readBack !== 'function'
      )
        throw new Error(
          'authenticated revocation readback module did not provide readback'
        );
      return Object.freeze({
        readBack: (tokenId: string) => {
          if (tokenId !== receipt.tokenId)
            throw new Error(
              'external write-token revocation receipt does not match the journal'
            );
          return client.readBack(tokenId);
        },
      });
    }
  );
}
async function loadCredentiallessRevocationDependencies(
  journal: EvidenceJournal,
  runId: string,
  stateDir: string
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
  let value: unknown;
  let handle: FileHandle | undefined;
  try {
    handle = await open(receiptPath, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = await handle.stat();
    if (
      stat.isSymbolicLink() ||
      !stat.isFile() ||
      (stat.mode & 0o777) !== 0o600
    )
      throw new Error(
        'external write-token revocation receipt is not private regular storage'
      );
    value = JSON.parse(await handle.readFile('utf8'));
  } catch {
    throw new Error('external write-token revocation receipt is invalid');
  } finally {
    await handle?.close().catch(() => undefined);
  }
  const receipt = parseWriteTokenRevocationReceipt(value);
  if (receipt.tokenId !== journal.writeTokenId)
    throw new Error(
      'external write-token revocation receipt does not match the journal'
    );
  const client = await loadAuthenticatedRevocationReadbackClient(
    journal,
    runId,
    stateDir,
    receipt
  );
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
  const verified = await verifyReviewedModule(
    workspaceRoot,
    journal.toolingMergeSha,
    { path: modulePath, sha256: journal.mutationRunnerModuleSha256 }
  );
  return importReviewedEvidenceModule(
    workspaceRoot,
    verified.path,
    verified.files,
    (loaded) => {
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
  );
}
export async function loadMutationDependencies(
  runId: string,
  stateDir: string,
  mode: MutationMode
) {
  const journal = await verifyReviewedCommand(runId, stateDir);
  return mode === 'record_write_revocation'
    ? loadCredentiallessRevocationDependencies(journal, runId, stateDir)
    : loadAuthenticatedMutationDependencies(journal, runId, stateDir, mode);
}
