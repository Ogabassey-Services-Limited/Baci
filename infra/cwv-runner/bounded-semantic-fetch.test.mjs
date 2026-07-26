import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchSemanticJson } from './bounded-semantic-fetch.mjs';

const origin = 'https://metadata.example.test';

test('cancels an owned DNS resolver at deadline before making a request', async () => {
  let cancelled = 0;
  let requested = 0;
  const resolver = {
    cancel() {
      cancelled += 1;
    },
    resolve4() {
      return new Promise(() => {
        // Deliberately never settles: DNS deadline owns cancellation.
      });
    },
  };

  await assert.rejects(
    fetchSemanticJson(
      `${origin}/receipt.json`,
      [origin],
      () => {
        requested += 1;
      },
      { overallTimeoutMs: 1, resolverFactory: () => resolver }
    ),
    /semantic metadata timeout/
  );

  assert.equal(cancelled, 1);
  assert.equal(requested, 0);
});

test('cancels a supplied resolver and clears its timeout before making a request', async () => {
  let cancelled = 0;
  let requested = 0;
  const resolver = () =>
    new Promise(() => {
      // Deliberately never settles: DNS deadline owns cancellation.
    });
  resolver.cancel = () => {
    cancelled += 1;
  };

  await assert.rejects(
    fetchSemanticJson(
      `${origin}/receipt.json`,
      [origin],
      () => {
        requested += 1;
      },
      { overallTimeoutMs: 1, resolver }
    ),
    /semantic metadata timeout/
  );

  assert.equal(cancelled, 1);
  assert.equal(requested, 0);
});

test('clears the DNS deadline without cancelling a completed resolver', async () => {
  let cancelled = 0;
  const value = await fetchSemanticJson(
    `${origin}/receipt.json`,
    [origin],
    async (_, options) => ({
      body: '{"ok":true}',
      headers: { 'content-type': 'application/json' },
      remoteAddress: options.address,
      status: 200,
    }),
    {
      overallTimeoutMs: 100,
      resolverFactory: () => ({
        cancel() {
          cancelled += 1;
        },
        resolve4() {
          return Promise.resolve(['8.8.8.8']);
        },
      }),
    }
  );

  assert.deepEqual(value, { ok: true });
  assert.equal(cancelled, 0);
});

test('rejects the complete 198.51.0.0/16 TEST-NET range before request', async () => {
  let requested = 0;
  for (const address of ['198.51.0.1', '198.51.100.42', '198.51.255.254']) {
    await assert.rejects(
      fetchSemanticJson(
        `${origin}/receipt.json`,
        [origin],
        () => {
          requested += 1;
        },
        {
          overallTimeoutMs: 100,
          resolver: async () => [address],
        }
      ),
      /semantic metadata DNS answer/
    );
  }
  assert.equal(requested, 0);
});
