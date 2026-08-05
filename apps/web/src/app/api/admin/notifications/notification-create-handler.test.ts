import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({ logger: { error: mocks.loggerError } }));
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));

import { createAdminNotification } from './notification-create-handler';

const merchantId = '123e4567-e89b-12d3-a456-426614174111';

function request(body: Record<string, unknown>) {
  return new Request('http://localhost', {
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });
}

function createSupabase(insertError: unknown = null) {
  const inserted: Record<string, unknown>[] = [];
  const insert = vi.fn((value: Record<string, unknown>) => {
    inserted.push(value);
    return {
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: insertError
            ? null
            : {
                ...value,
                created_at: '2026-08-05T10:00:00.000Z',
                id: 'notification-1',
              },
          error: insertError,
        }),
      })),
    };
  });
  return { from: vi.fn(() => ({ insert })), inserted, rpc: vi.fn() };
}

describe('createAdminNotification', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects invalid JSON before creating a notification', async () => {
    mocks.createClient.mockResolvedValue(createSupabase());
    const response = await createAdminNotification(
      new Request('http://localhost', { body: '{', method: 'POST' }),
      'user-1'
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid JSON body',
    });
  });

  it('queues an immediate notification and stores its creator server-side', async () => {
    const supabase = createSupabase();
    mocks.createClient.mockResolvedValue(supabase);

    const response = await createAdminNotification(
      request({
        channels: ['in_app'],
        message: 'Maintenance notice',
        target_type: 'all',
        title: 'Maintenance',
      }),
      'user-1'
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({ status: 'queued' });
    expect(supabase.inserted).toEqual([
      expect.objectContaining({
        created_by: 'user-1',
        scheduled_for: expect.any(String),
      }),
    ]);
  });

  it('does not create a specific notification when target resolution is incomplete', async () => {
    const supabase = createSupabase();
    supabase.rpc.mockResolvedValue({ data: [], error: null });
    mocks.createClient.mockResolvedValue(supabase);

    const response = await createAdminNotification(
      request({
        channels: ['in_app'],
        message: 'Message',
        target_merchant_ids: [merchantId],
        target_type: 'specific',
        title: 'Title',
      }),
      'user-1'
    );

    expect(response.status).toBe(400);
    expect(supabase.inserted).toEqual([]);
  });

  it('returns 500 without exposing database details when creation fails', async () => {
    const supabase = createSupabase({ code: 'XX000', message: 'private' });
    mocks.createClient.mockResolvedValue(supabase);

    const response = await createAdminNotification(
      request({
        channels: ['in_app'],
        message: 'Maintenance notice',
        target_type: 'all',
        title: 'Maintenance',
      }),
      'user-1'
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Failed to create notification',
    });
  });
});
