import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { it } from 'node:test';
import { createRemediationPrJournal } from './remediation-pr-journal.mjs';

it('reclaims a stale PR journal lock after a worker crash', () => {
  const directory = mkdtempSync(join(tmpdir(), 'baci-pr-journal-stale-'));
  const path = join(directory, 'journal.json');
  const lockPath = `${path}.lock`;
  const nowMs = Date.parse('2026-08-09T10:05:00.000Z');
  const token = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  writeFileSync(
    `${lockPath}.owner-${token}`,
    JSON.stringify({
      createdAt: '2026-08-09T10:00:00.000Z',
      pid: 2_147_483_647,
      token,
    })
  );
  writeFileSync(
    lockPath,
    JSON.stringify({
      createdAt: '2026-08-09T10:00:00.000Z',
      pid: 2_147_483_647,
      token,
    })
  );
  const journal = createRemediationPrJournal({ now: () => nowMs, path });

  journal.record({
    candidate: {
      caseKey: 'sentry:sentry_issue:stale-lock',
      fingerprint: 'stale-lock',
      observationMarker: '2026-08-09T10:00:00.000Z',
    },
    result: {
      branch: 'codex/fix-stale-lock',
      prUrl: 'https://github.com/baci/baci/pull/88',
    },
  });

  assert.equal(journal.entries().length, 1);
});
