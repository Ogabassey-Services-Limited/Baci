import { constants as fsConstants } from 'node:fs';
import { open } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { cloudflareEvidencePrepare } from './cloudflare-evidence-prepare';
import {
  QUALIFICATION_WORKER_NAME,
  qualifyCloudflareEvidenceReadback,
  type ReviewedQualificationArtifact,
  ReviewedQualificationArtifactSchema,
} from './cloudflare-evidence-qualification-schemas';
import {
  type CloudflareOwnerAcceptanceAuthorityResolver,
  OwnerAcceptanceSchema,
} from './cloudflare-evidence-qualification-traffic';
import { importReviewedEvidenceModule } from './cloudflare-evidence-reviewed-module-loader';
import {
  hasReceipt,
  isHash,
  loadEvidenceRunForCleanup,
  validDate,
} from './cloudflare-evidence-run-journal';
import {
  type EvidenceRunnerModuleDescriptor,
  verifyReviewedEvidenceRunnerModule,
} from './cloudflare-evidence-runner-modules';

const MAXIMUM_APPROVAL_ID_LENGTH = 128;

function isBoundedApprovalId(value: string | undefined): value is string {
  return (
    value !== undefined &&
    value.length > 0 &&
    value.length <= MAXIMUM_APPROVAL_ID_LENGTH &&
    !/\s/u.test(value)
  );
}

export function parseQualificationArguments(args: readonly string[]) {
  if (args[0] === '--prepare')
    throw new Error('prepare options require the functional prepare parser');
  if (
    args.length === 14 &&
    args[0] === '--validate-readback' &&
    args[1].startsWith('/') &&
    args[2] === '--expected-artifact-a' &&
    args[3].startsWith('/') &&
    args[4] === '--expected-artifact-b' &&
    args[5].startsWith('/') &&
    args[6] === '--script-name' &&
    args[7] === QUALIFICATION_WORKER_NAME &&
    args[8] === '--expected-owner-approval-id' &&
    isBoundedApprovalId(args[9]) &&
    args[10] === '--run-state-dir' &&
    isAbsolute(args[11]) &&
    args[12] === '--run-id' &&
    /^[a-f0-9]{32}$/u.test(args[13] ?? '')
  )
    return {
      mode: 'validate-readback' as const,
      receiptPath: args[1],
      expectedArtifactPaths: [args[3], args[5]] as const,
      scriptName: args[7],
      expectedOwnerApprovalId: args[9],
      runStateDir: args[11],
      runId: args[13],
    };
  throw new Error(
    'qualification is credentialless and accepts only --prepare or --validate-readback <absolute-receipt> --expected-artifact-a <absolute-artifact> --expected-artifact-b <absolute-artifact> --script-name <name> --expected-owner-approval-id <owner-reviewed-approval-id> --run-state-dir <absolute-state-dir> --run-id <run-id>'
  );
}

async function readCompletedRunBinding(stateDir: string, runId: string) {
  const journal = await loadEvidenceRunForCleanup(stateDir, runId);
  const cleanupReceipt = journal.cleanupVerificationReceiptSha256;
  const measurementReceipt = journal.measurementReceiptSha256;
  if (
    journal.runId !== runId ||
    journal.phase !== 'proof_complete' ||
    !journal.cleanupVerifiedAt ||
    !validDate(journal.cleanupVerifiedAt) ||
    !journal.measurementVerifiedAt ||
    !validDate(journal.measurementVerifiedAt) ||
    !cleanupReceipt ||
    !measurementReceipt ||
    !isHash(cleanupReceipt) ||
    !isHash(measurementReceipt) ||
    !hasReceipt(journal.writeTokenRevocationReceipt, journal.writeTokenId) ||
    !hasReceipt(journal.readTokenRevocationReceipt, journal.readTokenId) ||
    (journal.cleanupWriteTokenId !== undefined &&
      !hasReceipt(
        journal.cleanupWriteTokenRevocationReceipt,
        journal.cleanupWriteTokenId
      ))
  )
    throw new Error(
      'qualification readback requires a completed proof_complete run journal'
    );
  return {
    runId,
    toolingMergeSha: journal.toolingMergeSha,
    cleanupVerificationReceiptSha256: cleanupReceipt,
    measurementReceiptSha256: measurementReceipt,
  } as const;
}

export function buildClosedEvidenceProcessEnvironment(
  credentialName: 'CLOUDFLARE_WRITE_TOKEN' | 'CLOUDFLARE_READ_TOKEN',
  credential: string,
  inherited: Readonly<Record<string, string | undefined>>
) {
  if (inherited.CLOUDFLARE_WRITE_TOKEN || inherited.CLOUDFLARE_READ_TOKEN)
    throw new Error('evidence process inherited a credential');
  const environment: Record<string, string> = {};
  for (const name of ['PATH', 'TMPDIR'] as const)
    if (inherited[name]) environment[name] = inherited[name];
  environment[credentialName] = credential;
  return environment;
}

function assertCredentiallessValidationEnvironment(
  environment: Readonly<Record<string, string | undefined>>
) {
  if (
    environment.CLOUDFLARE_WRITE_TOKEN !== undefined ||
    environment.CLOUDFLARE_READ_TOKEN !== undefined
  )
    throw new Error(
      'validate-readback must not receive a Cloudflare credential'
    );
}

type QualificationCliIo = Readonly<{
  stdout: (value: string) => void;
  stderr: (value: string) => void;
  setExitCode: (code: number) => void;
}>;

async function readReviewedArtifact(path: string, label: string) {
  if (!isAbsolute(path))
    throw new Error(`${label} artifact path must be absolute`);
  const privateRegularFileError = new Error(
    `${label} artifact must be a private regular file`
  );
  try {
    const handle = await open(
      path,
      fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW
    );
    try {
      const stat = await handle.stat();
      if (!stat.isFile() || (stat.mode & 0o777) !== 0o600)
        throw privateRegularFileError;
      return await handle.readFile('utf8');
    } finally {
      await handle.close();
    }
  } catch (error: unknown) {
    if (error === privateRegularFileError) throw error;
    throw new Error(`${label} artifact is not readable`);
  }
}

type OwnerAcceptanceAuthorityModule = Readonly<{
  resolveOwnerAcceptanceAuthority: () => unknown | Promise<unknown>;
}>;

async function loadOwnerAcceptanceAuthority(
  environment: Readonly<Record<string, string | undefined>>
): Promise<CloudflareOwnerAcceptanceAuthorityResolver> {
  const workspaceRoot = environment.EVIDENCE_WORKSPACE_ROOT;
  const toolingMergeSha = environment.EVIDENCE_TOOLING_MERGE_SHA;
  const path = environment.EVIDENCE_OWNER_ACCEPTANCE_AUTHORITY_MODULE;
  const sha256 = environment.EVIDENCE_OWNER_ACCEPTANCE_AUTHORITY_MODULE_SHA256;
  if (!workspaceRoot || !toolingMergeSha || !path || !sha256)
    throw new Error(
      'independently authenticated owner acceptance readback is required'
    );
  const descriptor: EvidenceRunnerModuleDescriptor = { path, sha256 };
  const verified = await verifyReviewedEvidenceRunnerModule(
    workspaceRoot,
    toolingMergeSha,
    descriptor
  );
  const authoritative = await importReviewedEvidenceModule(
    workspaceRoot,
    verified.path,
    verified.files,
    async (loaded) => {
      if (
        !loaded ||
        typeof loaded !== 'object' ||
        !('resolveOwnerAcceptanceAuthority' in loaded) ||
        typeof (loaded as Partial<OwnerAcceptanceAuthorityModule>)
          .resolveOwnerAcceptanceAuthority !== 'function'
      )
        throw new Error('owner acceptance authority module is invalid');
      const value = await (
        loaded as OwnerAcceptanceAuthorityModule
      ).resolveOwnerAcceptanceAuthority();
      const parsed = OwnerAcceptanceSchema.safeParse(value);
      if (!parsed.success)
        throw new Error(
          'owner acceptance authority module returned invalid data'
        );
      return parsed.data;
    }
  );
  return () => authoritative;
}

export async function runQualificationCli(
  args: readonly string[],
  environment: Readonly<Record<string, string | undefined>>,
  io: QualificationCliIo,
  ownerAcceptanceAuthority?: CloudflareOwnerAcceptanceAuthorityResolver
) {
  try {
    if (args[0] === '--prepare') {
      await cloudflareEvidencePrepare.run(args, environment, io.stdout);
      return;
    }
    if (args[0] === '--validate-readback') {
      const {
        receiptPath,
        expectedArtifactPaths,
        scriptName,
        expectedOwnerApprovalId,
        runStateDir,
        runId,
      } = parseQualificationArguments(args);
      assertCredentiallessValidationEnvironment(environment);
      const expectedRunBinding = await readCompletedRunBinding(
        runStateDir,
        runId
      );
      const authority =
        ownerAcceptanceAuthority ??
        (await loadOwnerAcceptanceAuthority(environment));
      const [value, ...artifactValues] = await Promise.all([
        readReviewedArtifact(receiptPath, 'readback'),
        ...expectedArtifactPaths.map((path, index) =>
          readReviewedArtifact(path, `expected artifact ${index + 1}`)
        ),
      ]);
      const parsedArtifacts = artifactValues.map((artifactValue) => {
        const parsed = ReviewedQualificationArtifactSchema.safeParse(
          JSON.parse(artifactValue)
        );
        if (!parsed.success)
          throw new Error('reviewed local artifact receipt is invalid');
        return parsed.data;
      });
      const [artifactA, artifactB] = parsedArtifacts;
      if (!artifactA || !artifactB)
        throw new Error('two reviewed local artifact receipts are required');
      const expectedArtifacts: readonly [
        ReviewedQualificationArtifact,
        ReviewedQualificationArtifact,
      ] = [artifactA, artifactB];
      const result = qualifyCloudflareEvidenceReadback(JSON.parse(value), {
        expectedArtifacts,
        expectedScriptName: scriptName,
        expectedOwnerApprovalId,
        ownerAcceptanceAuthority: authority,
        expectedRunBinding,
      });
      if (!result.ok) throw new Error(result.reason);
      io.stdout(`${JSON.stringify(result.qualification)}\n`);
      return;
    }
    parseQualificationArguments(args);
  } catch (error: unknown) {
    io.stderr(
      `${error instanceof Error ? error.message : 'qualification failed'}\n`
    );
    io.setExitCode(1);
  }
}

export function runQualificationCliFromProcess() {
  void runQualificationCli(process.argv.slice(2), process.env, {
    stdout: (value) => process.stdout.write(value),
    stderr: (value) => process.stderr.write(value),
    setExitCode: (code) => {
      process.exitCode = code;
    },
  });
}
