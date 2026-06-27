import { describe, expect, it } from 'vitest';
import {
  createReceiptClaimResultSchema,
  receiptClaimCampaignStatsSchema,
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

  it('accepts receipt claim campaign stats returned for migration dashboards', () => {
    const parsed = receiptClaimCampaignStatsSchema.safeParse({
      claimedCount: 1,
      clickedCount: 2,
      lastActivityAt: '2026-06-27T10:05:00+00:00',
      loginStartedCount: 1,
      recipients: [
        {
          claimedAt: '2026-06-27T10:05:00+00:00',
          clickCount: 3,
          customerEmail: 'ada@example.com',
          customerName: 'Ada Lovelace',
          firstClickedAt: '2026-06-27T10:00:00+00:00',
          firstLoginStartedAt: '2026-06-27T10:01:00+00:00',
          id: 'claim-1',
          lastClickedAt: '2026-06-27T10:02:00+00:00',
          lastLoginStartedAt: '2026-06-27T10:01:00+00:00',
          loginStartedCount: 1,
          notificationSentAt: '2026-06-27T09:59:00+00:00',
        },
      ],
      sentCount: 3,
      totalRecipients: 3,
    });

    expect(parsed.success).toBe(true);
  });

  it('rejects campaign stats with negative counters', () => {
    expect(
      receiptClaimCampaignStatsSchema.safeParse({
        claimedCount: 0,
        clickedCount: 0,
        lastActivityAt: null,
        loginStartedCount: 0,
        recipients: [],
        sentCount: -1,
        totalRecipients: 0,
      }).success
    ).toBe(false);
  });

  it('rejects campaign stats with malformed timestamp fields', () => {
    expect(
      receiptClaimCampaignStatsSchema.safeParse({
        claimedCount: 0,
        clickedCount: 0,
        lastActivityAt: 'not-a-date',
        loginStartedCount: 0,
        recipients: [],
        sentCount: 0,
        totalRecipients: 0,
      }).success
    ).toBe(false);

    expect(
      receiptClaimCampaignStatsSchema.safeParse({
        claimedCount: 0,
        clickedCount: 0,
        lastActivityAt: null,
        loginStartedCount: 0,
        recipients: [
          {
            claimedAt: null,
            clickCount: 0,
            customerEmail: 'ada@example.com',
            customerName: null,
            firstClickedAt: 'not-a-date',
            firstLoginStartedAt: null,
            id: 'claim-1',
            lastClickedAt: null,
            lastLoginStartedAt: null,
            loginStartedCount: 0,
            notificationSentAt: null,
          },
        ],
        sentCount: 0,
        totalRecipients: 1,
      }).success
    ).toBe(false);
  });
});
