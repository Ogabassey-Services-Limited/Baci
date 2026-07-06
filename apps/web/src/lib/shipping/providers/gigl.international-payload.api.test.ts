import { describe, expect, it, vi } from 'vitest';
import type { ShippingAddress } from '../types';
import type { GiglApiClient } from './gigl.auth';
import type { GiglToken } from './gigl.constants';
import {
  generateInternationalInvoiceLabel,
  resolveDestinationCountryId,
} from './gigl.international-payload';

const tokenData: GiglToken = {
  expiresAt: Date.now() + 60_000,
  token: 'token',
  userChannelCode: 'channel-code',
  customerType: 1,
};

const receiver: ShippingAddress = {
  name: 'Jane Receiver',
  phone: '+14165550123',
  address: '123 Queen Street West',
  city: 'Toronto',
  state: 'Ontario',
  country: 'Canada',
  countryCode: 'CA',
};

function response(status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
  } as Response;
}

function apiClientFor({
  envelope,
  parsedData = envelope?.data,
  parseError,
  responseStatus = 200,
}: {
  envelope?: { data?: unknown; status?: number };
  parsedData?: unknown;
  parseError?: Error;
  responseStatus?: number;
}): GiglApiClient {
  return {
    baseUrl: 'https://example.test',
    parseEnvelopeData: vi.fn(() => {
      if (parseError) throw parseError;
      return parsedData;
    }),
    safeFetchEnvelopeWithAccessToken: vi.fn().mockResolvedValue({
      envelope,
      response: response(responseStatus),
    }),
  } as unknown as GiglApiClient;
}

function ioForLabels() {
  return {
    log: vi.fn(),
    safeFetch: vi.fn(async () => response()),
  };
}

describe('GIGL international API payload helpers', () => {
  it('resolves destination country ids from eligible GIGL countries', async () => {
    const apiClient = apiClientFor({
      envelope: {
        status: 200,
        data: [
          {
            CountryId: 36,
            CountryName: 'Canada',
            CountryShortCode: 'CA',
            IsInternationalShippingCountry: true,
          },
        ],
      },
      parsedData: [
        {
          CountryId: 36,
          CountryName: 'Canada',
          CountryShortCode: 'CA',
          IsInternationalShippingCountry: true,
        },
      ],
    });

    await expect(
      resolveDestinationCountryId(
        apiClient,
        tokenData,
        { receiver },
        5000,
        AbortSignal.timeout(5000)
      )
    ).resolves.toEqual({ status: 'found', countryId: 36 });
  });

  it('handles failed destination country lookups', async () => {
    await expect(
      resolveDestinationCountryId(
        apiClientFor({
          envelope: { status: 500 },
          responseStatus: 200,
        }),
        tokenData,
        { receiver },
        5000,
        AbortSignal.timeout(5000)
      )
    ).resolves.toEqual({
      status: 'lookup_failed',
      envelopeStatus: 500,
      responseStatus: 200,
    });
    await expect(
      resolveDestinationCountryId(
        apiClientFor({
          envelope: { status: 200, data: [] },
          parseError: new Error('bad country payload'),
        }),
        tokenData,
        { receiver },
        5000,
        AbortSignal.timeout(5000)
      )
    ).rejects.toThrow('bad country payload');
  });

  it('generates international invoice labels when GIGL returns one', async () => {
    const apiClient = apiClientFor({
      envelope: {
        status: 200,
        data: { WaybillLabel: 'https://example.test/label.pdf' },
      },
      parsedData: { WaybillLabel: 'https://example.test/label.pdf' },
    });
    const io = ioForLabels();

    await expect(
      generateInternationalInvoiceLabel(
        apiClient,
        tokenData,
        'GIGL-INTL-1',
        io,
        AbortSignal.timeout(5000)
      )
    ).resolves.toBe('https://example.test/label.pdf');
  });

  it('returns no invoice label for failed or malformed invoice responses', async () => {
    const io = ioForLabels();

    await expect(
      generateInternationalInvoiceLabel(
        apiClientFor({
          envelope: { status: 500 },
          responseStatus: 200,
        }),
        tokenData,
        'GIGL-INTL-1',
        io,
        AbortSignal.timeout(5000)
      )
    ).resolves.toBeUndefined();
    await expect(
      generateInternationalInvoiceLabel(
        apiClientFor({
          envelope: { status: 200, data: {} },
          parseError: new Error('missing label'),
        }),
        tokenData,
        'GIGL-INTL-1',
        io,
        AbortSignal.timeout(5000)
      )
    ).resolves.toBeUndefined();
  });
});
