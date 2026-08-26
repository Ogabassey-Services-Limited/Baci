import { describe, expect, it, vi } from 'vitest';
import { isFollowUpNotificationsEnabled } from './follow-up-notification-preferences';

function createClient(result: { data: unknown; error: unknown }) {
  const query = {
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
    select: vi.fn().mockReturnThis(),
  };

  return {
    from: vi.fn().mockReturnValue(query),
    query,
  };
}

describe('isFollowUpNotificationsEnabled', () => {
  it('returns the stored preference when a merchant has opted out', async () => {
    const client = createClient({
      data: { follow_up_notifications_enabled: false },
      error: null,
    });

    const enabled = await isFollowUpNotificationsEnabled(
      client as never,
      'merchant-123'
    );

    expect(enabled).toBe(false);
    expect(client.from).toHaveBeenCalledWith('notification_preferences');
    expect(client.query.select).toHaveBeenCalledWith(
      'follow_up_notifications_enabled'
    );
    expect(client.query.eq).toHaveBeenCalledWith('merchant_id', 'merchant-123');
  });

  it('defaults to enabled when no preference row exists', async () => {
    const client = createClient({ data: null, error: null });

    await expect(
      isFollowUpNotificationsEnabled(client as never, 'merchant-123')
    ).resolves.toBe(true);
  });

  it('fails open when the preference lookup errors', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const client = createClient({
      data: null,
      error: { message: 'temporary database outage' },
    });

    await expect(
      isFollowUpNotificationsEnabled(client as never, 'merchant-123')
    ).resolves.toBe(true);
    expect(warn).toHaveBeenCalledWith(
      '[notifications] Failed to read follow-up alert preference; keeping alerts enabled',
      'temporary database outage'
    );
    warn.mockRestore();
  });
});
