import { execFile } from 'node:child_process';
import { isAbsolute } from 'node:path';
import { promisify } from 'node:util';
import { z } from 'zod';
import {
  calculateReviewedPolicySha256,
  verifyPrepareAuthority,
} from './cloudflare-evidence-prepare-authority';
import {
  type EvidenceRunInput,
  openEvidenceRun,
  REVIEWED_PROBE_COUNT,
} from './cloudflare-evidence-run-journal';
import {
  readEvidenceRunnerModuleDescriptor,
  verifyReviewedEvidenceRunnerModule,
} from './cloudflare-evidence-runner-modules';

export type {
  PrepareAuthorityInput,
  VerifiedPrepareAuthority,
} from './cloudflare-evidence-prepare-authority';
export { calculateReviewedPolicySha256, verifyPrepareAuthority };

const boundedId = z.string().min(1).max(128).regex(/^\S+$/);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const toolingSha = z.string().regex(/^[a-f0-9]{40}$/);
const execFileAsync = promisify(execFile);
const prepareInputSchema = z
  .object({
    runId: z.string().regex(/^[a-f0-9]{32}$/),
    approvalId: boundedId,
    policyId: boundedId,
    toolingMergeSha: toolingSha,
    writeTokenId: boundedId,
    readTokenId: boundedId,
    readPolicySha256: sha256,
    accountId: boundedId,
    zoneId: boundedId,
    plannedResources: z.array(boundedId).length(1),
    preInventorySha256: sha256,
    expectedProbeCount: z.literal(REVIEWED_PROBE_COUNT),
  })
  .strict()
  .superRefine((value, context) => {
    if (new Set(value.plannedResources).size !== value.plannedResources.length)
      context.addIssue({
        code: 'custom',
        message: 'planned resources must be unique',
      });
    if (value.plannedResources[0] !== `baci-evidence-${value.runId}`)
      context.addIssue({
        code: 'custom',
        message: 'planned resource must be the deterministic run resource',
      });
  });

const optionNames = {
  '--run-id': 'runId',
  '--approval-id': 'approvalId',
  '--policy-id': 'policyId',
  '--tooling-merge-sha': 'toolingMergeSha',
  '--write-token-id': 'writeTokenId',
  '--read-token-id': 'readTokenId',
  '--read-policy-sha256': 'readPolicySha256',
  '--account-id': 'accountId',
  '--zone-id': 'zoneId',
  '--planned-resource': 'plannedResources',
  '--pre-inventory-sha256': 'preInventorySha256',
  '--expected-probe-count': 'expectedProbeCount',
} as const;

function parseArguments(args: readonly string[]): EvidenceRunInput {
  if (args[0] !== '--prepare' || args.length < 3 || args.length % 2 === 0)
    throw new Error('prepare options are invalid');
  const values: Record<string, unknown> = { plannedResources: [] };
  for (let index = 1; index < args.length; index += 2) {
    const option = args[index] as keyof typeof optionNames;
    const value = args[index + 1];
    const field = optionNames[option];
    if (!field || !value) throw new Error('prepare options are invalid');
    if (field === 'plannedResources') {
      (values.plannedResources as string[]).push(value);
      continue;
    }
    if (field in values) throw new Error('prepare option is duplicated');
    values[field] = field === 'expectedProbeCount' ? Number(value) : value;
  }
  return prepareInputSchema.parse(values);
}

function argumentsFor(input: EvidenceRunInput) {
  if (input.expectedProbeCount !== REVIEWED_PROBE_COUNT)
    throw new Error('expected probe count is fixed by the reviewed matrix');
  return [
    '--prepare',
    '--run-id',
    input.runId,
    '--approval-id',
    input.approvalId,
    '--policy-id',
    input.policyId,
    '--tooling-merge-sha',
    input.toolingMergeSha,
    '--write-token-id',
    input.writeTokenId,
    '--read-token-id',
    input.readTokenId,
    '--read-policy-sha256',
    input.readPolicySha256,
    '--account-id',
    input.accountId,
    '--zone-id',
    input.zoneId,
    ...input.plannedResources.flatMap((resource) => [
      '--planned-resource',
      resource,
    ]),
    '--pre-inventory-sha256',
    input.preInventorySha256,
    '--expected-probe-count',
    String(REVIEWED_PROBE_COUNT),
  ];
}

const runnerFields = Object.freeze({
  mutation: {
    path: 'mutationRunnerModulePath',
    sha256: 'mutationRunnerModuleSha256',
  },
  measurement: {
    path: 'measurementRunnerModulePath',
    sha256: 'measurementRunnerModuleSha256',
  },
} as const);

async function run(
  args: readonly string[],
  environment: Readonly<Record<string, string | undefined>>,
  write: (value: string) => void
) {
  if (environment.CLOUDFLARE_WRITE_TOKEN || environment.CLOUDFLARE_READ_TOKEN)
    throw new Error('prepare must not inherit a Cloudflare credential');
  const stateDir = environment.EVIDENCE_RUN_STATE_DIR;
  if (!stateDir || !isAbsolute(stateDir))
    throw new Error('absolute EVIDENCE_RUN_STATE_DIR is required');
  const input = parseArguments(args);
  const workspaceRoot = environment.EVIDENCE_WORKSPACE_ROOT ?? process.cwd();
  if (!isAbsolute(workspaceRoot))
    throw new Error('absolute EVIDENCE_WORKSPACE_ROOT is required');
  const { stdout: head } = await execFileAsync('git', [
    '-C',
    workspaceRoot,
    'rev-parse',
    '--verify',
    'HEAD',
  ]);
  if (head.trim() !== input.toolingMergeSha)
    throw new Error('tooling merge SHA does not match the checked-out commit');
  const { stdout: status } = await execFileAsync('git', [
    '-C',
    workspaceRoot,
    'status',
    '--porcelain',
    '--untracked-files=all',
  ]);
  if (status.trim()) throw new Error('tooling worktree is not clean');
  const reviewedAuthority = await verifyPrepareAuthority(input, environment);
  const runnerDescriptors = await Promise.all([
    ['mutation', readEvidenceRunnerModuleDescriptor(environment, 'mutation')],
    [
      'measurement',
      readEvidenceRunnerModuleDescriptor(environment, 'measurement'),
    ],
  ] as const).then(async ([mutation, measurement]) => {
    const [verifiedMutation, verifiedMeasurement] = await Promise.all([
      verifyReviewedEvidenceRunnerModule(
        workspaceRoot,
        input.toolingMergeSha,
        mutation[1]
      ),
      verifyReviewedEvidenceRunnerModule(
        workspaceRoot,
        input.toolingMergeSha,
        measurement[1]
      ),
    ]);
    return { mutation: verifiedMutation, measurement: verifiedMeasurement };
  });
  const journal = await openEvidenceRun(stateDir, {
    ...input,
    ...reviewedAuthority,
    [runnerFields.mutation.path]: runnerDescriptors.mutation.path,
    [runnerFields.mutation.sha256]: runnerDescriptors.mutation.sha256,
    [runnerFields.measurement.path]: runnerDescriptors.measurement.path,
    [runnerFields.measurement.sha256]: runnerDescriptors.measurement.sha256,
  });
  write(`${JSON.stringify({ runId: journal.runId, nextPhase: 'mutate' })}\n`);
}

/** Owns the credentialless prepare command's parsing, serialization, and execution. */
export const cloudflareEvidencePrepare = Object.freeze({
  parseArguments,
  argumentsFor,
  run,
});
