import type { SupabaseClient, User } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthResult } from '@/lib/api-auth';

const { mockGeneratePeppolInvoiceXml, mockResolveReceiptLogoDataUri } =
  vi.hoisted(() => ({
    mockGeneratePeppolInvoiceXml: vi.fn(() => '<Invoice />'),
    mockResolveReceiptLogoDataUri: vi.fn(
      (): Promise<string | null> => Promise.resolve(null)
    ),
  }));

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: vi.fn(),
}));

vi.mock('@/lib/receipt-pdf-generator', () => ({
  generateReceiptBlob: vi.fn(),
  resolveReceiptLogoDataUri: mockResolveReceiptLogoDataUri,
}));

vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: vi.fn(),
}));

vi.mock('@/lib/peppol-ubl-invoice', () => ({
  generatePeppolInvoiceXml: mockGeneratePeppolInvoiceXml,
  PEPPOL_BIS_BILLING_COMPLIANCE_NOTE:
    'This invoice complies with Peppol BIS Billing 3.0 through a generated UBL XML invoice artifact created from this order.',
}));

vi.mock('@/lib/storefront-account-document-data', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/storefront-account-document-data')
  >('@/lib/storefront-account-document-data');

  return {
    ...actual,
    getStorefrontAccountDocumentData: vi.fn(),
  };
});

import { authenticateApiRequest } from '@/lib/api-auth';
import { checkRateLimit } from '@/lib/rate-limiter';
import { generateReceiptBlob } from '@/lib/receipt-pdf-generator';
import {
  getStorefrontAccountDocumentData,
  StorefrontAccountDocumentError,
} from '@/lib/storefront-account-document-data';
import { GET } from './route';

type StorefrontAccountDocumentData = Awaited<
  ReturnType<typeof getStorefrontAccountDocumentData>
>;

function createAuthenticatedAuthResult(): AuthResult {
  return {
    user: { id: 'user-1' } as User,
    error: null,
    supabase: {} as SupabaseClient,
  };
}

function createDocumentData(
  orderNumber: string
): StorefrontAccountDocumentData {
  return {
    order: {
      id: 'order-1',
      order_number: orderNumber,
      created_at: '2026-03-22T10:00:00.000Z',
      total: 100000,
      payment_status: 'paid',
      shipping_status: 'processing',
      items: [],
      receipt_eligible: false,
      current_document_kind: 'invoice',
    },
    invoiceData: {
      invoice_number: orderNumber,
    } as StorefrontAccountDocumentData['invoiceData'],
    receiptOrder: {} as StorefrontAccountDocumentData['receiptOrder'],
    receiptMerchant: {} as StorefrontAccountDocumentData['receiptMerchant'],
  } as StorefrontAccountDocumentData;
}

describe('GET /api/storefront/account/orders/[id]/invoice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkRateLimit).mockResolvedValue(true);
    mockGeneratePeppolInvoiceXml.mockReturnValue('<Invoice />');
    mockResolveReceiptLogoDataUri.mockResolvedValue(
      'data:image/png;base64,AA=='
    );
  });

  it('returns 401 when the customer is not authenticated', async () => {
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      user: null,
      error: 'Not authenticated',
      supabase: null,
    });

    const response = await GET(
      new NextRequest(
        'http://localhost/api/storefront/account/orders/cfa945fc-9bf4-4485-857c-4d4374adf31f/invoice?merchantSlug=ogabassey'
      ),
      {
        params: Promise.resolve({
          id: 'cfa945fc-9bf4-4485-857c-4d4374adf31f',
        }),
      }
    );

    expect(response.status).toBe(401);
  });

  it('returns 429 when the download rate limit is exceeded', async () => {
    vi.mocked(authenticateApiRequest).mockResolvedValue(
      createAuthenticatedAuthResult()
    );
    vi.mocked(checkRateLimit).mockResolvedValue(false);

    const response = await GET(
      new NextRequest(
        'http://localhost/api/storefront/account/orders/cfa945fc-9bf4-4485-857c-4d4374adf31f/invoice?merchantSlug=ogabassey'
      ),
      {
        params: Promise.resolve({
          id: 'cfa945fc-9bf4-4485-857c-4d4374adf31f',
        }),
      }
    );

    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('60');
    await expect(response.json()).resolves.toEqual({
      error: 'Rate limit exceeded. Please try again later.',
    });
  });

  it('returns 400 when merchantSlug is missing', async () => {
    vi.mocked(authenticateApiRequest).mockResolvedValue(
      createAuthenticatedAuthResult()
    );

    const response = await GET(
      new NextRequest(
        'http://localhost/api/storefront/account/orders/cfa945fc-9bf4-4485-857c-4d4374adf31f/invoice'
      ),
      {
        params: Promise.resolve({
          id: 'cfa945fc-9bf4-4485-857c-4d4374adf31f',
        }),
      }
    );

    expect(response.status).toBe(400);
  });

  it('returns 400 when the order id is invalid', async () => {
    vi.mocked(authenticateApiRequest).mockResolvedValue(
      createAuthenticatedAuthResult()
    );

    const response = await GET(
      new NextRequest(
        'http://localhost/api/storefront/account/orders/not-a-uuid/invoice?merchantSlug=ogabassey'
      ),
      {
        params: Promise.resolve({
          id: 'not-a-uuid',
        }),
      }
    );

    expect(response.status).toBe(400);
  });

  it('returns a sanitized PDF download for a valid customer-owned order', async () => {
    vi.mocked(authenticateApiRequest).mockResolvedValue(
      createAuthenticatedAuthResult()
    );
    vi.mocked(getStorefrontAccountDocumentData).mockResolvedValue(
      createDocumentData('ORD-1001\r\nSet-Cookie: evil')
    );
    vi.mocked(generateReceiptBlob).mockReturnValue(new Blob(['invoice']));

    const response = await GET(
      new NextRequest(
        'http://localhost/api/storefront/account/orders/cfa945fc-9bf4-4485-857c-4d4374adf31f/invoice?merchantSlug=ogabassey'
      ),
      {
        params: Promise.resolve({
          id: 'cfa945fc-9bf4-4485-857c-4d4374adf31f',
        }),
      }
    );

    const contentDisposition = response.headers.get('content-disposition');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(generateReceiptBlob).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      {
        complianceNote: expect.stringContaining('Peppol BIS Billing 3.0'),
        documentKind: 'invoice',
        logoDataUri: 'data:image/png;base64,AA==',
      }
    );
    expect(contentDisposition).toContain(
      'invoice-ORD-1001-Set-Cookie-evil.pdf'
    );
    expect(contentDisposition).not.toContain('\r');
    expect(contentDisposition).not.toContain('\n');
  });

  it('maps document access errors to API responses', async () => {
    vi.mocked(authenticateApiRequest).mockResolvedValue(
      createAuthenticatedAuthResult()
    );
    vi.mocked(getStorefrontAccountDocumentData).mockRejectedValue(
      new StorefrontAccountDocumentError('Order not found', 404, 'NOT_FOUND')
    );

    const response = await GET(
      new NextRequest(
        'http://localhost/api/storefront/account/orders/cfa945fc-9bf4-4485-857c-4d4374adf31f/invoice?merchantSlug=ogabassey'
      ),
      {
        params: Promise.resolve({
          id: 'cfa945fc-9bf4-4485-857c-4d4374adf31f',
        }),
      }
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: 'Order not found',
      code: 'NOT_FOUND',
    });
  });

  it('logs and returns 500 for unexpected failures', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    vi.mocked(authenticateApiRequest).mockResolvedValue(
      createAuthenticatedAuthResult()
    );
    vi.mocked(getStorefrontAccountDocumentData).mockRejectedValue(
      new Error('Invoice generation failed')
    );

    const response = await GET(
      new NextRequest(
        'http://localhost/api/storefront/account/orders/cfa945fc-9bf4-4485-857c-4d4374adf31f/invoice?merchantSlug=ogabassey'
      ),
      {
        params: Promise.resolve({
          id: 'cfa945fc-9bf4-4485-857c-4d4374adf31f',
        }),
      }
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Internal server error',
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Unexpected storefront invoice download error:',
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });
});
