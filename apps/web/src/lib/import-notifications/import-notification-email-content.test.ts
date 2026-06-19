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
        receipt_app_links_enabled: true,
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
    expect(delivery.requiresReceiptClaim).toBe(true);
    expect(content.subject).toBe('Your Receipt has Changed.');
    expect(content.htmlContent).toContain('Hello Ada,');
    expect(content.htmlContent).toContain(
      'Ogabassey has moved your receipt for the following device(s) to the mobile app'
    );
    expect(content.htmlContent).toContain('iPhone 16 Pro Max');
    expect(content.htmlContent).toContain('2 x AirPods Pro');
    expect(content.htmlContent).toContain(
      'https://ogabassey.com/receipts/claim/claim-token'
    );
    expect(content.htmlContent).not.toContain('#e11d2e');
    expect(content.htmlContent).not.toContain('#fff7f7');
    expect(content.htmlContent).not.toContain('#f0d7d7');
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
        requiresReceiptClaim: false,
      })
    );
    expect(content.subject).toBe('Your Receipt has Changed.');
    expect(content.htmlContent).toContain(
      'https://futuremerchant.com/account/receipts'
    );
    expect(content.htmlContent).toContain(
      'Future Merchant has moved your receipt for the following item(s) to your online account'
    );
    expect(content.htmlContent).toContain('Pixel 9');
    expect(content.htmlContent).toContain(
      'This is to ensure you can access your receipt at any time from the website'
    );
    expect(content.htmlContent).not.toContain('Download options');
    expect(content.htmlContent).not.toContain('mobile app');
    expect(content.textContent).toContain('1. Pixel 9');
    expect(content.textContent).toContain('Hello Ada,\n\nFuture Merchant');
    expect(content.textContent).toContain('1. Pixel 9\n\nThis is to ensure');
    expect(content.textContent).toContain(
      'View your receipt: https://futuremerchant.com/account/receipts\n\nNeed help?'
    );
  });

  it('keeps merchants on web-only receipt links when app-first is configured without the app-links flag', () => {
    const futureMerchant: MerchantNotificationContext = {
      ...merchant,
      slug: 'future-merchant',
      business_name: 'Future Merchant',
      custom_domain: 'futuremerchant.com',
      support_email: 'support@futuremerchant.com',
      email: 'hello@futuremerchant.com',
    };
    const delivery = resolveReceiptNotificationDelivery(futureMerchant, {
      migration_imports: {
        app_store_url: 'https://apps.apple.com/app/future',
        play_store_url: 'https://play.google.com/store/apps/details?id=future',
        receipt_access_mode: 'app_first',
      },
    });

    const content = buildReceiptNotificationEmailContent({
      merchant: futureMerchant,
      recipientName: 'Ada',
      delivery,
      claimUrl: delivery.receiptsUrl,
      devices: ['Pixel 9'],
    });

    expect(delivery).toEqual(
      expect.objectContaining({
        accessMode: 'site',
        appStoreUrl: null,
        playStoreUrl: null,
        receiptsUrl: 'https://futuremerchant.com/receipts',
        requiresReceiptClaim: true,
      })
    );
    expect(content.htmlContent).not.toContain('Download options');
    expect(content.htmlContent).not.toContain('Google Play');
    expect(content.htmlContent).not.toContain('App Store');
    expect(content.htmlContent).not.toContain('mobile app');
  });

  it('falls back to storefront receipts when custom settings are missing', () => {
    expect(resolveReceiptNotificationDelivery(merchant, null)).toEqual(
      expect.objectContaining({
        accessMode: 'site',
        receiptsUrl: 'https://ogabassey.usebaci.com/receipts',
        requiresReceiptClaim: false,
      })
    );
  });

  it('falls back for invalid access mode and receipt path settings', () => {
    expect(
      resolveReceiptNotificationDelivery(merchant, {
        migration_imports: {
          receipt_access_mode: 'native_only',
          receipt_path: 'javascript:alert(1)',
        },
      })
    ).toEqual(
      expect.objectContaining({
        accessMode: 'site',
        receiptsUrl: 'https://ogabassey.usebaci.com/receipts',
      })
    );
  });

  it('uses default app links when configured app links are missing', () => {
    const delivery = resolveReceiptNotificationDelivery(merchant, {
      migration_imports: {
        app_store_url: 42,
        play_store_url: false,
        receipt_access_mode: 'app_first',
        receipt_app_links_enabled: true,
      },
    });

    expect(delivery.accessMode).toBe('app_first');
    expect(delivery.requiresReceiptClaim).toBe(true);
    expect(delivery.appStoreUrl).not.toBe('42');
    expect(delivery.playStoreUrl).not.toBe('false');
  });

  it('allows app-first receipt claim links when the merchant explicitly enables app links', () => {
    const delivery = resolveReceiptNotificationDelivery(
      {
        ...merchant,
        custom_domain: 'ogabassey.com',
      },
      {
        migration_imports: {
          receipt_access_mode: 'app_first',
          receipt_app_links_enabled: true,
        },
      }
    );

    expect(delivery).toEqual(
      expect.objectContaining({
        accessMode: 'app_first',
        receiptsUrl: 'https://ogabassey.com/receipts',
        requiresReceiptClaim: true,
        playStoreUrl:
          'https://play.google.com/store/apps/details?id=com.ogabassey.store',
      })
    );
  });

  it('renders a fallback instead of an empty site receipt CTA when the URL is unsafe', () => {
    const content = buildReceiptNotificationEmailContent({
      merchant,
      recipientName: 'Ada',
      delivery: {
        accessMode: 'site',
        appStoreUrl: null,
        playStoreUrl: null,
        receiptsUrl: 'javascript:alert(1)',
        requiresReceiptClaim: false,
      },
      claimUrl: 'javascript:alert(1)',
      devices: ['Pixel 9'],
    });

    expect(content.htmlContent).not.toContain('href=""');
    expect(content.htmlContent).not.toContain('javascript:alert(1)');
    expect(content.htmlContent).toContain('Receipt link unavailable');
    expect(content.textContent).toContain(
      'View your receipt: unavailable (invalid link configuration).'
    );
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
          receipt_app_links_enabled: true,
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
    expect(content.textContent).not.toContain('javascript:alert(1)');
    expect(content.htmlContent).not.toContain('href=""');
    expect(content.htmlContent).toContain('Receipt link unavailable');
    expect(content.textContent).toContain(
      'View your receipt: unavailable (invalid link configuration).'
    );
    expect(content.htmlContent).toContain('\\u003cAda\\u003e');
    expect(content.htmlContent).toContain('\\u003cMerchant\\u003e');
    expect(content.htmlContent).toContain('\\u003cDevice\\u003e');
  });
});
