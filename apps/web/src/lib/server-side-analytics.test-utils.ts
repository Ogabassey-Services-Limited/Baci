import { expect, type Mock, vi } from 'vitest';

type FetchCall = [string, RequestInit];

type AnalyticsRequestBody = {
  event: string;
  eventData: Record<string, unknown>;
  merchantId: string;
  userData: Record<string, unknown>;
};

const merchantId = 'merch_123';
const mockUserData = {
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
};
const products = [{ id: 'p_1', name: 'Product 1', price: 100, quantity: 1 }];
const mockEventData = {
  value: 100,
  currency: 'USD',
  products,
};

function getFetchMock(): Mock {
  return global.fetch as Mock;
}

function getFetchCalls(): FetchCall[] {
  return getFetchMock().mock.calls as FetchCall[];
}

function mockSuccessfulFetch() {
  getFetchMock().mockResolvedValue({
    json: vi.fn().mockResolvedValue({ success: true }),
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseRequestBody(call: FetchCall): AnalyticsRequestBody {
  expect(call[1]).toBeDefined();
  expect(call[1].body).toBeDefined();
  if (typeof call[1].body !== 'string') {
    throw new TypeError('Expected analytics request body to be a JSON string');
  }
  const parsed: unknown = JSON.parse(call[1].body);
  if (
    !isRecord(parsed) ||
    typeof parsed.event !== 'string' ||
    !isRecord(parsed.eventData) ||
    typeof parsed.merchantId !== 'string' ||
    !isRecord(parsed.userData)
  ) {
    throw new TypeError('Parsed analytics request body has an invalid shape');
  }
  return parsed as AnalyticsRequestBody;
}

function expectAttributionData(body: AnalyticsRequestBody) {
  expect(body.merchantId).toBe(merchantId);
  expect(body.userData).toEqual(
    expect.objectContaining({ email: mockUserData.email })
  );
}

export const serverSideAnalyticsTestHarness = {
  expectAttributionData,
  getFetchCalls,
  getFetchMock,
  merchantId,
  mockEventData,
  mockSuccessfulFetch,
  mockUserData,
  parseRequestBody,
};
