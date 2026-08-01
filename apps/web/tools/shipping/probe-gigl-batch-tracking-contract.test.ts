import { describe, expect, it, vi } from 'vitest';
import {
  type GiglBatchProbeClient,
  runGiglBatchTrackingContractProbe,
  runGiglBatchTrackingContractProbeCli,
} from './probe-gigl-batch-tracking-contract';

const WAYBILL = 'WAYBILL-SENTINEL-123';
const CUSTOMER = 'CUSTOMER-SENTINEL-456';
const PAYLOAD = 'PAYLOAD-SENTINEL-789';

function createClient(
  envelope: Record<string, unknown> = {
    status: 200,
    success: true,
    message: 'ok',
    data: [
      {
        Waybill: WAYBILL,
        CustomerName: CUSTOMER,
        MobileShipmentTrackings: [{ Status: 'OKT', Payload: PAYLOAD }],
      },
    ],
  }
): GiglBatchProbeClient {
  return {
    baseUrl: 'https://example.test',
    getApiToken: vi.fn().mockResolvedValue({
      token: 'TOKEN-SENTINEL',
      userChannelCode: 'CHANNEL-SENTINEL',
      customerType: 1,
      expiresAt: Date.now() + 60_000,
    }),
    safeFetchEnvelopeWithAccessToken: vi.fn().mockResolvedValue({
      envelope,
      response: new Response(null, { status: 200 }),
      tokenData: {
        token: 'TOKEN-SENTINEL',
        userChannelCode: 'CHANNEL-SENTINEL',
        customerType: 1,
        expiresAt: Date.now() + 60_000,
      },
    }),
  };
}

describe('runGiglBatchTrackingContractProbe', () => {
  it('refuses to run unless the strict probe gate is enabled', async () => {
    const client = createClient();

    await expect(
      runGiglBatchTrackingContractProbe(
        {
          BACI_GIGL_TRACKING_CONTRACT_PROBE: 'true',
          GIGL_TRACKING_PROBE_WAYBILL: WAYBILL,
        },
        client,
        vi.fn()
      )
    ).rejects.toThrow('BACI_GIGL_TRACKING_CONTRACT_PROBE=1');
    expect(client.getApiToken).not.toHaveBeenCalled();
  });

  it('requires exactly one nonblank waybill environment value', async () => {
    const client = createClient();
    const run = (waybill: string | undefined) =>
      runGiglBatchTrackingContractProbe(
        {
          BACI_GIGL_TRACKING_CONTRACT_PROBE: '1',
          GIGL_TRACKING_PROBE_WAYBILL: waybill,
        },
        client,
        vi.fn()
      );

    await expect(run(undefined)).rejects.toThrow('GIGL_TRACKING_PROBE_WAYBILL');
    await expect(run('   ')).rejects.toThrow('GIGL_TRACKING_PROBE_WAYBILL');
  });

  it('uses the client token API and posts exactly one waybill to the batch endpoint', async () => {
    const client = createClient();
    const output = vi.fn();

    await runGiglBatchTrackingContractProbe(
      {
        BACI_GIGL_TRACKING_CONTRACT_PROBE: '1',
        GIGL_TRACKING_PROBE_WAYBILL: WAYBILL,
      },
      client,
      output
    );

    expect(client.getApiToken).toHaveBeenCalledOnce();
    expect(client.safeFetchEnvelopeWithAccessToken).toHaveBeenCalledWith(
      'https://example.test/track/multipleMobileShipment',
      expect.objectContaining({ token: 'TOKEN-SENTINEL' }),
      expect.any(Function),
      expect.objectContaining({ maxResponseBytes: expect.any(Number) })
    );
    const requestBuilder = vi.mocked(client.safeFetchEnvelopeWithAccessToken)
      .mock.calls[0]?.[2];
    expect(
      requestBuilder?.({
        token: 'TOKEN-SENTINEL',
        userChannelCode: 'CHANNEL-SENTINEL',
        customerType: 1,
        expiresAt: Date.now() + 60_000,
      })
    ).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ Waybill: [WAYBILL] }),
    });
  });

  it('prints only a redacted structural report', async () => {
    const client = createClient();
    const output = vi.fn();

    await runGiglBatchTrackingContractProbe(
      {
        BACI_GIGL_TRACKING_CONTRACT_PROBE: '1',
        GIGL_TRACKING_PROBE_WAYBILL: WAYBILL,
      },
      client,
      output
    );

    expect(output).toHaveBeenCalledOnce();
    const report = JSON.parse(output.mock.calls[0]?.[0] as string) as Record<
      string,
      unknown
    >;
    expect(report).toEqual({
      httpStatus: 200,
      normalizedEnvelopeKeys: ['data', 'message', 'status', 'success'],
      dataKind: 'array',
      shipmentKeys: ['CustomerName', 'MobileShipmentTrackings', 'Waybill'],
      eventKeys: ['Payload', 'Status'],
    });
    const serialized = output.mock.calls[0]?.[0] as string;
    expect(serialized).not.toContain(WAYBILL);
    expect(serialized).not.toContain(CUSTOMER);
    expect(serialized).not.toContain(PAYLOAD);
    expect(serialized).not.toContain('TOKEN-SENTINEL');
  });

  it('does not establish a batch contract from an unsuccessful GIGL envelope', async () => {
    const client = createClient({
      status: 200,
      success: false,
      message: 'Waybill was not found',
      data: [
        {
          Waybill: WAYBILL,
          CustomerName: CUSTOMER,
          MobileShipmentTrackings: [{ Status: 'OKT', Payload: PAYLOAD }],
        },
      ],
    });
    const output = vi.fn();

    await expect(
      runGiglBatchTrackingContractProbe(
        {
          BACI_GIGL_TRACKING_CONTRACT_PROBE: '1',
          GIGL_TRACKING_PROBE_WAYBILL: WAYBILL,
        },
        client,
        output
      )
    ).rejects.toThrow(
      'GIGL batch tracking probe returned a non-success response'
    );

    expect(output).not.toHaveBeenCalled();
  });

  it('does not establish a batch contract from a failed HTTP response with a deceptive envelope', async () => {
    const client = createClient();
    const output = vi.fn();
    vi.mocked(client.safeFetchEnvelopeWithAccessToken).mockResolvedValue({
      envelope: {
        status: 200,
        success: true,
        data: [{ Waybill: WAYBILL }],
      },
      response: new Response(null, { status: 500 }),
      tokenData: {
        token: 'TOKEN-SENTINEL',
        userChannelCode: 'CHANNEL-SENTINEL',
        customerType: 1,
        expiresAt: Date.now() + 60_000,
      },
    });

    await expect(
      runGiglBatchTrackingContractProbe(
        {
          BACI_GIGL_TRACKING_CONTRACT_PROBE: '1',
          GIGL_TRACKING_PROBE_WAYBILL: WAYBILL,
        },
        client,
        output
      )
    ).rejects.toThrow(
      'GIGL batch tracking probe returned a non-success response'
    );

    expect(output).not.toHaveBeenCalled();
  });

  it('prints only the generic failure message when an API error contains probe secrets', async () => {
    const client = createClient();
    const stderr = vi.fn();
    vi.mocked(client.getApiToken).mockRejectedValue(
      new Error(`authentication failed for ${WAYBILL} with TOKEN-SENTINEL`)
    );

    const exitCode = await runGiglBatchTrackingContractProbeCli(
      {
        BACI_GIGL_TRACKING_CONTRACT_PROBE: '1',
        GIGL_TRACKING_PROBE_WAYBILL: WAYBILL,
      },
      () => client,
      vi.fn(),
      stderr
    );

    expect(exitCode).toBe(1);
    expect(stderr).toHaveBeenCalledWith(
      'GIGL batch tracking contract probe failed\n'
    );
    const output = stderr.mock.calls.flat().join('');
    expect(output).not.toContain(WAYBILL);
    expect(output).not.toContain('TOKEN-SENTINEL');
  });
});
