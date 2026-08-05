import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { verifyCurrentMainDeployment } from './current-main-deploy-guard.mjs';

const expectedSha = 'a'.repeat(40);

function response(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    async json() {
      return body;
    },
  };
}

test('accepts only when the deployment SHA is the current main ref', async () => {
  const calls = [];
  const result = await verifyCurrentMainDeployment({
    expectedSha,
    fetchImpl: async (url, options) => {
      calls.push({ options, url });
      return response({ object: { sha: expectedSha } });
    },
    repository: 'ogabasseyy/Baci',
    token: 'test-token',
  });

  assert.deepEqual(result, { currentSha: expectedSha, expectedSha });
  assert.equal(
    calls[0].url,
    'https://api.github.com/repos/ogabasseyy/Baci/git/ref/heads/main'
  );
  assert.equal(calls[0].options.headers.authorization, 'Bearer test-token');
});

test('rejects a superseded deployment SHA', async () => {
  await assert.rejects(
    verifyCurrentMainDeployment({
      expectedSha,
      fetchImpl: async () => response({ object: { sha: 'b'.repeat(40) } }),
      repository: 'ogabasseyy/Baci',
      token: 'test-token',
    }),
    /superseded deployment SHA/
  );
});

test('fails closed on malformed identity and GitHub API responses', async () => {
  await assert.rejects(
    verifyCurrentMainDeployment({
      expectedSha: 'not-a-sha',
      fetchImpl: async () => response({ object: { sha: expectedSha } }),
      repository: 'ogabasseyy/Baci',
      token: 'test-token',
    }),
    /invalid deployment SHA/
  );
  await assert.rejects(
    verifyCurrentMainDeployment({
      expectedSha,
      fetchImpl: async () => response({}, { ok: false, status: 503 }),
      repository: 'ogabasseyy/Baci',
      token: 'test-token',
    }),
    /GitHub main-ref lookup failed with status 503/
  );
  await assert.rejects(
    verifyCurrentMainDeployment({
      expectedSha,
      fetchImpl: async () => response({ object: { sha: 'malformed' } }),
      repository: 'ogabasseyy/Baci',
      token: 'test-token',
    }),
    /invalid current main SHA/
  );
});

test('production deploy is staged and binds the exact-main guard', () => {
  const workflow = readFileSync(
    new URL('../workflows/deploy.yml', import.meta.url),
    'utf8'
  );

  assert.match(
    workflow,
    /DEPLOY_CURRENT_MAIN_GUARD: \.github\/scripts\/current-main-deploy-guard\.mjs/
  );
  assert.match(
    workflow,
    /deploy --yes --prebuilt --prod --skip-domain --archive=tgz/
  );
  const deployJob = workflow.slice(workflow.indexOf('  deploy-production:'));
  const prebuildGuard = deployJob.indexOf(
    '- name: Verify exact-main deployment authority before build'
  );
  assert.ok(prebuildGuard > 0, 'missing prebuild exact-main guard');
  assert.ok(
    prebuildGuard <
      deployJob.indexOf('- uses: ./.github/actions/pnpm-install-cached'),
    'exact-main guard must run before dependency installation and build'
  );
});
