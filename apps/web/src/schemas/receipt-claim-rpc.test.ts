import { describe, expect, it } from 'vitest';
import {
  createReceiptClaimResultSchema,
  receiptClaimRecordSchema,
  redeemReceiptClaimResultSchema,
} from '@/schemas/receipt-claim-rpc';

describe('receipt claim RPC schemas', () => {
  it('accepts preview claim records returned by the preview RPC', () => {
    expect(
      receiptClaimRecordSchema.safeParse({
        claimed_at: null,
        claimed_by_user_id: null,
        customer_email: 'ada@example.com',
        customer_id: 'customer-1',
        customer_name: 'Ada',
        expires_at: '2099-01-01T00:00:00.000Z',
        id: 'claim-1',
        merchant_id: 'merchant-1',
        merchant: { business_name: 'Ogabassey', slug: 'ogabassey' },
        orders: [
          {
            id: 'order-1',
            order_items: [{ name: 'iPhone 16 Pro Max', quantity: 1 }],
            order_number: '06485',
          },
        ],
      }).success
    ).toBe(true);
  });

  it('rejects malformed preview claim records', () => {
    expect(
      receiptClaimRecordSchema.safeParse({
        claimed_at: null,
        customer_email: 'ada@example.com',
        customer_id: 'customer-1',
      }).success
    ).toBe(false);
  });

  it('accepts known redemption statuses and rejects unknown statuses', () => {
    expect(
      redeemReceiptClaimResultSchema.safeParse({
        redirectPath: '/receipts',
        status: 'ok',
      }).success
    ).toBe(true);
    expect(
      redeemReceiptClaimResultSchema.safeParse({
        status: 'needs_manual_review',
      }).success
    ).toBe(false);
    expect(
      redeemReceiptClaimResultSchema.safeParse({
        redirectPath: 'https://evil.example/receipts',
        status: 'ok',
      }).success
    ).toBe(false);
    expect(
      redeemReceiptClaimResultSchema.safeParse({
        redirectPath: '//evil.example/receipts',
        status: 'ok',
      }).success
    ).toBe(false);
    expect(
      redeemReceiptClaimResultSchema.safeParse({
        redirectPath: '/%2f%2fevil.example/receipts',
        status: 'ok',
      }).success
    ).toBe(false);
    expect(
      redeemReceiptClaimResultSchema.safeParse({
        redirectPath: '/receipts/..',
        status: 'ok',
      }).success
    ).toBe(false);
    expect(redeemReceiptClaimResultSchema.safeParse({}).success).toBe(false);
  });

  it('rejects external and protocol-relative redirect paths', () => {
    expect(
      redeemReceiptClaimResultSchema.safeParse({
        redirectPath: 'https://evil.test',
        status: 'ok',
      }).success
    ).toBe(false);
    expect(
      redeemReceiptClaimResultSchema.safeParse({
        redirectPath: '//evil.test',
        status: 'ok',
      }).success
    ).toBe(false);
  });

  it('accepts known create-claim statuses and rejects unknown statuses', () => {
    expect(
      createReceiptClaimResultSchema.safeParse({
        claim_id: 'claim-1',
        status: 'created',
      }).success
    ).toBe(true);
    expect(
      createReceiptClaimResultSchema.safeParse({
        status: 'skipped',
      }).success
    ).toBe(true);
    expect(
      createReceiptClaimResultSchema.safeParse({
        status: 'queued',
      }).success
    ).toBe(false);
  });
});
