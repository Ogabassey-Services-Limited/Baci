import { describe, expect, it, vi } from 'vitest';
import type { JumiaClient } from '@/lib/jumia/client';
import {
  createConsignmentOrder,
  getConsignmentStock,
  updateConsignmentOrder,
} from '@/lib/jumia/consignment';

function createMockClient(response: unknown): JumiaClient {
  return {
    request: vi.fn().mockResolvedValue(response),
  } as unknown as JumiaClient;
}

function createRejectingMockClient(error: Error): JumiaClient {
  return {
    request: vi.fn().mockRejectedValue(error),
  } as unknown as JumiaClient;
}

function getCalledRequestParams(client: JumiaClient): URLSearchParams {
  const calledPath = (client.request as ReturnType<typeof vi.fn>).mock
    .calls[0][1] as string;
  const qsIndex = calledPath.indexOf('?');
  if (qsIndex === -1) return new URLSearchParams();
  return new URLSearchParams(calledPath.slice(qsIndex + 1));
}

describe('createConsignmentOrder', () => {
  it('calls POST /consignment-order with correct body', async () => {
    const mockResponse = { purchaseOrderNumber: 'PO-2026-001' };
    const client = createMockClient(mockResponse);

    const result = await createConsignmentOrder(client, {
      shopId: 'SHOP-1',
      businessClientCode: 'jumia_ng',
      shippingDate: '2026-04-01',
      products: [{ sku: 'SKU-1', quantity: 10, labelCode: 'LBL-1' }],
      comment: 'Urgent shipment',
    });

    expect(client.request).toHaveBeenCalledWith(
      'POST',
      '/consignment-order',
      expect.objectContaining({ parse: expect.any(Function) }),
      {
        shopId: 'SHOP-1',
        businessClientCode: 'jumia_ng',
        shippingDate: '2026-04-01',
        products: [{ sku: 'SKU-1', quantity: 10, labelCode: 'LBL-1' }],
        comment: 'Urgent shipment',
      }
    );
    expect(result).toEqual(mockResponse);
  });

  it('propagates errors when client.request rejects', async () => {
    const client = createRejectingMockClient(new Error('API timeout'));

    await expect(
      createConsignmentOrder(client, {
        shopId: 'SHOP-1',
        businessClientCode: 'jumia_ng',
        shippingDate: '2026-04-01',
        products: [{ sku: 'SKU-1', quantity: 10, labelCode: 'LBL-1' }],
      })
    ).rejects.toThrow('API timeout');
  });

  it('throws on empty products array', async () => {
    const client = createMockClient({});

    await expect(
      createConsignmentOrder(client, {
        shopId: 'SHOP-1',
        businessClientCode: 'jumia_ng',
        shippingDate: '2026-04-01',
        products: [],
      })
    ).rejects.toThrow('products must be a non-empty array');

    expect(client.request).not.toHaveBeenCalled();
  });
});

describe('updateConsignmentOrder', () => {
  it('calls PATCH /consignment-order/:id with body and maps thirdPartyLogisticsName to 3plName', async () => {
    const client = createMockClient(undefined);

    await updateConsignmentOrder(client, 'PO-2026-001', {
      isShipped: true,
      trackingNumber: 'TRK-123',
      thirdPartyLogisticsName: 'GIG Logistics',
    });

    expect(client.request).toHaveBeenCalledWith(
      'PATCH',
      '/consignment-order/PO-2026-001',
      undefined,
      {
        isShipped: true,
        trackingNumber: 'TRK-123',
        '3plName': 'GIG Logistics',
      }
    );
  });

  it('encodes purchaseOrderNumber in URL', async () => {
    const client = createMockClient(undefined);

    await updateConsignmentOrder(client, 'PO/2026 001', {
      isShipped: false,
    });

    expect(client.request).toHaveBeenCalledWith(
      'PATCH',
      `/consignment-order/${encodeURIComponent('PO/2026 001')}`,
      undefined,
      { isShipped: false }
    );
  });

  it('encodes special characters (#, &, +) in purchaseOrderNumber', async () => {
    const client = createMockClient(undefined);

    await updateConsignmentOrder(client, 'PO#100&rev=2+final', {
      trackingNumber: 'TRK-999',
    });

    expect(client.request).toHaveBeenCalledWith(
      'PATCH',
      `/consignment-order/${encodeURIComponent('PO#100&rev=2+final')}`,
      undefined,
      { trackingNumber: 'TRK-999' }
    );
  });

  it('propagates errors when client.request rejects', async () => {
    const client = createRejectingMockClient(new Error('Network failure'));

    await expect(
      updateConsignmentOrder(client, 'PO-001', { isShipped: true })
    ).rejects.toThrow('Network failure');
  });
});

describe('getConsignmentStock', () => {
  it('calls GET /consignment-stock with query params', async () => {
    const mockResponse = {
      simpleSku: 'SKU-123',
      received: 100,
      quarantined: 5,
      defective: 2,
      canceled: 0,
      returned: 3,
      failed: 1,
    };
    const client = createMockClient(mockResponse);

    const result = await getConsignmentStock(client, 'jumia_ng', 'SKU-123');

    const requestMock = client.request as ReturnType<typeof vi.fn>;
    expect(requestMock.mock.calls[0][0]).toBe('GET');
    expect(requestMock.mock.calls[0][1]).toContain('/consignment-stock');
    const params = getCalledRequestParams(client);
    expect(params.get('businessClientCode')).toBe('jumia_ng');
    expect(params.get('sku')).toBe('SKU-123');
    expect(result).toEqual(mockResponse);
  });

  it('URL-encodes special characters in businessClientCode and sku', async () => {
    const mockResponse = {
      simpleSku: 'SKU/A&B',
      received: 10,
      quarantined: 0,
      defective: 0,
      canceled: 0,
      returned: 0,
      failed: 0,
    };
    const client = createMockClient(mockResponse);

    await getConsignmentStock(client, 'code/a&b', 'SKU/A&B');

    const params = getCalledRequestParams(client);
    expect(params.get('businessClientCode')).toBe('code/a&b');
    expect(params.get('sku')).toBe('SKU/A&B');
  });

  it('returns correct stock breakdown values including zero edge case', async () => {
    const mockResponse = {
      simpleSku: 'SKU-456',
      received: 50,
      quarantined: 10,
      defective: 3,
      canceled: 0,
      returned: 7,
      failed: 0,
    };
    const client = createMockClient(mockResponse);

    const result = await getConsignmentStock(client, 'jumia_ke', 'SKU-456');

    expect(result.simpleSku).toBe('SKU-456');
    expect(result.received).toBe(50);
    expect(result.quarantined).toBe(10);
    expect(result.defective).toBe(3);
    expect(result.canceled).toBe(0);
    expect(result.returned).toBe(7);
    expect(result.failed).toBe(0);
  });

  it('propagates errors when client.request rejects', async () => {
    const client = createRejectingMockClient(new Error('Service down'));

    await expect(
      getConsignmentStock(client, 'jumia_ng', 'SKU-1')
    ).rejects.toThrow('Service down');
  });
});
