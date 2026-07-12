import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { syncGiglServiceCentres } from './sync-gigl-service-centres.mjs';

const env = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role',
  GIGL_EMAIL: 'merchant@example.com',
  GIGL_PASSWORD: 'secret',
  GIGL_BASE_URL: 'https://gigl.example/api',
};

function response(data) {
  return { ok: true, json: async () => ({ data: { data } }) };
}

describe('syncGiglServiceCentres', () => {
  it('replaces the directory only after a complete provider snapshot', async () => {
    const calls = [];
    const fetchImpl = (url, options) => {
      calls.push(url);
      assert.ok(options.signal instanceof AbortSignal);
      if (url.endsWith('/login')) return response({ 'access-token': 'token' });
      if (url.endsWith('/localstations/get')) {
        return response([
          { StationId: 4, StationName: 'LAGOS', StationCode: 'LOS' },
        ]);
      }
      return response([
        {
          StationId: 4,
          StationName: 'LAGOS',
          ServiceCentreId: 65,
          ServiceCentreName: 'SANGO OTTA',
          Latitude: 6.707,
          Longitude: 3.243,
        },
      ]);
    };
    let rpcArguments;
    const createSupabaseClient = () => ({
      rpc: (name, args) => {
        rpcArguments = { args, name };
        return {
          abortSignal: (signal) => {
            assert.ok(signal instanceof AbortSignal);
            return { data: 1, error: null };
          },
        };
      },
    });

    const result = await syncGiglServiceCentres({
      env,
      fetchImpl,
      createSupabaseClient,
      generation: '00000000-0000-4000-8000-000000000001',
      now: new Date('2026-07-12T12:00:00Z'),
      logger: { log: () => undefined },
    });

    assert.equal(result.centreCount, 1);
    assert.equal(
      rpcArguments.name,
      'replace_shipping_provider_service_centres'
    );
    assert.equal(rpcArguments.args.p_centres[0].service_centre_id, 65);
    assert.equal(calls.length, 3);
  });

  it('preserves the last-known-good snapshot when a station fetch fails', async () => {
    let rpcCalled = false;
    const fetchImpl = (url) => {
      if (url.endsWith('/login')) return response({ 'access-token': 'token' });
      if (url.endsWith('/localstations/get')) {
        return response([{ StationId: 4, StationName: 'LAGOS' }]);
      }
      return { ok: false, status: 503 };
    };

    await assert.rejects(
      syncGiglServiceCentres({
        env,
        fetchImpl,
        createSupabaseClient: () => ({
          rpc: () => {
            rpcCalled = true;
          },
        }),
      }),
      /service centres failed/
    );
    assert.equal(rpcCalled, false);
  });

  it('rejects a successful HTTP response containing a failed GIGL envelope', async () => {
    let rpcCalled = false;
    const fetchImpl = (url) => {
      if (url.endsWith('/login')) return response({ 'access-token': 'token' });
      if (url.endsWith('/localstations/get')) {
        return response([{ StationId: 4, StationName: 'LAGOS' }]);
      }
      return {
        ok: true,
        json: async () => ({ data: { status: 500, data: [] } }),
      };
    };

    await assert.rejects(
      syncGiglServiceCentres({
        env,
        fetchImpl,
        createSupabaseClient: () => ({
          rpc: () => {
            rpcCalled = true;
          },
        }),
      }),
      /envelope failed with status 500/
    );
    assert.equal(rpcCalled, false);
  });

  it('rejects a top-level failed GIGL envelope before replacing the snapshot', async () => {
    let rpcCalled = false;
    const fetchImpl = (url) => {
      if (url.endsWith('/login')) return response({ 'access-token': 'token' });
      if (url.endsWith('/localstations/get')) {
        return response([{ StationId: 4, StationName: 'LAGOS' }]);
      }
      return {
        ok: true,
        json: async () => ({ status: 500, data: [] }),
      };
    };

    await assert.rejects(
      syncGiglServiceCentres({
        env,
        fetchImpl,
        createSupabaseClient: () => ({
          rpc: () => {
            rpcCalled = true;
          },
        }),
      }),
      /envelope failed with status 500/
    );
    assert.equal(rpcCalled, false);
  });
});
