import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveCiTestPlan } from './resolve-ci-test-plan.mjs';

test('targets Vitest changed tests for pull requests with only local web source changes', () => {
  assert.deepEqual(
    resolveCiTestPlan({
      baseRef: 'origin/main',
      changedFiles: [
        'apps/web/src/lib/shipping/providers/gigl.booking.ts',
        'apps/web/src/lib/shipping/providers/gigl.booking.test.ts',
      ],
      eventName: 'pull_request',
    }),
    {
      mode: 'targeted-web-vitest',
      reason: 'Pull request changes are limited to apps/web source or test files.',
      command:
        'pnpm --filter @baci/web exec vitest run --changed origin/main --passWithNoTests',
    }
  );
});

test('keeps full affected tests when shared packages change', () => {
  assert.equal(
    resolveCiTestPlan({
      baseRef: 'origin/main',
      changedFiles: ['packages/shared/src/lib/negotiation-contact.ts'],
      eventName: 'pull_request',
    }).mode,
    'full-affected'
  );
});

test('keeps full affected tests when web test setup changes', () => {
  assert.equal(
    resolveCiTestPlan({
      baseRef: 'origin/main',
      changedFiles: ['apps/web/vitest.setup.ts'],
      eventName: 'pull_request',
    }).mode,
    'full-affected'
  );
});

test('keeps full affected tests when CI test planning changes', () => {
  assert.equal(
    resolveCiTestPlan({
      baseRef: 'origin/main',
      changedFiles: ['.github/workflows/ci.yml'],
      eventName: 'pull_request',
    }).mode,
    'full-affected'
  );
});

test('keeps full tests outside pull request events', () => {
  assert.equal(
    resolveCiTestPlan({
      baseRef: 'origin/main',
      changedFiles: ['apps/web/src/lib/shipping/providers/gigl.booking.ts'],
      eventName: 'merge_group',
    }).mode,
    'full-affected'
  );
});
