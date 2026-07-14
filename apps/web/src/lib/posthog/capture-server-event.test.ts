import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const postHogMocks = vi.hoisted(() => ({
  captureImmediate: vi.fn(),
  postHogConstructor: vi.fn(),
}));

vi.mock('posthog-node', () => ({
  PostHog: vi.fn().mockImplementation(function PostHogMock(
    token: string,
    options: unknown
  ) {
    postHogMocks.postHogConstructor(token, options);
    return {
      captureExceptionImmediate: vi.fn(),
      captureImmediate: postHogMocks.captureImmediate,
    };
  }),
}));

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

describe('captureServerEvent', () => {
  const originalProjectToken = process.env.POSTHOG_PROJECT_TOKEN;
  const originalPublicToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

  beforeEach(() => {
    vi.resetModules();
    postHogMocks.captureImmediate.mockReset();
    postHogMocks.postHogConstructor.mockReset();
    // `getServerToken` falls back to the public token, so BOTH must be cleared
    // for the unconfigured case to actually be unconfigured.
    delete process.env.POSTHOG_PROJECT_TOKEN;
    delete process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  });

  afterEach(() => {
    restoreEnv('POSTHOG_PROJECT_TOKEN', originalProjectToken);
    restoreEnv('NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN', originalPublicToken);
  });

  it('does not capture when the server client is unconfigured', async () => {
    const { captureServerEvent } = await import('./server');

    await expect(
      captureServerEvent(
        'wallet_funding_transfer_credited',
        { amount: 5000 },
        'customer-1'
      )
    ).resolves.toBe(false);
    expect(postHogMocks.postHogConstructor).not.toHaveBeenCalled();
    expect(postHogMocks.captureImmediate).not.toHaveBeenCalled();
  });

  it('falls back to the public token when only it is configured', async () => {
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = 'ph_public';
    postHogMocks.captureImmediate.mockResolvedValueOnce(undefined as never);
    const { captureServerEvent } = await import('./server');

    // The public-token fallback is intentional — which is exactly why the
    // unconfigured case above has to clear this token too.
    await expect(
      captureServerEvent(
        'wallet_funding_transfer_credited',
        { amount: 5000 },
        'customer-1'
      )
    ).resolves.toBe(true);
    expect(postHogMocks.postHogConstructor).toHaveBeenCalledWith(
      'ph_public',
      expect.anything()
    );
  });

  it('captures the event with the customer distinct id and sanitized properties', async () => {
    process.env.POSTHOG_PROJECT_TOKEN = 'ph_test';
    postHogMocks.captureImmediate.mockResolvedValueOnce(undefined as never);
    const { captureServerEvent } = await import('./server');

    await expect(
      captureServerEvent(
        'wallet_funding_transfer_credited',
        {
          amount: 5000,
          currency: 'NGN',
          customer_id: 'customer-1',
          gateway: 'paystack',
          gateway_reference: 'PSK_REF_1',
          merchant_id: 'merchant-1',
        },
        'customer-1'
      )
    ).resolves.toBe(true);

    expect(postHogMocks.captureImmediate).toHaveBeenCalledWith({
      distinctId: 'customer-1',
      event: 'wallet_funding_transfer_credited',
      properties: expect.objectContaining({
        app_surface: 'web',
        runtime: 'nodejs',
        amount: 5000,
        currency: 'NGN',
        customer_id: 'customer-1',
        gateway: 'paystack',
        gateway_reference: 'PSK_REF_1',
        merchant_id: 'merchant-1',
      }),
    });
  });

  it('forwards a deterministic uuid so ingestion can dedupe concurrent emitters', async () => {
    process.env.POSTHOG_PROJECT_TOKEN = 'ph_test';
    postHogMocks.captureImmediate.mockResolvedValueOnce(undefined as never);
    const { captureServerEvent } = await import('./server');

    await captureServerEvent(
      'wallet_funding_transfer_credited',
      { amount: 5000 },
      'customer-1',
      'e3f1a6d2-8c47-5b09-9d15-2f6b71c0a884'
    );

    expect(postHogMocks.captureImmediate).toHaveBeenCalledWith(
      expect.objectContaining({
        uuid: 'e3f1a6d2-8c47-5b09-9d15-2f6b71c0a884',
      })
    );
  });

  it('forwards a stable timestamp so the dedupe key is complete', async () => {
    process.env.POSTHOG_PROJECT_TOKEN = 'ph_test';
    postHogMocks.captureImmediate.mockResolvedValueOnce(undefined as never);
    const stableTimestamp = new Date('2026-07-13T10:11:12.000Z');
    const { captureServerEvent } = await import('./server');

    await captureServerEvent(
      'wallet_funding_transfer_credited',
      { amount: 5000 },
      'customer-1',
      'e3f1a6d2-8c47-5b09-9d15-2f6b71c0a884',
      stableTimestamp
    );

    // PostHog dedupes only on uuid + event + distinct id + timestamp, so the
    // timestamp must reach the SDK rather than being stamped per call.
    expect(postHogMocks.captureImmediate).toHaveBeenCalledWith(
      expect.objectContaining({
        uuid: 'e3f1a6d2-8c47-5b09-9d15-2f6b71c0a884',
        timestamp: stableTimestamp,
      })
    );
  });

  it('omits the uuid and timestamp fields entirely when none are provided', async () => {
    process.env.POSTHOG_PROJECT_TOKEN = 'ph_test';
    postHogMocks.captureImmediate.mockResolvedValueOnce(undefined as never);
    const { captureServerEvent } = await import('./server');

    await captureServerEvent(
      'wallet_funding_transfer_credited',
      { amount: 5000 },
      'customer-1'
    );

    const call = postHogMocks.captureImmediate.mock.calls.at(-1)?.[0] as
      | Record<string, unknown>
      | undefined;
    expect(call).toBeDefined();
    expect(call && 'uuid' in call).toBe(false);
    expect(call && 'timestamp' in call).toBe(false);
  });

  it('returns false without throwing when the immediate send rejects', async () => {
    process.env.POSTHOG_PROJECT_TOKEN = 'ph_test';
    postHogMocks.captureImmediate.mockRejectedValueOnce(
      new Error('network down') as never
    );
    const { captureServerEvent } = await import('./server');

    await expect(
      captureServerEvent(
        'wallet_funding_transfer_credited',
        { amount: 5000 },
        'customer-1'
      )
    ).resolves.toBe(false);
  });

  it('returns false when the immediate send exceeds the capture timeout', async () => {
    vi.useFakeTimers();
    try {
      process.env.POSTHOG_PROJECT_TOKEN = 'ph_test';
      postHogMocks.captureImmediate.mockReturnValueOnce(
        new Promise(() => {
          // Intentionally never settles — exercises the capture timeout race.
        }) as never
      );
      const { captureServerEvent } = await import('./server');

      const result = captureServerEvent(
        'wallet_funding_transfer_credited',
        { amount: 5000 },
        'customer-1'
      );

      await vi.advanceTimersByTimeAsync(3_000);

      await expect(result).resolves.toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
