import { describe, expect, it, vi } from 'vitest';
import {
  buildReceiptNotificationEmailContent,
  type MerchantNotificationContext,
  resolveReceiptNotificationDelivery,
} from '@/lib/import-notifications/import-notification-email-content';

vi.mock('@/env', () => ({
  getRootDomain: vi.fn(() => 'usebaci.com'),
}));

const merchant: MerchantNotificationContext = {
  id: 'merchant-1',
  slug: 'ogabassey',
  business_name: 'Ogabassey',
  custom_domain: null,
  support_email: 'support@ogabassey.com',
  email_sender_name: 'Ogabassey',
  email: 'hello@ogabassey.com',
};

describe('import notification email content', () => {
  it('builds app-first receipt-changed copy with claim links and device rows', () => {
    const delivery = resolveReceiptNotificationDelivery(merchant, {
      migration_imports: {
        receipt_access_mode: 'app_first',
      },
    });

    const content = buildReceiptNotificationEmailContent({
      merchant,
      recipientName: 'Ada',
      delivery,
      claimUrl: 'https://ogabassey.com/receipts/claim/claim-token',
      devices: ['iPhone 16 Pro Max', '2 x AirPods Pro'],
    });

    expect(delivery.accessMode).toBe('app_first');
    expect(content.subject).toBe('Your Receipt Has Changed.');
    expect(content.htmlContent).toContain('Hello Ada,');
    expect(content.htmlContent).toContain(
      'Ogabassey has moved your receipt for the following device(s) to the mobile app'
    );
    expect(content.htmlContent).toContain('iPhone 16 Pro Max');
    expect(content.htmlContent).toContain('2 x AirPods Pro');
    expect(content.htmlContent).toContain(
      'https://ogabassey.com/receipts/claim/claim-token'
    );
  });

  it('defaults to site-mode receipt links and honors a custom receipt path', () => {
    const delivery = resolveReceiptNotificationDelivery(
      {
        ...merchant,
        custom_domain: 'futuremerchant.com',
        business_name: 'Future Merchant',
      },
      {
        migration_imports: {
          receipt_access_mode: 'site',
          receipt_path: '/account/receipts',
        },
      }
    );

    const content = buildReceiptNotificationEmailContent({
      merchant: {
        ...merchant,
        custom_domain: 'futuremerchant.com',
        business_name: 'Future Merchant',
      },
      recipientName: 'Ada',
      delivery,
      claimUrl: delivery.receiptsUrl,
      devices: ['Pixel 9'],
    });

    expect(delivery).toEqual(
      expect.objectContaining({
        accessMode: 'site',
        receiptsUrl: 'https://futuremerchant.com/account/receipts',
      })
    );
    expect(content.subject).toBe(
      'Future Merchant: your updated order history is ready'
    );
    expect(content.htmlContent).toContain(
      'https://futuremerchant.com/account/receipts'
    );
    expect(content.htmlContent).not.toContain('Pixel 9');
  });

  it('sanitizes unsafe merchant, recipient, device, and URL content', () => {
    const delivery = resolveReceiptNotificationDelivery(
      {
        ...merchant,
        business_name: '<Merchant>',
      },
      {
        migration_imports: {
          receipt_access_mode: 'app_first',
          app_store_url: 'javascript:alert(1)',
        },
      }
    );

    const content = buildReceiptNotificationEmailContent({
      merchant: {
        ...merchant,
        business_name: '<Merchant>',
      },
      recipientName: '<Ada>',
      delivery,
      claimUrl: 'javascript:alert(1)',
      devices: ['<Device>'],
    });

    expect(content.htmlContent).not.toContain('<Ada>');
    expect(content.htmlContent).not.toContain('<Merchant>');
    expect(content.htmlContent).not.toContain('<Device>');
    expect(content.htmlContent).not.toContain('javascript:alert(1)');
    expect(content.htmlContent).toContain('\\u003cAda\\u003e');
    expect(content.htmlContent).toContain('\\u003cMerchant\\u003e');
    expect(content.htmlContent).toContain('\\u003cDevice\\u003e');
  });
});
