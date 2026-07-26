import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { fetchSemanticMetadata } from './supply-chain-provenance.mjs';

const policy = JSON.parse(
  readFileSync(new URL('policy.json', import.meta.url), 'utf8')
);

test('semantic metadata binds one validated DNS answer set per request hop', async () => {
  const resolutions = [];
  const requests = [];
  const resolver = (hostname) => {
    resolutions.push(hostname);
    return resolutions.filter((value) => value === hostname).length === 1
      ? ['8.8.8.8', '1.1.1.1']
      : ['10.0.0.1'];
  };
  const requester = (url, options) => {
    requests.push([url, options]);
    return {
      body: '{}',
      headers: { 'content-type': 'application/json' },
      remoteAddress: options.address,
      status: 200,
    };
  };
  await fetchSemanticMetadata(policy, requester, { resolver });
  assert.equal(resolutions.length, 2);
  assert.ok(
    requests.every(
      ([url, options]) =>
        options.address === '1.1.1.1' &&
        options.hostname === new URL(url).hostname &&
        options.servername === new URL(url).hostname &&
        options.answerSetSha256?.length === 64
    )
  );
});

test('semantic metadata rejects any private answer before requesting', async () => {
  let contacted = false;
  await assert.rejects(
    fetchSemanticMetadata(
      policy,
      () => {
        contacted = true;
        return {};
      },
      { resolver: async () => ['8.8.8.8', '10.0.0.1'] }
    ),
    /DNS answer/
  );
  assert.equal(contacted, false);
});

test('semantic metadata rejects a socket remote-address mismatch', async () => {
  await assert.rejects(
    fetchSemanticMetadata(
      policy,
      (_url, options) => ({
        body: '{}',
        headers: { 'content-type': 'application/json' },
        remoteAddress: options.address === '8.8.8.8' ? '1.1.1.1' : '8.8.8.8',
        status: 200,
      }),
      { resolver: async () => ['8.8.8.8'] }
    ),
    /remote address/
  );
});

test('semantic metadata includes DNS resolution in the overall deadline', async () => {
  let contacted = false;
  await assert.rejects(
    fetchSemanticMetadata(
      policy,
      () => {
        contacted = true;
        return {};
      },
      {
        overallTimeoutMs: 20,
        resolver: () =>
          new Promise(() => {
            // Intentionally unresolved to exercise the hard deadline.
          }),
      }
    ),
    /timeout/
  );
  assert.equal(contacted, false);
});

test('aborts and settles a sibling request before surfacing the first failure', async () => {
  const runnerUrl = policy.supplyChainProvenance.runner.releaseApiUrl;
  const firstFailure = new TypeError('runner metadata failed');
  let siblingAborted = false;
  let siblingActive = false;
  let siblingSettled = false;
  const requester = (url, options) => {
    if (url === runnerUrl)
      return new Promise((_, reject) =>
        setImmediate(() => reject(firstFailure))
      );
    siblingActive = true;
    return new Promise((_, reject) => {
      options.signal.addEventListener(
        'abort',
        () => {
          siblingAborted = true;
          siblingActive = false;
          siblingSettled = true;
          reject(new TypeError('sibling aborted'));
        },
        { once: true }
      );
    });
  };

  await assert.rejects(
    fetchSemanticMetadata(policy, requester, {
      overallTimeoutMs: 250,
      resolver: async () => ['8.8.8.8'],
    }),
    (error) => error === firstFailure
  );
  assert.equal(siblingActive, false);
  assert.equal(siblingAborted, true);
  assert.equal(siblingSettled, true);
});
