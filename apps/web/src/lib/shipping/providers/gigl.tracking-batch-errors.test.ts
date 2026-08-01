import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GiglApiClient } from './gigl.auth';
import type { GiglProviderIo } from './gigl.constants';
import { trackGiglShipmentBatch } from './gigl.tracking-batch';

const token = {
  token: 'token',
  userChannelCode: 'channel',
  customerType: 1,
  expiresAt: Date.now() + 60_000,
};

function setupApi(envelope: unknown, status = 200) {
  const safeFetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(envelope), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  );
  const log = vi.fn();
  const io: GiglProviderIo = { safeFetch, log };
  const apiClient = new GiglApiClient(io);
  vi.spyOn(apiClient, 'getApiToken').mockResolvedValue(token);
  return { apiClient, io, log };
}

describe('trackGiglShipmentBatch errors', () => {
  beforeEach(() => {
    vi.stubEnv('GIGL_BASE_URL', 'https://gigl.test');
    vi.stubEnv('GIGL_TRACKING_BATCH_TIMEOUT_MS', '');
  });

  it('rejects non-OK responses and explicit failure envelopes', async () => {
    for (const [envelope, status] of [
      [{ error: 'provider failure' }, 503],
      [{ status: 400, success: false, message: 'Rejected', data: [] }, 200],
    ] as const) {
      const { apiClient, io } = setupApi(envelope, status);
      await expect(
        trackGiglShipmentBatch(apiClient, io, ['WB-1'])
      ).rejects.toThrow();
    }
  });

  it('cancels failed response bodies without reading or logging provider payloads', async () => {
    const { apiClient, io, log } = setupApi({});
    const cancel = vi.fn().mockRejectedValue(new Error('cancel failed'));
    const readPayload = vi.fn();
    vi.spyOn(apiClient, 'safeFetchEnvelopeWithAccessToken').mockResolvedValue({
      envelope: null,
      response: {
        ok: false,
        status: 503,
        body: { cancel },
        json: readPayload,
        text: readPayload,
      } as unknown as Response,
      tokenData: token,
    });

    await expect(
      trackGiglShipmentBatch(apiClient, io, ['PRIVATE-WAYBILL'])
    ).rejects.toThrow('Failed to track GIGL shipments');

    expect(cancel).toHaveBeenCalledOnce();
    expect(readPayload).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith('error', 'GIGL batch tracking failed', {
      status: 503,
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain('PRIVATE-WAYBILL');
  });

  it('converts provider timeout failures to a generic batch timeout', async () => {
    const { apiClient, io, log } = setupApi({});
    vi.spyOn(apiClient, 'getApiToken').mockRejectedValue(
      Object.assign(new Error('provider token timeout'), {
        name: 'TimeoutError',
      })
    );

    await expect(
      trackGiglShipmentBatch(apiClient, io, ['PRIVATE-WAYBILL'])
    ).rejects.toThrow('GIGL batch tracking timed out');
    expect(log).toHaveBeenCalledWith('warn', 'GIGL batch tracking timed out', {
      timeoutMs: 15_000,
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain('PRIVATE-WAYBILL');
  });
});
