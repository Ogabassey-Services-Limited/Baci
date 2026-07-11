import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAdminClient } from '@/lib/supabase/admin';
import { disablePaypalFeatureFlag } from './paypal-feature-flag';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

const MERCHANT_ID = 'merchant-1';

function makeFeatureSettingsClient(options: {
  customSettings?: Record<string, unknown> | null;
  loadError?: { message: string } | null;
  updateError?: { message: string } | null;
}) {
  const { customSettings = {}, loadError = null, updateError = null } = options;
  let mode: 'read' | 'update' = 'read';
  let updatePayload: Record<string, unknown> | null = null;
  const query = {
    select: vi.fn(() => {
      mode = 'read';
      return query;
    }),
    update: vi.fn((payload: Record<string, unknown>) => {
      mode = 'update';
      updatePayload = payload;
      return query;
    }),
    eq: vi.fn(() =>
      mode === 'update' ? Promise.resolve({ error: updateError }) : query
    ),
    maybeSingle: vi.fn(() =>
      Promise.resolve({
        data:
          customSettings === null ? null : { custom_settings: customSettings },
        error: loadError,
      })
    ),
  };

  return {
    from: vi.fn(() => query),
    getUpdatePayload: () => updatePayload,
  };
}

describe('disablePaypalFeatureFlag', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clears paypal_enabled while preserving other settings', async () => {
    const client = makeFeatureSettingsClient({
      customSettings: { paypal_enabled: true, paypal_mode: 'live', keep: 'me' },
    });
    vi.mocked(createAdminClient).mockReturnValue(client as never);

    await disablePaypalFeatureFlag(MERCHANT_ID);

    expect(client.getUpdatePayload()).toMatchObject({
      custom_settings: {
        paypal_enabled: false,
        paypal_mode: 'live',
        keep: 'me',
      },
    });
  });

  it('scrubs legacy plaintext PayPal secrets from custom_settings', async () => {
    const client = makeFeatureSettingsClient({
      customSettings: {
        paypal_enabled: true,
        paypal_client_id: 'legacy-id',
        paypal_secret_key: 'legacy-secret',
      },
    });
    vi.mocked(createAdminClient).mockReturnValue(client as never);

    await disablePaypalFeatureFlag(MERCHANT_ID);

    const custom = client.getUpdatePayload()?.custom_settings as Record<
      string,
      unknown
    >;
    expect(custom.paypal_enabled).toBe(false);
    expect(custom).not.toHaveProperty('paypal_client_id');
    expect(custom).not.toHaveProperty('paypal_secret_key');
  });

  it('no-ops when the merchant has no feature-settings row', async () => {
    const client = makeFeatureSettingsClient({ customSettings: null });
    vi.mocked(createAdminClient).mockReturnValue(client as never);

    await disablePaypalFeatureFlag(MERCHANT_ID);

    expect(client.getUpdatePayload()).toBeNull();
  });

  it('throws when the settings load fails', async () => {
    const client = makeFeatureSettingsClient({
      loadError: { message: 'load boom' },
    });
    vi.mocked(createAdminClient).mockReturnValue(client as never);

    await expect(disablePaypalFeatureFlag(MERCHANT_ID)).rejects.toThrow(
      /failed to load feature settings/
    );
  });

  it('throws when the flag update fails', async () => {
    const client = makeFeatureSettingsClient({
      customSettings: { paypal_enabled: true },
      updateError: { message: 'update boom' },
    });
    vi.mocked(createAdminClient).mockReturnValue(client as never);

    await expect(disablePaypalFeatureFlag(MERCHANT_ID)).rejects.toThrow(
      /failed to disable paypal flag/
    );
  });
});
