import { createClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createGiglTrackingWorkerClient } from './gigl-tracking-worker-client';

const rpc = vi.fn();
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ rpc })),
}));

function token(role: string) {
  const payload = Buffer.from(
    JSON.stringify({ exp: 4_102_444_800, role })
  ).toString('base64url');
  return `header.${payload}.signature`;
}

describe('createGiglTrackingWorkerClient', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses the restricted worker JWT as authorization', () => {
    const workerToken = token('gigl_tracking_worker');

    const client = createGiglTrackingWorkerClient({
      GIGL_TRACKING_WORKER_TOKEN: workerToken,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
      NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
    });

    expect(createClient).toHaveBeenCalledWith(
      'https://project.supabase.co',
      'anon-key',
      expect.objectContaining({
        global: { headers: { Authorization: `Bearer ${workerToken}` } },
      })
    );
    client.rpc('claim_due_gigl_tracking_monitors', {
      p_limit: 25,
      p_worker_id: 'worker-id',
    });
    expect(rpc).toHaveBeenCalledWith(
      'gigl_worker_claim_due_tracking_monitors',
      { p_limit: 25, p_worker_id: 'worker-id' },
      undefined
    );
  });

  it('rejects a service-role JWT before constructing a client', () => {
    expect(() =>
      createGiglTrackingWorkerClient({
        GIGL_TRACKING_WORKER_TOKEN: token('service_role'),
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
        NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
      })
    ).toThrow('GIGL tracking worker database capability is invalid');
    expect(createClient).not.toHaveBeenCalled();
  });
});
