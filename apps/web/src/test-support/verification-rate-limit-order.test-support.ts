import { expect, it } from 'vitest';

interface AsyncMock {
  mockResolvedValue(value: unknown): AsyncMock;
  mockResolvedValueOnce(value: unknown): AsyncMock;
}

interface CallTrackingMock {
  mockResolvedValue(value: unknown): unknown;
}

interface VerificationRateLimitOrderHarness<TRequest> {
  checkRateLimit: AsyncMock;
  createMalformedRequest: () => TRequest;
  createValidRequest: () => TRequest;
  getMerchantForApiRequest: CallTrackingMock;
  post: (request: TRequest) => Promise<Response>;
  preflightEndpoint: string;
  providerEndpoint: string;
  providerMaxRequests: number;
  setAuthorizedMerchantAndSupabase: () => object;
  userId: string;
  assertMalformedRequest?: (request: TRequest) => void;
  assertPreflightRequest?: (request: TRequest) => void;
}

export function defineVerificationRateLimitOrderTests<TRequest>(
  harness: VerificationRateLimitOrderHarness<TRequest>
) {
  it('does not consume quota for a malformed request', async () => {
    const request = harness.createMalformedRequest();

    const response = await harness.post(request);

    expect(response.status).toBe(400);
    expect(harness.checkRateLimit).not.toHaveBeenCalled();
    expect(harness.getMerchantForApiRequest).not.toHaveBeenCalled();
    harness.assertMalformedRequest?.(request);
  });

  it('does not consume quota for an inaccessible requested merchant', async () => {
    harness.getMerchantForApiRequest.mockResolvedValue(null);

    const response = await harness.post(harness.createValidRequest());

    expect(response.status).toBe(404);
    expect(harness.checkRateLimit).not.toHaveBeenCalled();
  });

  it('checks preflight quota after merchant authorization', async () => {
    harness.checkRateLimit.mockResolvedValue(false);
    const supabase = harness.setAuthorizedMerchantAndSupabase();
    const request = harness.createValidRequest();

    const response = await harness.post(request);

    expect(response.status).toBe(429);
    expect(harness.getMerchantForApiRequest).toHaveBeenCalledOnce();
    expect(harness.checkRateLimit).toHaveBeenCalledExactlyOnceWith(
      supabase,
      harness.userId,
      harness.preflightEndpoint,
      30,
      1
    );
    harness.assertPreflightRequest?.(request);
  });

  it('checks the provider quota after authorized merchant access', async () => {
    const supabase = harness.setAuthorizedMerchantAndSupabase();
    harness.checkRateLimit
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    const response = await harness.post(harness.createValidRequest());

    expect(response.status).toBe(429);
    expect(harness.checkRateLimit).toHaveBeenNthCalledWith(
      1,
      supabase,
      harness.userId,
      harness.preflightEndpoint,
      30,
      1
    );
    expect(harness.checkRateLimit).toHaveBeenNthCalledWith(
      2,
      supabase,
      harness.userId,
      harness.providerEndpoint,
      harness.providerMaxRequests,
      1
    );
  });
}
