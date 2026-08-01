import { lstat, readdir, readFile } from 'node:fs/promises';
import { createEvidenceJournalTransitionOperations } from './cloudflare-evidence-run-journal-transitions';
import {
  acquireActiveRunLock,
  releaseActiveRunLock,
  withEvidenceRunTransitionLock,
} from './cloudflare-evidence-run-lock';
import { createTokenRevocationOperations } from './cloudflare-evidence-run-token-revocation';

export type {
  CleanupVerificationClient,
  CleanupVerificationProviderReceipt,
  CloudflareEvidenceRunJournal,
  EvidencePhase,
  EvidenceRunInput,
  MeasurementReceipt,
  TokenRevocationReceipt,
} from './cloudflare-evidence-run-journal-state';
export {
  assertTerminalPrerequisites,
  assertTransition,
  createCleanupVerificationReceipt,
  hasReceipt,
  isEvidencePhase,
  journalPath,
  REVIEWED_PROBE_COUNT,
  RUN_ID_PATTERN,
  terminal,
  validDate,
  verifyDirectory,
  writeJournalUnlocked,
} from './cloudflare-evidence-run-journal-state';
export type { TokenRevocationClient } from './cloudflare-evidence-run-token-revocation';

import type {
  CloudflareEvidenceRunJournal,
  EvidencePhase,
  EvidenceRunInput,
} from './cloudflare-evidence-run-journal-state';
import {
  isEvidencePhase,
  journalPath,
  REVIEWED_PROBE_COUNT,
  terminal,
  verifyDirectory,
  writeJournalUnlocked,
} from './cloudflare-evidence-run-journal-state';

export async function writeJournal(
  stateDir: string,
  journal: CloudflareEvidenceRunJournal
) {
  await verifyDirectory(stateDir);
  await withEvidenceRunTransitionLock(stateDir, journal.runId, () =>
    writeJournalUnlocked(stateDir, journal)
  );
}

export async function readJournal(stateDir: string, runId: string) {
  await verifyDirectory(stateDir);
  const target = journalPath(stateDir, runId);
  const stat = await lstat(target);
  if (stat.isSymbolicLink() || !stat.isFile() || (stat.mode & 0o077) !== 0)
    throw new Error('journal file is not private regular storage');
  const parsed: unknown = JSON.parse(await readFile(target, 'utf8'));
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !isEvidencePhase((parsed as { phase?: unknown }).phase)
  )
    throw new Error('journal phase is invalid');
  return parsed as CloudflareEvidenceRunJournal;
}

const transitionJournal = <T>(
  stateDir: string,
  runId: string,
  transition: (journal: CloudflareEvidenceRunJournal) => Promise<T> | T
) => {
  return withEvidenceRunTransitionLock(stateDir, runId, async () => {
    const journal = await readJournal(stateDir, runId);
    const result = await transition(journal);
    await writeJournalUnlocked(stateDir, journal);
    return result;
  });
};

/** Opens the one private, journal-fenced evidence run permitted in a state directory. */
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
      if (name === `${input.runId}.json`)
        throw new Error('journal run ID already exists');
      const existing = await readJournal(stateDir, name.slice(0, -5));
      if (!terminal.has(existing.phase))
        throw new Error('an evidence run is already active');
    }
    if (input.expectedProbeCount !== REVIEWED_PROBE_COUNT)
      throw new Error('expected probe count is not the reviewed probe matrix');
    if (input.writeTokenId === input.readTokenId)
      throw new Error('write and read tokens must be distinct');
    if (!/^[a-f0-9]{64}$/.test(input.readPolicySha256))
      throw new Error('read policy fingerprint is invalid');
    if (
      input.cleanupPolicySha256 !== undefined &&
      !/^[a-f0-9]{64}$/.test(input.cleanupPolicySha256)
    )
      throw new Error('cleanup policy fingerprint is invalid');
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

const transitionOperations =
  createEvidenceJournalTransitionOperations(transitionJournal);
export const {
  recordCleanupVerified,
  recordCleanupWriteToken,
  recordEvidenceMeasurement,
  recordEvidenceMutation,
  recordEvidencePhase,
  recordEvidenceProbeResults,
} = transitionOperations;

const tokenRevocationOperations = createTokenRevocationOperations(
  readJournal,
  writeJournal,
  transitionJournal
);
export const { recordTokenRevocation, revokeEvidenceRunToken } =
  tokenRevocationOperations;

export function loadEvidenceRunForCleanup(stateDir: string, runId: string) {
  return readJournal(stateDir, runId);
}
