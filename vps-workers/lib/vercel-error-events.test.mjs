import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  fingerprintErrorEvent,
  groupErrorEvents,
  isErrorEvent,
  normalizeVercelLogEvent,
  selectRemediationCandidates,
} from './vercel-error-events.mjs';

describe('vercel error events', () => {
  it('normalizes common Vercel log drain shapes', () => {
    const event = normalizeVercelLogEvent({
      level: 'error',
      message: 'TypeError: Cannot read properties of undefined',
      requestId: 'req_123',
      source: 'lambda',
      projectName: 'baci-web',
      deploymentId: 'dpl_123',
      path: '/api/orders/123',
      timestamp: '2026-05-19T12:00:00.000Z',
    });

    assert.equal(event.level, 'error');
    assert.equal(
      event.message,
      'TypeError: Cannot read properties of undefined'
    );
    assert.equal(event.route, '/api/orders/123');
    assert.equal(event.requestId, 'req_123');
    assert.equal(event.deploymentId, 'dpl_123');
  });

  it('classifies runtime errors and 5xx responses but ignores expected noise', () => {
    assert.equal(
      isErrorEvent(
        normalizeVercelLogEvent({
          level: 'info',
          message: 'GET /api/products 200',
          statusCode: 200,
        })
      ),
      false
    );
    assert.equal(
      isErrorEvent(
        normalizeVercelLogEvent({
          level: 'warn',
          message: 'GET /missing 404',
          statusCode: 404,
        })
      ),
      false
    );
    assert.equal(
      isErrorEvent(
        normalizeVercelLogEvent({
          level: 'info',
          message: 'GET /api/orders 500',
          statusCode: 500,
        })
      ),
      true
    );
    assert.equal(
      isErrorEvent(
        normalizeVercelLogEvent({
          level: 'error',
          message: 'Unhandled exception in route handler',
        })
      ),
      true
    );
  });

  it('builds stable fingerprints across ids and line numbers', () => {
    const left = normalizeVercelLogEvent({
      message:
        'TypeError: Cannot read properties of undefined at route.ts:42 request req_123',
      route: '/api/orders/123',
      deploymentId: 'dpl_one',
    });
    const right = normalizeVercelLogEvent({
      message:
        'TypeError: Cannot read properties of undefined at route.ts:99 request req_999',
      route: '/api/orders/456',
      deploymentId: 'dpl_two',
    });

    assert.equal(fingerprintErrorEvent(left), fingerprintErrorEvent(right));
  });

  it('groups repeated errors and selects candidates over the threshold', () => {
    const groups = groupErrorEvents([
      {
        level: 'error',
        message: 'Error: checkout failed',
        route: '/api/payments/verify',
      },
      {
        level: 'error',
        message: 'Error: checkout failed',
        route: '/api/payments/verify',
      },
      { level: 'info', message: 'GET / 200', route: '/' },
    ]);
    const candidates = selectRemediationCandidates(groups, {
      minOccurrences: 2,
    });

    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].occurrences, 2);
    assert.equal(candidates[0].sample.route, '/api/payments/verify');
  });
});
