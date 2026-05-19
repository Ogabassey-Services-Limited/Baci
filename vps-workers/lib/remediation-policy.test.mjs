import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildCodexRemediationPrompt,
  evaluateMergePolicy,
  isProtectedPath,
} from './remediation-policy.mjs';

describe('remediation policy', () => {
  it('blocks high-risk paths from autonomous merge', () => {
    assert.equal(isProtectedPath('apps/web/src/proxy.ts'), true);
    assert.equal(
      isProtectedPath('apps/web/src/app/api/payments/webhook/route.ts'),
      true
    );
    assert.equal(
      isProtectedPath('supabase/migrations/20260519120000_new.sql'),
      true
    );
    assert.equal(isProtectedPath('apps/web/src/components/cart.tsx'), false);
  });

  it('allows auto-merge only when all gates and path policy pass', () => {
    assert.deepEqual(
      evaluateMergePolicy({
        changedFiles: ['apps/web/src/components/cart.tsx'],
        checksPassed: true,
        hasUnresolvedThreads: false,
        hasHighSeverityReview: false,
      }),
      { allowed: true, reasons: [] }
    );

    const blocked = evaluateMergePolicy({
      changedFiles: ['apps/web/src/proxy.ts'],
      checksPassed: true,
      hasUnresolvedThreads: false,
      hasHighSeverityReview: false,
    });

    assert.equal(blocked.allowed, false);
    assert.match(blocked.reasons.join('\n'), /protected path/);
  });

  it('builds a prompt with evidence and hard safety boundaries', () => {
    const prompt = buildCodexRemediationPrompt({
      candidate: {
        fingerprint: 'abc123',
        occurrences: 3,
        firstSeen: '2026-05-19T10:00:00.000Z',
        lastSeen: '2026-05-19T10:05:00.000Z',
        sample: {
          route: '/api/products',
          message: 'TypeError: Cannot read properties of undefined',
          deploymentId: 'dpl_123',
          requestId: 'req_123',
        },
      },
    });

    assert.match(prompt, /fingerprint: abc123/);
    assert.match(prompt, /Write or update regression tests first/);
    assert.match(prompt, /Do not modify protected files/);
    assert.match(prompt, /Do not merge the PR directly/);
  });
});
