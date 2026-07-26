// biome-ignore-all format: compact resolver-order regression stays below the repository file limit
import assert from 'node:assert/strict';
import test from 'node:test';

import { sealTransportPolicy } from './owner-api-transport-http.mjs';
import { resolveArtifactRedirectAnswers } from './owner-api-transport-runtime.mjs';

const policy = sealTransportPolicy({ allowedQueryKeys: ['sig'], hostPattern: '^productionresultssa[0-9]+\\.blob\\.core\\.windows\\.net$', maxBytes: 1, pathPrefix: '/actions-results/', timeoutsMs: { bodyInactivity: 1, connect: 1, headers: 1, overall: 1 } }, 'c'.repeat(64));
const location = 'https://productionresultssa1.blob.core.windows.net/actions-results/a?sig=x';
const redirectEnvelope = (redirectLocation = location, patch = {}) => ({ headers: { location: redirectLocation }, locationValues: [redirectLocation], status: 302, ...patch });

test('resolves only a complete allowlisted redirect envelope after validation', async () => {
  let calls = 0;
  let resolved;
  const resolve = (hostname, timeoutMs) => { calls += 1; resolved = { hostname, timeoutMs }; return Promise.resolve(['8.8.8.8']); };
  const result = await resolveArtifactRedirectAnswers(redirectEnvelope(), policy, resolve);
  assert.equal(calls, 1);
  assert.deepEqual(resolved, { hostname: 'productionresultssa1.blob.core.windows.net', timeoutMs: 1 });
  assert.equal(result.location, location);
  assert.equal(result.redirectUrl.hostname, 'productionresultssa1.blob.core.windows.net');
  assert.deepEqual(result.answers, ['8.8.8.8']);
});

test('rejects invalid redirect envelopes before invoking the DNS resolver', async () => {
  let calls = 0; const resolve = () => { calls += 1; return Promise.resolve(['8.8.8.8']); };
  const nullPrototypeHeaders = Object.assign(Object.create(null), { location });
  for (const response of [
    redirectEnvelope(location, { status: 200 }),
    redirectEnvelope(location, { status: 301 }),
    redirectEnvelope(location, { locationValues: [location, location] }),
    redirectEnvelope(location, { headers: { location: `${location}\nattacker` }, locationValues: [`${location}\nattacker`] }),
    redirectEnvelope(location, { headers: ['location', location] }),
    redirectEnvelope(location, { headers: nullPrototypeHeaders }),
    { ...redirectEnvelope(), unexpected: true },
    { headers: { date: 'Tue, 01 Jan 2026 00:00:00 GMT' }, locationValues: [location], status: 302 },
    redirectEnvelope('https://attacker.invalid/actions-results/a?sig=x'),
    redirectEnvelope('https://productionresultssa1.blob.core.windows.net/not-actions/a?sig=x'),
    redirectEnvelope('https://productionresultssa1.blob.core.windows.net/actions-results/a?attacker=x'),
    redirectEnvelope('https://username:password@productionresultssa1.blob.core.windows.net/actions-results/a?sig=x'),
  ]) await assert.rejects(resolveArtifactRedirectAnswers(response, policy, resolve), /invalid redirect/);
  assert.equal(calls, 0);
});
