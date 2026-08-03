import { describe, expect, it } from 'vitest';
import { evidenceJournalPhases } from './cloudflare-evidence-run-journal-phases';

describe('cloudflare evidence journal phases', () => {
  it('recognizes the read-revocation phase and only terminal closure phases', () => {
    expect(
      evidenceJournalPhases.has('measurement_complete_pending_read_revocation')
    ).toBe(true);
    expect(evidenceJournalPhases.isTerminal('proof_complete')).toBe(true);
    expect(evidenceJournalPhases.isTerminal('closed_stop')).toBe(true);
    expect(evidenceJournalPhases.isTerminal('read_token_revoked')).toBe(false);
  });

  it('rejects arbitrary persisted journal phase values', () => {
    expect(evidenceJournalPhases.has('unreviewed_phase')).toBe(false);
  });
});
