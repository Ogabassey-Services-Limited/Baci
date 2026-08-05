import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildRemediationPrBody } from './remediation-pr-body.mjs';

describe('remediation PR body', () => {
  it('summarizes incident metadata without allowing markup or new lines', () => {
    const body = buildRemediationPrBody({
      fingerprint: 'abc123',
      occurrences: 3,
      sample: {
        message: 'not included',
        issueId: '987654321',
        route: '/products\n<script>alert(1)</script>',
        source: 'vercel',
      },
    });

    assert.match(body, /Fingerprint: abc123/);
    assert.match(body, /Occurrences: 3/);
    assert.match(body, /Sentry issue: 987654321/);
    assert.match(body, /Route: \/products {2}script alert\(1\) \/script/);
    assert.doesNotMatch(body, /[<>]/);
    assert.doesNotMatch(body, /not included/);
  });
});
