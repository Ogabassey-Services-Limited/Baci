import {
  lstat,
  mkdir,
  open,
  readdir,
  readFile,
  rename,
} from 'node:fs/promises';
import { basename, isAbsolute, join } from 'node:path';
import {
  acquireActiveRunLock,
  releaseActiveRunLock,
} from './cloudflare-evidence-run-lock';

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
  toolingMergeSha: string;
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
  cleanupVerifiedAt?: string;
  cleanupVerificationReceiptSha256?: string;
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
const verifiedCleanupVerification = Symbol('verifiedCleanupVerification');
export type VerifiedCleanupVerification = Readonly<{
  status: 'absent';
  inventorySha256: string;
  observedAt: string;
  [verifiedCleanupVerification]: true;
}>;
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
  | 'cleanupVerifiedAt'
  | 'cleanupVerificationReceiptSha256'
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
  if (terminal.has(journal.phase))
    await releaseActiveRunLock(stateDir, journal.runId);
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
const terminal = new Set<EvidencePhase>(['proof_complete', 'closed_stop']);
const revocationTerminal = new Set<EvidencePhase>([
  'proof_complete',
  'closed_stop',
]);

export async function openEvidenceRun(
  stateDir: string,
  input: EvidenceRunInput
): Promise<CloudflareEvidenceRunJournal> {
  await verifyDirectory(stateDir);
  await acquireActiveRunLock(stateDir, input.runId, {
    readJournal,
    isTerminal: (phase) => terminal.has(phase as EvidencePhase),
  });
  try {
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
  } catch (error) {
    await releaseActiveRunLock(stateDir, input.runId);
    throw error;
  }
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
  if (phase === 'cleanup_verified')
    throw new Error('cleanup verification requires an authenticated receipt');
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

export function createCleanupVerificationReceipt(
  inventorySha256: string,
  observedAt: string
): VerifiedCleanupVerification {
  if (
    !/^[a-f0-9]{64}$/.test(inventorySha256) ||
    Number.isNaN(new Date(observedAt).valueOf())
  )
    throw new Error('cleanup verification receipt is invalid');
  return Object.freeze({
    status: 'absent' as const,
    inventorySha256,
    observedAt,
    [verifiedCleanupVerification]: true as const,
  });
}

export async function recordCleanupVerified(
  stateDir: string,
  runId: string,
  receipt: VerifiedCleanupVerification
) {
  if (receipt[verifiedCleanupVerification] !== true)
    throw new Error('cleanup verification must come from provider readback');
  const journal = await readJournal(stateDir, runId);
  if (journal.phase !== 'mutated')
    throw new Error('cleanup verification requires a mutated run');
  if (journal.cleanupIncomplete || journal.phase === 'cleanup_incomplete_stop')
    throw new Error('incomplete cleanup cannot be marked verified');
  if (receipt.inventorySha256 !== journal.preInventorySha256)
    throw new Error('cleanup inventory receipt does not match the journal');
  journal.cleanupVerifiedAt = receipt.observedAt;
  journal.cleanupVerificationReceiptSha256 = receipt.inventorySha256;
  journal.phase = 'cleanup_verified';
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

export async function recordTokenRevocation(
  stateDir: string,
  runId: string,
  kind: 'write' | 'read',
  receipt: TokenRevocationReceipt,
  client: Pick<TokenRevocationClient, 'readBack'>
) {
  const journal = await readJournal(stateDir, runId);
  validateRevocationReceipt(
    kind === 'write' ? journal.writeTokenId : journal.readTokenId,
    receipt
  );
  const providerReadBack = await client.readBack(receipt.tokenId);
  if (
    providerReadBack.tokenId !== receipt.tokenId ||
    !['inactive', 'absent'].includes(providerReadBack.status) ||
    providerReadBack.auditReceiptSha256 !== receipt.providerReceiptSha256 ||
    providerReadBack.observedAt !== receipt.observedAt
  )
    throw new Error('serialized token revocation receipt is not verified');
  if (kind === 'write') {
    journal.writeTokenRevocationReceipt = receipt;
    journal.writeTokenRevokedAt = receipt.observedAt;
    journal.phase = 'write_token_revoked';
  } else {
    if (!journal.writeTokenRevocationReceipt)
      throw new Error('write token revocation must be verified first');
    journal.readTokenRevocationReceipt = receipt;
    journal.readTokenRevokedAt = receipt.observedAt;
    journal.phase = journal.cleanupIncomplete
      ? 'closed_stop'
      : 'read_token_revoked';
  }
  await writeJournal(stateDir, journal);
  return journal;
}
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
  });
  return recordTokenRevocation(stateDir, runId, kind, receipt, client);
}
export function loadEvidenceRunForCleanup(stateDir: string, runId: string) {
  return readJournal(stateDir, runId);
}
