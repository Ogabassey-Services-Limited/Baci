import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { createRemediationState } from './remediation-state.mjs';

const candidate = {
  fingerprint: 'issue-1',
  lastSeen: '2026-08-04T15:46:50Z',
  occurrences: 2,
};

describe('remediation state', () => {
  it('suppresses an observation after it has been handled', () => {
    const directory = mkdtempSync(join(tmpdir(), 'remediation-state-'));
    const path = join(directory, 'handled.json');
    const state = createRemediationState({ path });

    assert.deepEqual(state.pending([candidate]), [candidate]);
    state.mark([candidate]);

    const reloaded = createRemediationState({ path });
    assert.deepEqual(reloaded.pending([candidate]), []);
    assert.equal(JSON.parse(readFileSync(path, 'utf8')).version, 2);
  });

  it('allows the same fingerprint when a newer observation arrives', () => {
    const directory = mkdtempSync(join(tmpdir(), 'remediation-state-'));
    const path = join(directory, 'handled.json');
    const state = createRemediationState({ path });
    state.mark([candidate]);

    const newer = { ...candidate, lastSeen: '2026-08-04T16:00:00Z' };
    assert.deepEqual(createRemediationState({ path }).pending([newer]), [
      newer,
    ]);
  });

  it('recovers from a corrupt state file without dropping new incidents', () => {
    const directory = mkdtempSync(join(tmpdir(), 'remediation-state-'));
    const path = join(directory, 'handled.json');
    writeFileSync(path, 'not json');

    assert.deepEqual(createRemediationState({ path }).pending([candidate]), [
      candidate,
    ]);
  });

  it('reserves an observation for only one concurrent worker', () => {
    const directory = mkdtempSync(join(tmpdir(), 'remediation-state-'));
    const path = join(directory, 'handled.json');
    const firstWorker = createRemediationState({ path });
    const secondWorker = createRemediationState({ path });

    assert.deepEqual(firstWorker.pending([candidate]), [candidate]);
    assert.deepEqual(secondWorker.pending([candidate]), []);
  });

  it('releases an abandoned reservation after its lease expires', () => {
    const directory = mkdtempSync(join(tmpdir(), 'remediation-state-'));
    const path = join(directory, 'handled.json');
    let nowMs = Date.parse('2026-08-04T15:46:50Z');
    const state = createRemediationState({
      now: () => nowMs,
      path,
      reservationTtlMs: 1_000,
    });

    assert.deepEqual(state.pending([candidate]), [candidate]);
    nowMs += 1_001;
    assert.deepEqual(state.pending([candidate]), [candidate]);
  });

  it('ignores malformed handled records instead of suppressing incidents', () => {
    const directory = mkdtempSync(join(tmpdir(), 'remediation-state-'));
    const path = join(directory, 'handled.json');
    writeFileSync(
      path,
      JSON.stringify({
        handled: {
          [candidate.fingerprint]: {
            observation: candidate.lastSeen,
          },
        },
        notifications: [],
        reservations: [],
        version: 2,
      })
    );

    assert.deepEqual(createRemediationState({ path }).pending([candidate]), [
      candidate,
    ]);
  });

  it('persists notifications until they are acknowledged', () => {
    const directory = mkdtempSync(join(tmpdir(), 'remediation-state-'));
    const path = join(directory, 'handled.json');
    const state = createRemediationState({ path });
    const report = { html: '<p>incident</p>', subject: 'Incident', text: 'x' };

    assert.equal(
      state.complete({ notification: { id: 'report-1', report } }),
      true
    );
    assert.deepEqual(createRemediationState({ path }).notifications(), [
      { id: 'report-1', report },
    ]);
    assert.equal(state.acknowledgeNotification('report-1'), true);
    assert.deepEqual(createRemediationState({ path }).notifications(), []);
  });
});
