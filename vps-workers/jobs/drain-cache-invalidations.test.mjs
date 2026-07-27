import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  deliverCacheInvalidation,
  drainCacheInvalidations,
} from './drain-cache-invalidations.mjs';

const env = {
  CLOUDFLARE_API_TOKEN: 'cf-token',
  CLOUDFLARE_ZONE_ID: 'cf-zone',
  CLOUDFLARE_ZONE_NAME: 'example.com',
  NEXT_PUBLIC_ROOT_DOMAIN: 'usebaci.com',
  NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role',
  VERCEL_PROJECT_ID: 'project-id',
  VERCEL_TEAM_ID: 'team-id',
  VERCEL_TOKEN: 'vercel-token',
};
const claim = {
  attempts: 1,
  claim_token: '11111111-1111-4111-8111-111111111111',
  generation: 2,
  merchant_id: '22222222-2222-4222-8222-222222222222',
  product_slugs: ['cache-phone'],
  related_identifiers: ['shop-one', 'shop.example.com'],
  target_id: 'shop-one',
  target_kind: 'storefront_slug',
};

describe('deliverCacheInvalidation', () => {
  it('hard-deletes Vercel tags before purging Cloudflare hosts', async () => {
    const calls = [];
    const fetchImpl = (url, init) => {
      calls.push({ init, url: String(url) });
      return Promise.resolve(
        calls.length === 1
          ? new Response('{}', { status: 200 })
          : new Response(JSON.stringify({ success: true }), { status: 200 })
      );
    };
    assert.deepEqual(
      await deliverCacheInvalidation(claim, { env, fetchImpl }),
      { ok: true }
    );
    assert.match(calls[0].url, /dangerously-delete-by-tags/);
    assert.equal(
      new URL(calls[0].url).searchParams.get('projectIdOrName'),
      'project-id'
    );
    assert.equal(new URL(calls[0].url).searchParams.get('teamId'), 'team-id');
    assert.equal(JSON.parse(calls[0].init.body).target, 'production');
    assert.match(calls.at(-1).url, /cloudflare\.com/);
    assert.deepEqual(JSON.parse(calls.at(-1).init.body), {
      hosts: ['shop.example.com', 'www.shop.example.com'],
    });
  });

  it('skips Cloudflare when no claimed hostname belongs to its zone', async () => {
    const calls = [];
    const slugOnlyClaim = {
      ...claim,
      related_identifiers: ['shop-one'],
    };
    const result = await deliverCacheInvalidation(slugOnlyClaim, {
      env,
      fetchImpl: (url) => {
        calls.push(String(url));
        return Promise.resolve(new Response('{}', { status: 200 }));
      },
    });
    assert.deepEqual(result, { ok: true });
    assert.ok(calls.every((url) => url.includes('api.vercel.com')));
  });

  it('does not reach Cloudflare when Vercel deletion fails', async () => {
    let calls = 0;
    const result = await deliverCacheInvalidation(claim, {
      env,
      fetchImpl: () => {
        calls += 1;
        return Promise.resolve(
          new Response('secret body', {
            headers: { 'Retry-After': '120' },
            status: 429,
          })
        );
      },
    });
    assert.deepEqual(result, {
      errorCode: 'vercel_http_429',
      ok: false,
      retryAfterSeconds: 120,
    });
    assert.equal(calls, 1);
  });

  it('purges every Cloudflare hostname across provider-sized batches', async () => {
    const cloudflareBatches = [];
    const manyHostsClaim = {
      ...claim,
      related_identifiers: Array.from(
        { length: 20 },
        (_, index) => `shop-${index}.example.com`
      ),
    };
    const result = await deliverCacheInvalidation(manyHostsClaim, {
      env,
      fetchImpl: (url, init) => {
        if (String(url).includes('cloudflare.com')) {
          cloudflareBatches.push(JSON.parse(init.body).hosts);
          return Promise.resolve(
            new Response(JSON.stringify({ success: true }), { status: 200 })
          );
        }
        return Promise.resolve(new Response('{}', { status: 200 }));
      },
    });

    assert.deepEqual(result, { ok: true });
    assert.equal(cloudflareBatches.length, 2);
    assert.equal(cloudflareBatches.flat().length, 40);
    assert.ok(cloudflareBatches.every((batch) => batch.length <= 30));
  });
});

describe('drainCacheInvalidations', () => {
  it('fails before claiming when provider configuration is missing', async () => {
    let clientCreated = false;
    await assert.rejects(
      drainCacheInvalidations({
        createSupabaseClient: () => {
          clientCreated = true;
          return { rpc: async () => ({ data: [], error: null }) };
        },
        env: { ...env, VERCEL_TOKEN: '' },
      }),
      /VERCEL_TOKEN is required/
    );
    assert.equal(clientCreated, false);
  });

  it('rejects malformed claims before delivery', async () => {
    let delivered = false;
    const rpc = (name) =>
      Promise.resolve(
        name === 'claim_cache_invalidations'
          ? {
              data: [{ ...claim, product_slugs: [' valid-but-untrimmed'] }],
              error: null,
            }
          : { data: true, error: null }
      );
    await assert.rejects(
      drainCacheInvalidations({
        createSupabaseClient: () => ({ rpc }),
        deliver: () => {
          delivered = true;
          return { ok: true };
        },
        env,
      }),
      /Invalid cache invalidation claim payload/
    );
    assert.equal(delivered, false);
  });

  it('generation-fences completion after confirmed delivery', async () => {
    const rpcCalls = [];
    const rpc = (name, args) => {
      rpcCalls.push({ args, name });
      return Promise.resolve(
        name === 'claim_cache_invalidations'
          ? { data: [claim], error: null }
          : { data: true, error: null }
      );
    };
    const result = await drainCacheInvalidations({
      createSupabaseClient: () => ({ rpc }),
      deliver: async () => ({ ok: true }),
      env,
      logger: {
        log() {
          /* intentionally silent */
        },
      },
    });
    assert.deepEqual(result, { claimed: 1, completed: 1, failed: 0 });
    assert.equal(rpcCalls[1].name, 'finish_cache_invalidation');
    assert.equal(rpcCalls[1].args.p_generation, 2);
    assert.equal(rpcCalls[1].args.p_claim_token, claim.claim_token);
    assert.equal(rpcCalls[1].args.p_succeeded, true);
  });

  it('records a bounded retry without logging provider data', async () => {
    const rpcCalls = [];
    const rpc = (name, args) => {
      rpcCalls.push({ args, name });
      return Promise.resolve(
        name === 'claim_cache_invalidations'
          ? { data: [claim], error: null }
          : { data: true, error: null }
      );
    };
    await drainCacheInvalidations({
      createSupabaseClient: () => ({ rpc }),
      deliver: async () => ({
        errorCode: 'cloudflare_http_429',
        ok: false,
        retryAfterSeconds: 120,
      }),
      env,
      logger: {
        log() {
          /* intentionally silent */
        },
      },
    });
    assert.equal(rpcCalls[1].args.p_error_code, 'cloudflare_http_429');
    assert.equal(rpcCalls[1].args.p_retry_after_seconds, 120);
    assert.equal(rpcCalls[1].args.p_succeeded, false);
  });

  for (const [description, finishRequest] of [
    [
      'the finish RPC returns an error',
      () => Promise.resolve({ data: null, error: new Error('db') }),
    ],
    [
      'the finish RPC rejects the claim fence',
      () => Promise.resolve({ data: false, error: null }),
    ],
    ['the finish RPC request rejects', () => Promise.reject(new Error('db'))],
  ]) {
    it(`reports progress and fails when ${description}`, async () => {
      const logs = [];
      const rpc = (name) =>
        name === 'claim_cache_invalidations'
          ? Promise.resolve({ data: [claim], error: null })
          : finishRequest();

      await assert.rejects(
        drainCacheInvalidations({
          createSupabaseClient: () => ({ rpc }),
          deliver: async () => ({ ok: true }),
          env,
          logger: { log: (message) => logs.push(message) },
        }),
        /Failed to persist cache invalidation outcome/
      );
      assert.deepEqual(logs, [
        '[cache-invalidations] finish-failed claimed=1 completed=0 failed=0',
      ]);
    });
  }
});
