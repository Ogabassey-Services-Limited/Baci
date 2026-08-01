import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { z } from 'zod';
import {
  type EvidenceRunInput,
  openEvidenceRun,
} from './cloudflare-evidence-run-journal';

const boundedId = z.string().min(1).max(128).regex(/^\S+$/);
const execFileAsync = promisify(execFile);
const prepareInputSchema = z
  .object({
    runId: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[a-zA-Z0-9_-]+$/),
    approvalId: boundedId,
    policyId: boundedId,
    toolingMergeSha: z.string().regex(/^[a-f0-9]{40}$/),
    writeTokenId: boundedId,
    readTokenId: boundedId,
    accountId: boundedId,
    zoneId: boundedId,
    plannedResources: z.array(boundedId).min(1).max(32),
    preInventorySha256: z.string().regex(/^[a-f0-9]{64}$/),
    expectedProbeCount: z.number().int().min(1).max(100),
  })
  .strict()
  .superRefine((value, context) => {
    if (new Set(value.plannedResources).size !== value.plannedResources.length)
      context.addIssue({
        code: 'custom',
        message: 'planned resources must be unique',
      });
    if (
      value.plannedResources.some((resource) => !resource.includes(value.runId))
    )
      context.addIssue({
        code: 'custom',
        message: 'planned resources must bind the run ID',
      });
  });

const optionNames = {
  '--run-id': 'runId',
  '--approval-id': 'approvalId',
  '--policy-id': 'policyId',
  '--tooling-merge-sha': 'toolingMergeSha',
  '--write-token-id': 'writeTokenId',
  '--read-token-id': 'readTokenId',
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
    String(input.expectedProbeCount),
  ];
}

async function run(
  args: readonly string[],
  environment: Readonly<Record<string, string | undefined>>,
  write: (value: string) => void
) {
  if (environment.CLOUDFLARE_WRITE_TOKEN || environment.CLOUDFLARE_READ_TOKEN)
    throw new Error('prepare must not inherit a Cloudflare credential');
  const stateDir = environment.EVIDENCE_RUN_STATE_DIR;
  if (!stateDir) throw new Error('absolute EVIDENCE_RUN_STATE_DIR is required');
  const input = parseArguments(args);
  const workspaceRoot = environment.EVIDENCE_WORKSPACE_ROOT ?? process.cwd();
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
  const journal = await openEvidenceRun(stateDir, input);
  write(`${JSON.stringify({ runId: journal.runId, nextPhase: 'mutate' })}\n`);
}

/** Owns the credentialless prepare command's parsing, serialization, and execution. */
export const cloudflareEvidencePrepare = Object.freeze({
  parseArguments,
  argumentsFor,
  run,
});
