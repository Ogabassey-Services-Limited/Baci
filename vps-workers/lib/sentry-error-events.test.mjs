import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  enrichSentryRemediationCandidate,
  fetchSentryRemediationCandidates,
} from './sentry-error-events.mjs';

const environment = {
  SENTRY_REMEDIATION_AUTH_TOKEN: 'token',
  SENTRY_ORG: 'ogabassey',
  SENTRY_PROJECT: 'storefront',
};

describe('Sentry remediation candidates', () => {
  it('adds bounded technical evidence from the latest event without copying users', async () => {
    const candidate = {
      fingerprint: 'anr-fingerprint',
      occurrences: 3,
      sample: { issueId: '139588932', source: 'sentry' },
    };

    const enriched = await enrichSentryRemediationCandidate({
      candidate,
      env: environment,
      fetchFn: (url, options) => {
        assert.match(
          String(url),
          /\/organizations\/ogabassey\/issues\/139588932\/events\/latest\/$/
        );
        assert.equal(options.headers.Authorization, 'Bearer token');
        return new Response(
          JSON.stringify({
            contexts: {
              app: { in_foreground: false },
              device: { model: 'SM-A047F' },
              os: { name: 'Android', version: '14' },
            },
            entries: [
              {
                data: {
                  values: [
                    {
                      mechanism: { type: 'AppExitInfo' },
                      stacktrace: {
                        frames: [
                          {
                            function: 'drawGroup',
                            module: 'com.horcrux.svg.GroupView',
                          },
                          {
                            function: 'synchronouslyUpdateUIProps',
                            module: 'com.swmansion.reanimated.NativeProxy',
                          },
                        ],
                      },
                      type: 'ApplicationNotResponding',
                      value: 'Background ANR',
                    },
                  ],
                },
                type: 'exception',
              },
            ],
            platform: 'java',
            release: { version: 'com.ogabassey.store@2.0.1+766' },
            tags: [{ key: 'device.class', value: 'low' }],
            user: { email: 'must-not-be-copied@example.com' },
          })
        );
      },
    });

    assert.equal(enriched.sample.release, 'com.ogabassey.store@2.0.1+766');
    assert.equal(enriched.sample.platform, 'java');
    assert.equal(enriched.sample.appState, 'background');
    assert.equal(enriched.sample.device, 'SM-A047F');
    assert.equal(enriched.sample.deviceClass, 'low');
    assert.equal(enriched.sample.os, 'Android 14');
    assert.equal(enriched.sample.mechanism, 'AppExitInfo');
    assert.deepEqual(enriched.sample.stackSummary, [
      'com.horcrux.svg.GroupView.drawGroup',
      'com.swmansion.reanimated.NativeProxy.synchronouslyUpdateUIProps',
    ]);
    assert.equal(
      JSON.stringify(enriched).includes('must-not-be-copied'),
      false
    );
  });

  it('keeps the actionable tail of a long Sentry stack', async () => {
    const noiseFrames = Array.from({ length: 40 }, (_, index) => ({
      function: `noise${index}`,
      module: 'java.lang.Runtime',
    }));
    const enriched = await enrichSentryRemediationCandidate({
      candidate: {
        fingerprint: 'long-stack',
        occurrences: 3,
        sample: { issueId: 'long-stack-issue', source: 'sentry' },
      },
      env: environment,
      fetchFn: async () =>
        new Response(
          JSON.stringify({
            entries: [
              {
                data: {
                  values: [
                    {
                      stacktrace: {
                        frames: [
                          ...noiseFrames,
                          {
                            function: 'drawGroup',
                            module: 'com.horcrux.svg.GroupView',
                          },
                          {
                            function: 'synchronouslyUpdateUIProps',
                            module: 'com.swmansion.reanimated.NativeProxy',
                          },
                        ],
                      },
                    },
                  ],
                },
                type: 'exception',
              },
            ],
          })
        ),
    });

    assert.equal(enriched.sample.stackSummary.length, 32);
    assert.equal(
      enriched.sample.stackSummary.includes(
        'com.horcrux.svg.GroupView.drawGroup'
      ),
      true
    );
    assert.equal(
      enriched.sample.stackSummary.includes(
        'com.swmansion.reanimated.NativeProxy.synchronouslyUpdateUIProps'
      ),
      true
    );
  });

  it('returns bounded issue metadata without event payloads or users', async () => {
    const candidates = await fetchSentryRemediationCandidates({
      env: environment,
      fetchFn: (url, options) => {
        assert.match(String(url), /query=is%3Aunresolved/);
        assert.equal(options.headers.Authorization, 'Bearer token');
        return new Response(
          JSON.stringify([
            {
              id: '987',
              count: '4',
              title: 'Application Not Responding',
              culprit: 'com.ogabassey.store.MainActivity',
              firstSeen: '2026-08-04T15:45:25Z',
              lastSeen: '2026-08-04T15:46:50Z',
              lastRelease: { version: 'com.ogabassey.store@2.0.1+761' },
              user: { email: 'must-not-be-copied@example.com' },
            },
          ])
        );
      },
    });

    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].sample.source, 'sentry');
    assert.equal(candidates[0].sample.message, 'Application Not Responding');
    assert.equal('user' in candidates[0].sample, false);
    assert.equal(
      JSON.stringify(candidates).includes('must-not-be-copied'),
      false
    );
  });

  it('fails closed when credentials are incomplete', async () => {
    await assert.rejects(
      fetchSentryRemediationCandidates({ env: {} }),
      /SENTRY_REMEDIATION_AUTH_TOKEN/
    );
  });

  it('ignores one-off issues unless the operator lowers the threshold', async () => {
    const response = () =>
      new Response(JSON.stringify([{ id: 'one-off', count: '1' }]));

    assert.deepEqual(
      await fetchSentryRemediationCandidates({
        env: environment,
        fetchFn: response,
      }),
      []
    );
    assert.equal(
      (
        await fetchSentryRemediationCandidates({
          env: { ...environment, BACI_REMEDIATION_MIN_OCCURRENCES: '1' },
          fetchFn: response,
        })
      ).length,
      1
    );
  });

  it('does not serialize sensitive provider-controlled issue text', async () => {
    const candidates = await fetchSentryRemediationCandidates({
      env: environment,
      fetchFn: async () =>
        new Response(
          JSON.stringify([
            {
              id: 'sensitive-1',
              count: '2',
              title: 'Crash for alice@example.com token=secret-value',
              culprit: '/users/alice/private/customer-2348012345678',
              lastSeen: '2026-08-04T15:46:50Z',
            },
          ])
        ),
    });
    const serialized = JSON.stringify(candidates);

    assert.equal(candidates[0].sample.message, 'Sentry mobile issue');
    assert.equal(candidates[0].sample.route, '(redacted native location)');
    assert.equal(serialized.includes('alice'), false);
    assert.equal(serialized.includes('secret-value'), false);
    assert.equal(serialized.includes('2348012345678'), false);
  });

  it('does not expose provider response bodies on HTTP failure', async () => {
    await assert.rejects(
      fetchSentryRemediationCandidates({
        env: environment,
        fetchFn: async () => new Response('secret body', { status: 503 }),
      }),
      /HTTP 503/
    );
  });

  it('explores later issue pages before applying the repeat threshold', async () => {
    const requestedUrls = [];
    const candidates = await fetchSentryRemediationCandidates({
      env: environment,
      fetchFn: (url) => {
        requestedUrls.push(String(url));
        if (requestedUrls.length === 1) {
          return new Response(
            JSON.stringify([{ id: 'new-one-off', count: '1' }]),
            {
              headers: {
                Link: `<${String(url)}&cursor=next>; rel="next"; results="true"; cursor="next"`,
              },
            }
          );
        }
        return new Response(
          JSON.stringify([
            { id: 'older-repeated-anr', count: '8', title: 'ANR' },
          ]),
          {
            headers: {
              Link: `<${String(url)}>; rel="next"; results="false"; cursor="done"`,
            },
          }
        );
      },
    });

    assert.equal(requestedUrls.length, 2);
    assert.match(requestedUrls[1], /cursor=next/);
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].occurrences, 8);
  });

  it('identifies the required read scope without exposing response bodies', async () => {
    await assert.rejects(
      fetchSentryRemediationCandidates({
        env: environment,
        fetchFn: async () => new Response('provider-secret', { status: 403 }),
      }),
      /HTTP 403; SENTRY_REMEDIATION_AUTH_TOKEN requires event:read/
    );
  });
});
