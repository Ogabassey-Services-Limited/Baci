import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({ logger: { error: mocks.loggerError } }));
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));

import { updateAdminNotification } from './notification-update-handler';

const notificationId = '123e4567-e89b-12d3-a456-426614174000';

function request(body: unknown) {
  return new Request('http://localhost', {
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
    method: 'PATCH',
  });
}

function createSupabase(options?: {
  existing?: Record<string, unknown>;
  updated?: Record<string, unknown> | null;
}) {
  const updates: Record<string, unknown>[] = [];
  const existing = options?.existing ?? {
    delivery_state: 'pending',
    expires_at: null,
    id: notificationId,
    scheduled_for: null,
    sent_at: null,
    target_segment: null,
    target_type: 'all',
  };
  const query = {
    eq: vi.fn(),
    is: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: options?.updated ?? { id: notificationId, title: 'Updated' },
      error: null,
    }),
    select: vi.fn(),
    single: vi.fn().mockResolvedValue({ data: existing, error: null }),
    update: vi.fn((value: Record<string, unknown>) => {
      updates.push(value);
      return query;
    }),
  };
  query.eq.mockReturnValue(query);
  query.is.mockReturnValue(query);
  query.select.mockReturnValue(query);
  return { from: vi.fn(() => query), query, updates };
}

describe('updateAdminNotification', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects malformed JSON before attempting an update', async () => {
    mocks.createClient.mockResolvedValue(createSupabase());
    const malformed = new Request('http://localhost', {
      body: '{',
      method: 'PATCH',
    });

    const response = await updateAdminNotification(malformed, notificationId);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid JSON body',
    });
  });

  it('refuses changes once notification delivery has started', async () => {
    const supabase = createSupabase({
      existing: {
        delivery_state: 'processing',
        expires_at: null,
        id: notificationId,
        scheduled_for: null,
        sent_at: null,
        target_segment: null,
        target_type: 'all',
      },
    });
    mocks.createClient.mockResolvedValue(supabase);

    const response = await updateAdminNotification(
      request({ title: 'Updated' }),
      notificationId
    );

    expect(response.status).toBe(409);
    expect(supabase.query.update).not.toHaveBeenCalled();
  });

  it('trims values and applies a pending-state compare-and-update guard', async () => {
    const supabase = createSupabase();
    mocks.createClient.mockResolvedValue(supabase);

    const response = await updateAdminNotification(
      request({ title: '  Updated title  ' }),
      notificationId
    );

    expect(response.status).toBe(200);
    expect(supabase.updates).toEqual([{ title: 'Updated title' }]);
    expect(supabase.query.eq).toHaveBeenCalledWith('delivery_state', 'pending');
    expect(supabase.query.is).toHaveBeenCalledWith('sent_at', null);
  });

  it('rejects expiration before the current effective send time', async () => {
    const supabase = createSupabase({
      existing: {
        delivery_state: 'pending',
        expires_at: null,
        id: notificationId,
        scheduled_for: '2030-01-02T10:00:00.000Z',
        sent_at: null,
        target_segment: null,
        target_type: 'all',
      },
    });
    mocks.createClient.mockResolvedValue(supabase);

    const response = await updateAdminNotification(
      request({ expires_at: '2030-01-01T10:00:00.000Z' }),
      notificationId
    );

    expect(response.status).toBe(400);
    expect(supabase.query.update).not.toHaveBeenCalled();
  });
});
