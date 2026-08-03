const evidencePhases = [
  'prepared',
  'mutated',
  'cleanup_verified',
  'cleanup_incomplete_stop',
  'write_token_revoked',
  'measurement_complete_pending_read_revocation',
  'read_token_revoked',
  'proof_complete',
  'closed_stop',
] as const;

export type EvidencePhase = (typeof evidencePhases)[number];

const terminalPhases = new Set<EvidencePhase>([
  'proof_complete',
  'closed_stop',
]);

/** Defines the bounded journal phase vocabulary and terminal-state predicate. */
export const evidenceJournalPhases = Object.freeze({
  has(value: unknown): value is EvidencePhase {
    return (
      typeof value === 'string' &&
      evidencePhases.includes(value as EvidencePhase)
    );
  },
  isTerminal(phase: EvidencePhase) {
    return terminalPhases.has(phase);
  },
});
