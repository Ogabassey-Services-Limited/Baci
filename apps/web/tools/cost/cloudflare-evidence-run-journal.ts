import {
  lstat,
  mkdir,
  open,
  readdir,
  readFile,
  rename,
  unlink,
} from 'node:fs/promises';
import { basename, isAbsolute, join } from 'node:path';

type EvidencePhase =
  | 'prepared'
  | 'mutated'
  | 'cleanup_verified'
  | 'write_token_revoked'
  | 'read_token_revoked'
  | 'proof_complete'
  | 'closed_stop';
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
  writeTokenRevokedAt?: string;
  readTokenRevokedAt?: string;
};
export type EvidenceRunInput = Omit<
  CloudflareEvidenceRunJournal,
  | 'mutations'
  | 'phase'
  | 'cleanupAttempts'
  | 'readBackEvidence'
  | 'writeTokenRevokedAt'
  | 'readTokenRevokedAt'
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
  const target = journalPath(stateDir, runId);
  const stat = await lstat(target);
  if (stat.isSymbolicLink() || !stat.isFile() || (stat.mode & 0o077) !== 0)
    throw new Error('journal file is not private regular storage');
  return JSON.parse(
    await readFile(target, 'utf8')
  ) as CloudflareEvidenceRunJournal;
}
const terminal = new Set<EvidencePhase>(['proof_complete', 'closed_stop']);

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
export async function recordEvidencePhase(
  stateDir: string,
  runId: string,
  phase: EvidencePhase,
  details: Partial<
    Pick<
      CloudflareEvidenceRunJournal,
      | 'cleanupAttempts'
      | 'readBackEvidence'
      | 'writeTokenRevokedAt'
      | 'readTokenRevokedAt'
    >
  > = {}
) {
  const journal = await readJournal(stateDir, runId);
  Object.assign(journal, details);
  if (
    terminal.has(phase) &&
    (!journal.writeTokenRevokedAt || !journal.readTokenRevokedAt)
  )
    throw new Error(
      'terminal evidence phase requires verified token revocation'
    );
  journal.phase = phase;
  await writeJournal(stateDir, journal);
  return journal;
}
export function loadEvidenceRunForCleanup(stateDir: string, runId: string) {
  return readJournal(stateDir, runId);
}
export async function discardEvidenceRunTempFile(path: string) {
  if (!path.endsWith('.tmp'))
    throw new Error('only journal temp files may be discarded');
  await unlink(path);
}
