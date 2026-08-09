import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fetchPostHogRemediationCandidates } from './posthog-error-events.mjs';

const environment = {
  POSTHOG_REMEDIATION_HOST: 'https://eu.posthog.com',
  POSTHOG_REMEDIATION_PERSONAL_API_KEY: 'phx_read_only_personal_key',
  POSTHOG_REMEDIATION_PROJECT_ID: '202711',
};

describe('PostHog remediation candidates', () => {
  it('returns bounded error-tracking metadata without provider issue text', async () => {
    const candidates = await fetchPostHogRemediationCandidates({
      env: { ...environment, BACI_POSTHOG_REMEDIATION_MAX_PAGES: '2' },
      fetchFn: (url, options) => {
        assert.match(
          String(url),
          /\/api\/projects\/202711\/error_tracking\/issues\/\?limit=100&offset=0/
        );
        assert.equal(
          options.headers.Authorization,
          'Bearer phx_read_only_personal_key'
        );
        return new Response(
          JSON.stringify({
            count: 1,
            results: [
              {
                id: 'issue-987',
                status: 'active',
                events_count: 4,
                first_seen: '2026-08-04T15:45:25Z',
                last_seen: '2026-08-04T15:46:50Z',
                name: 'Crash for alice@example.com token=secret-value',
                description: 'customer 2348012345678 must-not-be-copied',
              },
            ],
          })
        );
      },
    });

    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].sample.source, 'posthog');
    assert.equal(candidates[0].sample.category, 'Error tracking issue');
    assert.equal(candidates[0].sample.message, 'PostHog error tracking issue');
    assert.equal(candidates[0].sample.route, '(redacted PostHog location)');
    assert.equal(
      JSON.stringify(candidates).includes('alice@example.com'),
      false
    );
    assert.equal(JSON.stringify(candidates).includes('secret-value'), false);
    assert.equal(JSON.stringify(candidates).includes('2348012345678'), false);
  });

  it('examines a later bounded offset page before applying the repeat threshold', async () => {
    const requestedUrls = [];
    const candidates = await fetchPostHogRemediationCandidates({
      env: { ...environment, BACI_POSTHOG_REMEDIATION_MAX_PAGES: '2' },
      fetchFn: (url) => {
        requestedUrls.push(String(url));
        if (requestedUrls.length === 1) {
          return new Response(
            JSON.stringify({
              count: 2,
              results: [{ id: 'one-off', status: 'active', events_count: 1 }],
            })
          );
        }
        return new Response(
          JSON.stringify({
            count: 2,
            results: [{ id: 'repeated', status: 'active', events_count: 8 }],
          })
        );
      },
    });

    assert.equal(requestedUrls.length, 2);
    assert.match(requestedUrls[1], /offset=1/);
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].occurrences, 8);
  });

  it('fails closed when the configured page ceiling would leave issues unmeasured', async () => {
    await assert.rejects(
      fetchPostHogRemediationCandidates({
        env: { ...environment, BACI_POSTHOG_REMEDIATION_MAX_PAGES: '1' },
        fetchFn: async () =>
          new Response(
            JSON.stringify({
              count: 2,
              results: [{ id: 'first', status: 'active', events_count: 2 }],
            })
          ),
      }),
      /pagination exceeded 1 pages/
    );
  });

  it('rejects the public ingestion key and incomplete dedicated configuration', async () => {
    await assert.rejects(
      fetchPostHogRemediationCandidates({
        env: {
          ...environment,
          POSTHOG_REMEDIATION_PERSONAL_API_KEY: 'phc_public_ingestion_key',
        },
        fetchFn: () => {
          throw new Error('fetch must not run with an ingestion key');
        },
      }),
      /personal API key.*not a project ingestion key/i
    );
    await assert.rejects(
      fetchPostHogRemediationCandidates({ env: {} }),
      /POSTHOG_REMEDIATION_HOST/
    );
  });

  it('does not promote a provider issue identifier that could contain personal data', async () => {
    const candidates = await fetchPostHogRemediationCandidates({
      env: environment,
      fetchFn: async () =>
        new Response(
          JSON.stringify({
            count: 1,
            results: [
              {
                id: 'alice@example.com',
                status: 'active',
                events_count: 4,
              },
            ],
          })
        ),
    });

    assert.deepEqual(candidates, []);
  });

  it('reports the read scope without exposing provider response bodies', async () => {
    await assert.rejects(
      fetchPostHogRemediationCandidates({
        env: environment,
        fetchFn: async () => new Response('provider-secret', { status: 403 }),
      }),
      /HTTP 403; POSTHOG_REMEDIATION_PERSONAL_API_KEY requires error_tracking:read/
    );
  });
});
