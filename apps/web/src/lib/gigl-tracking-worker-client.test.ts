import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createGiglTrackingWorkerClient } from './gigl-tracking-worker-client';

const { Pool, query, release } = vi.hoisted(() => {
  const release = vi.fn();
  const query = vi.fn();
  const connect = vi.fn(async () => ({ query, release }));
  const on = vi.fn();
  const Pool = vi.fn(function MockPool() {
    return { connect, on };
  });
  return { Pool, query, release };
});

vi.mock('pg', () => ({ Pool }));

const configuredEnv = {
  BACI_REPO_DIR: resolve(process.cwd(), '../..'),
  GIGL_TRACKING_DATABASE_URL:
    'postgresql://gigl_tracking_worker.projectref:strong-password@aws-1-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require',
  NEXT_PUBLIC_SUPABASE_URL: 'https://projectref.supabase.co',
};

describe('createGiglTrackingWorkerClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    query.mockResolvedValue({ rows: [] });
  });

  it('uses one verified-TLS session-pool connection for restricted calls', async () => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ shipment_id: 'shipment-id' }] })
      .mockResolvedValueOnce({ rows: [] });
    const client = createGiglTrackingWorkerClient(configuredEnv);

    const result = await client.rpc('claim_due_gigl_tracking_monitors', {
      p_limit: 25,
      p_worker_id: 'worker-id',
    });

    expect(Pool).toHaveBeenCalledWith(
      expect.objectContaining({
        allowExitOnIdle: true,
        application_name: 'baci-gigl-tracking-worker',
        connectionString: expect.stringContaining(
          'aws-1-eu-west-1.pooler.supabase.com:5432/postgres'
        ),
        max: 1,
        ssl: {
          ca: expect.stringContaining('BEGIN CERTIFICATE'),
          rejectUnauthorized: true,
        },
      })
    );
    expect(query).toHaveBeenNthCalledWith(1, 'begin');
    expect(query).toHaveBeenNthCalledWith(
      2,
      "select set_config('request.jwt.claim.role', 'gigl_tracking_worker', true)"
    );
    expect(query).toHaveBeenNthCalledWith(
      3,
      'select * from public.gigl_worker_claim_due_tracking_monitors($1, $2)',
      [25, 'worker-id']
    );
    expect(query).toHaveBeenNthCalledWith(4, 'commit');
    expect(result).toEqual({
      data: [{ shipment_id: 'shipment-id' }],
      error: null,
    });
    expect(release).toHaveBeenCalledOnce();
  });

  it('returns a bounded error and rolls back a failed operation', async () => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockRejectedValueOnce(new Error('secret provider error'))
      .mockResolvedValueOnce({ rows: [] });
    const client = createGiglTrackingWorkerClient(configuredEnv);

    const result = await client.rpc('release_gigl_tracking_claim', {
      p_shipment_id: 'shipment-id',
      p_tracking_epoch_id: 'epoch-id',
      p_worker_id: 'worker-id',
    });

    expect(query).toHaveBeenLastCalledWith('rollback');
    expect(result.data).toBeNull();
    expect(result.error).toEqual(
      new Error('GIGL tracking database operation failed')
    );
    expect(JSON.stringify(result)).not.toContain('secret provider error');
    expect(release).toHaveBeenCalledOnce();
  });

  it('rejects admin and non-pooler connection strings', () => {
    for (const connectionString of [
      'postgresql://postgres.projectref:password@aws-1-eu-west-1.pooler.supabase.com:5432/postgres',
      'postgresql://gigl_tracking_worker.otherref:password@aws-1-eu-west-1.pooler.supabase.com:5432/postgres',
      'postgresql://gigl_tracking_worker.projectref:password@db.projectref.supabase.co:5432/postgres',
      'postgresql://gigl_tracking_worker.projectref:password@aws-1-eu-west-1.pooler.supabase.com:6543/postgres',
    ]) {
      expect(() =>
        createGiglTrackingWorkerClient({
          GIGL_TRACKING_DATABASE_URL: connectionString,
          NEXT_PUBLIC_SUPABASE_URL: 'https://projectref.supabase.co',
          BACI_REPO_DIR: resolve(process.cwd(), '../..'),
        })
      ).toThrow('GIGL tracking worker database capability is invalid');
    }
    expect(Pool).not.toHaveBeenCalled();
  });
});
