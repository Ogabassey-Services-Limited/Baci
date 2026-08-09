import assert from 'node:assert/strict';
import { it } from 'node:test';
import { normalizeRemediationNotifications } from './remediation-state-notifications.mjs';

it('keeps legacy notifications while preserving valid retry scheduling fields', () => {
  const report = { html: '<p>x</p>', subject: 'x', text: 'x' };

  assert.deepEqual(
    normalizeRemediationNotifications({
      deferred: {
        attempts: 2,
        nextAttemptAt: '2026-08-09T10:01:00.000Z',
        recordedAt: '2026-08-09T10:00:00.000Z',
        report,
      },
      legacy: {
        recordedAt: '2026-08-09T10:00:00.000Z',
        report,
      },
      malformed: { recordedAt: 'not-a-date', report },
    }),
    {
      deferred: {
        attempts: 2,
        nextAttemptAt: '2026-08-09T10:01:00.000Z',
        recordedAt: '2026-08-09T10:00:00.000Z',
        report,
      },
      legacy: {
        recordedAt: '2026-08-09T10:00:00.000Z',
        report,
      },
    }
  );
});
