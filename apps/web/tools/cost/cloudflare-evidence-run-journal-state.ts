import { randomUUID } from 'node:crypto';
import { lstat, mkdir, open, rename, rm } from 'node:fs/promises';
import { basename, isAbsolute, join, parse, sep } from 'node:path';
import { releaseActiveRunLock } from './cloudflare-evidence-run-lock';

export type EvidencePhase =
  | 'prepared'
  | 'mutated'
  | 'cleanup_verified'
  | 'cleanup_incomplete_stop'
  | 'write_token_revoked'
  | 'read_token_revoked'
  | 'proof_complete'
  | 'closed_stop';
export const REVIEWED_PROBE_COUNT = 2;
export const RUN_ID_PATTERN = /^[a-f0-9]{32}$/;

export type TokenRevocationReceipt = Readonly<{
  tokenId: string;
  status: 'revoked';
  providerReceiptSha256: string;
  observedAt: string;
}>;

export type CleanupVerificationProviderReceipt = Readonly<{
  status: 'absent';
  inventorySha256: string;
  providerReceiptSha256: string;
  observedAt: string;
}>;

export type CleanupVerificationClient = Readonly<{
  verifyCleanup(
    runId: string,
    expectedInventorySha256: string
  ): Promise<CleanupVerificationProviderReceipt>;
}>;

export type MeasurementReceipt = Readonly<{
  providerReceiptSha256: string;
  observedAt: string;
}>;

export type CloudflareEvidenceRunJournal = {
  runId: string;
  approvalId: string;
  policyId: string;
  policySha256?: string;
  /** Fingerprint of the separately reviewed read-only measurement policy. */
  readPolicySha256: string;
  /** Optional fingerprint of the separately approved cleanup replacement policy. */
  cleanupPolicySha256?: string;
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
  measurementVerifiedAt?: string;
  measurementReceiptSha256?: string;
  writeTokenRevokedAt?: string;
  readTokenRevokedAt?: string;
  writeTokenRevocationReceipt?: TokenRevocationReceipt;
  readTokenRevocationReceipt?: TokenRevocationReceipt;
  cleanupWriteTokenId?: string;
  cleanupWriteTokenRevokedAt?: string;
  cleanupWriteTokenRevocationReceipt?: TokenRevocationReceipt;
  cleanupWriteTokenRevocations?: readonly TokenRevocationReceipt[];
  mutationRunnerModulePath?: string;
  mutationRunnerModuleSha256?: string;
  measurementRunnerModulePath?: string;
  measurementRunnerModuleSha256?: string;
};

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
  | 'measurementVerifiedAt'
  | 'measurementReceiptSha256'
  | 'writeTokenRevokedAt'
  | 'readTokenRevokedAt'
  | 'writeTokenRevocationReceipt'
  | 'readTokenRevocationReceipt'
  | 'cleanupWriteTokenId'
  | 'cleanupWriteTokenRevokedAt'
  | 'cleanupWriteTokenRevocationReceipt'
  | 'cleanupWriteTokenRevocations'
>;

export const terminal = new Set<EvidencePhase>([
  'proof_complete',
  'closed_stop',
]);
const hash = /^[a-f0-9]{64}$/;

export function journalPath(stateDir: string, runId: string) {
  if (basename(runId) !== runId || !RUN_ID_PATTERN.test(runId))
    throw new Error('journal run ID is invalid');
  return join(stateDir, `${runId}.json`);
}

export async function verifyDirectory(stateDir: string) {
  if (!isAbsolute(stateDir))
    throw new Error('EVIDENCE_RUN_STATE_DIR must be absolute');
  const root = parse(stateDir).root;
  let current = root;
  for (const part of stateDir.slice(root.length).split(sep).filter(Boolean)) {
    current = join(current, part);
    try {
      const stat = await lstat(current);
      // macOS exposes `/var` (and, on some hosts, `/tmp`) as stable system
      // aliases. They are the OS-owned roots used by `os.tmpdir`; reject all
      // other symlinked ancestors so an operator cannot redirect authority.
      if (
        (stat.isSymbolicLink() && current !== '/var' && current !== '/tmp') ||
        (!stat.isSymbolicLink() && !stat.isDirectory())
      )
        throw new Error(
          'EVIDENCE_RUN_STATE_DIR is not private durable operator storage'
        );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      await mkdir(current, { mode: 0o700 });
    }
  }
  const stat = await lstat(stateDir);
  if (stat.isSymbolicLink() || !stat.isDirectory() || (stat.mode & 0o077) !== 0)
    throw new Error(
      'EVIDENCE_RUN_STATE_DIR is not private durable operator storage'
    );
}

export async function writeJournalUnlocked(
  stateDir: string,
  journal: CloudflareEvidenceRunJournal
) {
  const target = journalPath(stateDir, journal.runId);
  // A unique temp name prevents a crashed writer from blocking every future
  // transition with a stale deterministic `<pid>.tmp` path.
  const temp = `${target}.${process.pid}.${randomUUID()}.tmp`;
  const handle = await open(temp, 'wx', 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(journal)}\n`);
    await handle.sync();
  } catch (error) {
    await rm(temp, { force: true }).catch(() => undefined);
    throw error;
  } finally {
    await handle.close();
  }
  try {
    await rename(temp, target);
  } catch (error) {
    await rm(temp, { force: true }).catch(() => undefined);
    throw error;
  }
  const directory = await open(stateDir, 'r');
  try {
    await directory.sync();
  } finally {
    await directory.close();
  }
  if (terminal.has(journal.phase))
    await releaseActiveRunLock(stateDir, journal.runId);
}

export function validDate(value: string) {
  return !Number.isNaN(new Date(value).valueOf());
}

export function hasReceipt(
  receipt: TokenRevocationReceipt | undefined,
  tokenId: string
) {
  return (
    tokenId.length > 0 &&
    receipt?.tokenId === tokenId &&
    receipt.status === 'revoked' &&
    hash.test(receipt.providerReceiptSha256) &&
    validDate(receipt.observedAt)
  );
}

export function assertTransition(
  journal: CloudflareEvidenceRunJournal,
  next: EvidencePhase
) {
  const allowed: Record<EvidencePhase, readonly EvidencePhase[]> = {
    prepared: ['mutated', 'cleanup_incomplete_stop'],
    mutated: ['mutated', 'cleanup_verified', 'cleanup_incomplete_stop'],
    cleanup_verified: ['write_token_revoked'],
    cleanup_incomplete_stop: ['mutated', 'write_token_revoked'],
    write_token_revoked: ['read_token_revoked'],
    read_token_revoked: ['proof_complete', 'closed_stop'],
    proof_complete: [],
    closed_stop: [],
  };
  if (
    journal.phase === next &&
    (next === 'mutated' || next === 'cleanup_incomplete_stop')
  )
    return;
  if (!allowed[journal.phase].includes(next))
    throw new Error(
      `invalid evidence phase transition: ${journal.phase} -> ${next}`
    );
}

export function assertTerminalPrerequisites(
  journal: CloudflareEvidenceRunJournal,
  phase: EvidencePhase
) {
  if (phase === 'proof_complete') {
    if (
      journal.phase !== 'read_token_revoked' ||
      Object.keys(journal.mutations).length === 0 ||
      journal.probeResults.length !== journal.expectedProbeCount ||
      new Set(journal.probeResults).size !== journal.probeResults.length ||
      !journal.cleanupVerifiedAt ||
      !journal.cleanupVerificationReceiptSha256 ||
      !hash.test(journal.cleanupVerificationReceiptSha256) ||
      !validDate(journal.cleanupVerifiedAt) ||
      !journal.measurementVerifiedAt ||
      !journal.measurementReceiptSha256 ||
      !hash.test(journal.measurementReceiptSha256) ||
      !validDate(journal.measurementVerifiedAt)
    )
      throw new Error(
        'proof_complete requires cleanup, probes, measurement, and revocation'
      );
  }
  if (phase === 'closed_stop' && !journal.cleanupIncomplete)
    throw new Error('closed_stop requires incomplete cleanup evidence');
  if (
    !hasReceipt(journal.writeTokenRevocationReceipt, journal.writeTokenId) ||
    !hasReceipt(journal.readTokenRevocationReceipt, journal.readTokenId) ||
    (journal.cleanupWriteTokenRevocations ?? []).some(
      (receipt) => !hasReceipt(receipt, receipt.tokenId)
    ) ||
    (journal.cleanupWriteTokenId !== undefined &&
      !hasReceipt(
        journal.cleanupWriteTokenRevocationReceipt,
        journal.cleanupWriteTokenId
      ))
  )
    throw new Error(
      'terminal evidence phase requires verified token revocation'
    );
}

/** Shape helper only; recordCleanupVerified authenticates through provider readback. */
export function createCleanupVerificationReceipt(
  inventorySha256: string,
  observedAt: string
) {
  if (!hash.test(inventorySha256) || !validDate(observedAt))
    throw new Error('cleanup verification receipt is invalid');
  return Object.freeze({
    status: 'absent' as const,
    inventorySha256,
    observedAt,
  });
}

export function isHash(value: string) {
  return hash.test(value);
}
