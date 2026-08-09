import assert from 'node:assert/strict';
import { it } from 'node:test';
import {
  matchingHandledEntry,
  remediationStateKeyFor,
} from './remediation-state-key.mjs';

it('prefers canonical case identity and requires an exact legacy observation', () => {
  const candidate = {
    caseKey: 'vercel:vercel_http_5xx:shared',
    fingerprint: 'shared',
    lastSeen: '2026-08-09T10:00:00.000Z',
  };
  assert.equal(remediationStateKeyFor(candidate), candidate.caseKey);
  const entry = {
    observation: candidate.lastSeen,
    recordedAt: '2026-08-09T10:01:00.000Z',
  };
  assert.deepEqual(
    matchingHandledEntry({ [candidate.caseKey]: entry }, candidate),
    entry
  );
  assert.equal(
    matchingHandledEntry(
      {
        shared: {
          observation: '2026-08-09T09:00:00.000Z',
          recordedAt: '2026-08-09T09:01:00.000Z',
        },
      },
      candidate
    ),
    null
  );
});
