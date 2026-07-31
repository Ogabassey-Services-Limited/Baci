import {
  lstat,
  mkdir,
  open,
  readdir,
  readFile,
  rename,
} from 'node:fs/promises';
import { basename, isAbsolute, join } from 'node:path';

type EvidencePhase =
  | 'prepared'
  | 'mutated'
  | 'cleanup_verified'
  | 'write_token_revoked'
  | 'read_token_revoked'
  | 'proof_complete'
  | 'closed_stop'
  | 'cleanup_incomplete_stop';
export type CloudflareEvidenceRunJournal = {
  runId: string;
  approvalId: string;
  policyId: string;
  writeTokenId: string;
  readTokenId: string;
  accountId: string;
  zoneId: string;
  plannedResources: readonly string[];
  preInventorySha256: string;
  expectedProbeCount: number;
  mutations: Record<string, string>;
  phase: EvidencePhase;
  cleanupAttempts: number;
  readBackEvidence: readonly string[];
  probeResults: readonly string[];
  cleanupIncomplete: boolean;
  writeTokenRevokedAt?: string;
  readTokenRevokedAt?: string;
  writeTokenRevocationReceipt?: TokenRevocationReceipt;
  readTokenRevocationReceipt?: TokenRevocationReceipt;
};
export type TokenRevocationReceipt = Readonly<{
  tokenId: string;
  status: 'revoked';
  providerReceiptSha256: string;
  observedAt: string;
}>;
const verifiedRevocations = new WeakSet<object>();
declare const verifiedTokenRevocation: unique symbol;
export type VerifiedTokenRevocation = TokenRevocationReceipt &
  Readonly<{ [verifiedTokenRevocation]: true }>;
export type TokenRevocationClient = Readonly<{
  revoke(
    tokenId: string
  ): Promise<Readonly<{ tokenId: string; auditReceiptSha256: string }>>;
  readBack(tokenId: string): Promise<
    Readonly<{
      tokenId: string;
      status: 'inactive' | 'absent' | 'active';
      auditReceiptSha256: string;
      observedAt: string;
    }>
  >;
}>;
export type EvidenceRunInput = Omit<
  CloudflareEvidenceRunJournal,
  | 'mutations'
  | 'phase'
  | 'cleanupAttempts'
  | 'readBackEvidence'
  | 'probeResults'
  | 'cleanupIncomplete'
  | 'writeTokenRevokedAt'
  | 'readTokenRevokedAt'
  | 'writeTokenRevocationReceipt'
  | 'readTokenRevocationReceipt'
>;

function journalPath(stateDir: string, runId: string) {
  if (basename(runId) !== runId || !/^[a-zA-Z0-9_-]+$/.test(runId))
    throw new Error('journal run ID is invalid');
  return join(stateDir, `${runId}.json`);
}
async function verifyDirectory(stateDir: string) {
  if (!isAbsolute(stateDir))
    throw new Error('EVIDENCE_RUN_STATE_DIR must be absolute');
  await mkdir(stateDir, { recursive: true, mode: 0o700 });
  const stat = await lstat(stateDir);
  if (stat.isSymbolicLink() || !stat.isDirectory() || (stat.mode & 0o077) !== 0)
    throw new Error(
      'EVIDENCE_RUN_STATE_DIR is not private durable operator storage'
    );
}
async function writeJournal(
  stateDir: string,
  journal: CloudflareEvidenceRunJournal
) {
  const target = journalPath(stateDir, journal.runId);
  const temp = `${target}.${process.pid}.tmp`;
  const handle = await open(temp, 'wx', 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(journal)}\n`);
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(temp, target);
  const directory = await open(stateDir, 'r');
  try {
    await directory.sync();
  } finally {
    await directory.close();
  }
}
async function readJournal(stateDir: string, runId: string) {
  await verifyDirectory(stateDir);
  const target = journalPath(stateDir, runId);
  const stat = await lstat(target);
  if (stat.isSymbolicLink() || !stat.isFile() || (stat.mode & 0o077) !== 0)
    throw new Error('journal file is not private regular storage');
  return JSON.parse(
    await readFile(target, 'utf8')
  ) as CloudflareEvidenceRunJournal;
}
const terminal = new Set<EvidencePhase>([
  'proof_complete',
  'closed_stop',
  'cleanup_incomplete_stop',
]);
const revocationTerminal = new Set<EvidencePhase>([
  'proof_complete',
  'closed_stop',
]);

/** Opens the one private, journal-fenced evidence run permitted in a state directory. */
export async function openEvidenceRun(
  stateDir: string,
  input: EvidenceRunInput
): Promise<CloudflareEvidenceRunJournal> {
  await verifyDirectory(stateDir);
  const active = await readdir(stateDir);
  for (const name of active.filter((entry) => entry.endsWith('.json'))) {
    const existing = await readJournal(stateDir, name.slice(0, -5));
    if (!terminal.has(existing.phase))
      throw new Error('an evidence run is already active');
  }
  if (
    !Number.isInteger(input.expectedProbeCount) ||
    input.expectedProbeCount < 1
  )
    throw new Error('expected probe count is invalid');
  const journal: CloudflareEvidenceRunJournal = {
    ...input,
    mutations: {},
    phase: 'prepared',
    cleanupAttempts: 0,
    readBackEvidence: [],
    probeResults: [],
    cleanupIncomplete: false,
  };
  await writeJournal(stateDir, journal);
  return journal;
}
export async function recordEvidenceMutation(
  stateDir: string,
  runId: string,
  resourceName: string,
  providerId: string
) {
  const journal = await readJournal(stateDir, runId);
  if (!journal.plannedResources.includes(resourceName))
    throw new Error('resource name was not pre-journaled');
  journal.mutations[resourceName] = providerId;
  journal.phase = 'mutated';
  await writeJournal(stateDir, journal);
  return journal;
}
/** Persists the exact bounded synthetic-probe receipt set before cleanup begins. */
export async function recordEvidenceProbeResults(
  stateDir: string,
  runId: string,
  probeResults: readonly string[]
) {
  const journal = await readJournal(stateDir, runId);
  if (
    probeResults.length !== journal.expectedProbeCount ||
    new Set(probeResults).size !== probeResults.length ||
    probeResults.some((result) => !result)
  )
    throw new Error('probe results do not match the expected bounded count');
  journal.probeResults = [...probeResults];
  await writeJournal(stateDir, journal);
  return journal;
}
export async function recordEvidencePhase(
  stateDir: string,
  runId: string,
  phase: EvidencePhase,
  details: Partial<
    Pick<
      CloudflareEvidenceRunJournal,
      | 'cleanupAttempts'
      | 'readBackEvidence'
      | 'cleanupIncomplete'
      | 'writeTokenRevokedAt'
      | 'readTokenRevokedAt'
    >
  > = {}
) {
  const journal = await readJournal(stateDir, runId);
  if (phase === 'write_token_revoked' || phase === 'read_token_revoked')
    throw new Error('token revocation requires an authenticated receipt');
  if ('writeTokenRevokedAt' in details || 'readTokenRevokedAt' in details)
    throw new Error('caller timestamps cannot prove token revocation');
  Object.assign(journal, details);
  if (
    revocationTerminal.has(phase) &&
    (!journal.writeTokenRevokedAt || !journal.readTokenRevokedAt)
  )
    throw new Error(
      'terminal evidence phase requires verified token revocation'
    );
  journal.phase = phase;
  await writeJournal(stateDir, journal);
  return journal;
}
function validateRevocationReceipt(
  expectedTokenId: string,
  receipt: TokenRevocationReceipt
) {
  if (
    receipt.tokenId !== expectedTokenId ||
    receipt.status !== 'revoked' ||
    !/^[a-f0-9]{64}$/.test(receipt.providerReceiptSha256) ||
    Number.isNaN(new Date(receipt.observedAt).valueOf())
  )
    throw new Error('token revocation receipt does not match the journal');
}

/** Records only a provider-read-back revocation receipt for the journaled token ID. */
export async function recordTokenRevocation(
  stateDir: string,
  runId: string,
  kind: 'write' | 'read',
  receipt: VerifiedTokenRevocation
) {
  if (!verifiedRevocations.has(receipt))
    throw new Error('token revocation must come from a provider operation');
  const journal = await readJournal(stateDir, runId);
  validateRevocationReceipt(
    kind === 'write' ? journal.writeTokenId : journal.readTokenId,
    receipt
  );
  if (kind === 'write') {
    journal.writeTokenRevocationReceipt = receipt;
    journal.writeTokenRevokedAt = receipt.observedAt;
    journal.phase = 'write_token_revoked';
  } else {
    if (!journal.writeTokenRevocationReceipt)
      throw new Error('write token revocation must be verified first');
    journal.readTokenRevocationReceipt = receipt;
    journal.readTokenRevokedAt = receipt.observedAt;
    journal.phase = 'read_token_revoked';
  }
  await writeJournal(stateDir, journal);
  return journal;
}
/** Revokes the exact journaled token and reads it back before minting authority. */
export async function revokeEvidenceRunToken(
  stateDir: string,
  runId: string,
  kind: 'write' | 'read',
  client: TokenRevocationClient
) {
  const journal = await readJournal(stateDir, runId);
  const tokenId = kind === 'write' ? journal.writeTokenId : journal.readTokenId;
  const revoked = await client.revoke(tokenId);
  if (
    revoked.tokenId !== tokenId ||
    !/^[a-f0-9]{64}$/.test(revoked.auditReceiptSha256)
  )
    throw new Error('provider revoked the wrong token');
  const readBack = await client.readBack(tokenId);
  if (
    readBack.tokenId !== tokenId ||
    !['inactive', 'absent'].includes(readBack.status) ||
    !/^[a-f0-9]{64}$/.test(readBack.auditReceiptSha256)
  )
    throw new Error('provider readback did not verify token revocation');
  const receipt = Object.freeze({
    tokenId,
    status: 'revoked' as const,
    providerReceiptSha256: readBack.auditReceiptSha256,
    observedAt: readBack.observedAt,
  }) as VerifiedTokenRevocation;
  verifiedRevocations.add(receipt);
  return recordTokenRevocation(stateDir, runId, kind, receipt);
}
export function loadEvidenceRunForCleanup(stateDir: string, runId: string) {
  return readJournal(stateDir, runId);
}
