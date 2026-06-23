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
  brand_colors: { primary: '#d62027' },
};

function appFirstDelivery(
  context: MerchantNotificationContext,
  extra: Record<string, unknown> = {}
) {
  return resolveReceiptNotificationDelivery(context, {
    migration_imports: {
      receipt_access_mode: 'app_first',
      receipt_app_links_enabled: true,
      ...extra,
    },
  });
}

describe('import notification email content', () => {
  it('builds the app-first brand-aligned receipt email', () => {
    const delivery = appFirstDelivery(merchant);

    const content = buildReceiptNotificationEmailContent({
      merchant,
      recipientName: 'Ada',
      delivery,
      claimUrl: 'https://ogabassey.com/receipts/claim/claim-token',
      devices: ['iPhone 16 Pro Max', '2 x AirPods Pro'],
    });

    expect(delivery.accessMode).toBe('app_first');
    expect(delivery.requiresReceiptClaim).toBe(true);
    expect(content.subject).toBe('Your receipt has moved');
    expect(content.htmlContent).toContain('Hello Ada,');
    expect(content.htmlContent).toContain(
      'Ogabassey has moved your receipt for the following device(s) to the mobile app'
    );
    expect(content.htmlContent).toContain('Your receipt is now in the app');
    expect(content.htmlContent).toContain('On this receipt');
    expect(content.htmlContent).toContain('box-shadow');
    expect(content.htmlContent).toContain('rgba(15,23,42,0.24)');
    expect(content.htmlContent).not.toContain('rgba(214,32,39,0.32)');
    expect(content.htmlContent).not.toContain(
      'background-color:rgba(214,32,39,0.16)'
    );
    expect(content.htmlContent).toContain('Powered by Baci');
    expect(content.htmlContent).toContain(
      'This ensures you can access the receipts for your devices purchased from us at any time in case you need them for support, warranty, or as proof of purchase.'
    );
    expect(content.htmlContent).toContain('@media (prefers-color-scheme:dark)');
    expect(content.htmlContent).toContain('iPhone 16 Pro Max');
    expect(content.htmlContent).toContain('2 x AirPods Pro');
    expect(content.htmlContent).toContain(
      'https://ogabassey.com/receipts/claim/claim-token'
    );
    // Brand red accent on a near-black header.
    expect(content.htmlContent).toContain('#d62027');
    expect(content.htmlContent).toContain('background-color:#0f0f0f');
    // The standalone "Receipt moved to app" banner is gone.
    expect(content.htmlContent).not.toContain('Receipt moved to app');
    // The superseded #2620/#2622 cream/serif design must be gone.
    expect(content.htmlContent).not.toContain('Receipt Vault');
    expect(content.htmlContent).not.toContain('Digital receipt update');
    expect(content.htmlContent).not.toContain('Georgia');
    expect(content.htmlContent).not.toContain('#fbbf24');
    // No tagline is configured here, so none is invented (footer = merchant name).
    expect(content.htmlContent).not.toContain('Never Disappoints');
    expect(content.textContent).not.toContain('Never Disappoints');
    // Warm, generic sign-off still present in the plain-text fallback.
    expect(content.textContent).toContain('Thank you for choosing Ogabassey.');
  });

  it('honors a configured receipt tagline over the default', () => {
    const delivery = appFirstDelivery(merchant, {
      receipt_tagline: 'Premium gadgets, delivered.',
    });

    const content = buildReceiptNotificationEmailContent({
      merchant,
      recipientName: 'Ada',
      delivery,
      claimUrl: 'https://ogabassey.com/receipts/claim/claim-token',
      devices: ['iPhone 16 Pro Max'],
    });

    expect(delivery.receiptTagline).toBe('Premium gadgets, delivered.');
    expect(content.htmlContent).toContain('Premium gadgets, delivered.');
    expect(content.textContent).toContain('Premium gadgets, delivered.');
    expect(content.htmlContent).not.toContain('Never Disappoints!');
  });

  it('drives the accent from the merchant brand color', () => {
    const futureMerchant: MerchantNotificationContext = {
      ...merchant,
      slug: 'future-merchant',
      business_name: 'Future Merchant',
      brand_colors: { primary: '#2563eb' },
    };
    const delivery = appFirstDelivery(futureMerchant);

    const content = buildReceiptNotificationEmailContent({
      merchant: futureMerchant,
      recipientName: 'Ada',
      delivery,
      claimUrl: 'https://future-merchant.usebaci.com/receipts/claim/token',
      devices: ['Pixel 9'],
    });

    expect(content.htmlContent).toContain('#2563eb');
    expect(content.htmlContent).not.toContain('#d62027');
  });

  it('renders a non-Ogabassey raster merchant logo as an image in the header', () => {
    const futureMerchant: MerchantNotificationContext = {
      ...merchant,
      slug: 'future-merchant',
      business_name: 'Future Merchant',
      custom_domain: 'futuremerchant.com',
      logo_url: 'https://cdn.example.com/media/future-merchant-logo.png',
    };
    const delivery = appFirstDelivery(futureMerchant);

    const content = buildReceiptNotificationEmailContent({
      merchant: futureMerchant,
      recipientName: 'Ada',
      delivery,
      claimUrl: 'https://futuremerchant.com/receipts/claim/claim-token',
      devices: ['iPhone 16 Pro Max'],
    });

    expect(content.htmlContent).toContain(
      '<img src="https://cdn.example.com/media/future-merchant-logo.png"'
    );
    expect(content.htmlContent).toContain('alt="Future Merchant"');
  });

  it('uses the dedicated opaque Ogabassey logo with no white chip (Gmail dark-mode safe)', () => {
    // The merchant's own logo_url is a transparent PNG; Gmail's app darkens the
    // white CSS chip behind it and the dark wordmark lands black-on-black. For
    // Ogabassey we render a dedicated fully-opaque plate directly instead.
    const transparentMerchantLogo =
      'https://cdn.ogabassey.com/media/ogabassey-logo.png';
    const opaqueEmailLogo =
      'https://cdn.ogabassey.com/merchants/ogabassey/uploads/ogabassey-email-logo-2026-v1.png';
    const delivery = appFirstDelivery(merchant);

    const content = buildReceiptNotificationEmailContent({
      merchant: {
        ...merchant,
        logo_url: transparentMerchantLogo,
      },
      recipientName: 'Ada',
      delivery,
      claimUrl: 'https://ogabassey.com/receipts/claim/claim-token',
      devices: ['iPhone 16 Pro Max'],
    });

    expect(content.htmlContent).toContain(`<img src="${opaqueEmailLogo}"`);
    expect(content.htmlContent).toContain('alt="Ogabassey"');
    // Opaque logo is rendered directly — no CSS white chip (which Gmail inverts).
    expect(content.htmlContent).not.toContain('class="r-logo-chip"');
    // The transparent merchant logo must NOT be used for the email header.
    expect(content.htmlContent).not.toContain(
      `<img src="${transparentMerchantLogo}"`
    );
  });

  it('keeps configured logos for merchants with similar names', () => {
    const merchantLogoUrl =
      'https://cdn.example.com/media/ogabassey-reseller-logo.png';
    const resellerMerchant: MerchantNotificationContext = {
      ...merchant,
      slug: 'ogabassey-reseller',
      business_name: 'Ogabassey Reseller',
      custom_domain: 'shop-ogabassey.example.com',
      logo_url: merchantLogoUrl,
    };
    const delivery = appFirstDelivery(resellerMerchant);

    const content = buildReceiptNotificationEmailContent({
      merchant: resellerMerchant,
      recipientName: 'Ada',
      delivery,
      claimUrl: 'https://shop-ogabassey.example.com/receipts/claim/token',
      devices: ['iPhone 16 Pro Max'],
    });

    expect(content.htmlContent).toContain(`<img src="${merchantLogoUrl}"`);
    expect(content.htmlContent).toContain('class="r-logo-chip"');
    expect(content.htmlContent).toContain('alt="Ogabassey Reseller"');
  });

  it('falls back to the wordmark when the logo is an SVG (email-unsafe)', () => {
    const futureMerchant: MerchantNotificationContext = {
      ...merchant,
      slug: 'future-merchant',
      business_name: 'Future Merchant',
      custom_domain: 'futuremerchant.com',
    };
    const delivery = appFirstDelivery(futureMerchant);

    const content = buildReceiptNotificationEmailContent({
      merchant: {
        ...futureMerchant,
        logo_url: 'https://cdn.example.com/media/future-merchant-logo.svg',
      },
      recipientName: 'Ada',
      delivery,
      claimUrl: 'https://futuremerchant.com/receipts/claim/claim-token',
      devices: ['iPhone 16 Pro Max'],
    });

    expect(content.htmlContent).not.toContain('<img');
    expect(content.htmlContent).not.toContain('.svg');
    expect(content.htmlContent).toContain('text-transform:uppercase');
  });

  it('defaults to site-mode receipt links and honors a custom receipt path', () => {
    const siteMerchant = {
      ...merchant,
      custom_domain: 'futuremerchant.com',
      business_name: 'Future Merchant',
    };
    const delivery = resolveReceiptNotificationDelivery(siteMerchant, {
      migration_imports: {
        receipt_access_mode: 'site',
        receipt_path: '/account/receipts',
      },
    });

    const content = buildReceiptNotificationEmailContent({
      merchant: siteMerchant,
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
    expect(content.subject).toBe('Your receipt has moved');
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

  it('keeps merchants on web-only receipt links when app-first lacks the app-links flag', () => {
    const delivery = resolveReceiptNotificationDelivery(merchant, {
      migration_imports: { receipt_access_mode: 'app_first' },
    });

    const content = buildReceiptNotificationEmailContent({
      merchant,
      recipientName: 'Ada',
      delivery,
      claimUrl: delivery.receiptsUrl,
      devices: ['iPhone 16 Pro Max'],
    });

    expect(delivery.accessMode).toBe('site');
    expect(content.htmlContent).not.toContain('Download options');
    expect(content.htmlContent).not.toContain('Google Play');
    expect(content.htmlContent).not.toContain('App Store');
    expect(content.htmlContent).not.toContain('mobile app');
  });

  it('renders a safe fallback for unsafe claim URLs', () => {
    const delivery = appFirstDelivery(merchant);

    const content = buildReceiptNotificationEmailContent({
      merchant,
      recipientName: 'Ada',
      delivery,
      claimUrl: 'javascript:alert(1)',
      devices: ['iPhone 16 Pro Max'],
    });

    expect(content.htmlContent).not.toContain('href=""');
    expect(content.htmlContent).not.toContain('javascript:alert(1)');
    expect(content.htmlContent).toContain('Receipt link unavailable');
    expect(content.textContent).toContain(
      'View your receipt: unavailable (invalid link configuration).'
    );
  });

  it('HTML-entity-escapes merchant and device input', () => {
    const delivery = appFirstDelivery(merchant);

    const content = buildReceiptNotificationEmailContent({
      merchant: { ...merchant, business_name: '<Merchant>' },
      recipientName: '<Ada>',
      delivery,
      claimUrl: 'javascript:alert(1)',
      devices: ['<Device>'],
    });

    expect(content.htmlContent).not.toContain('<Ada>');
    expect(content.htmlContent).not.toContain('<Merchant>');
    expect(content.htmlContent).not.toContain('<Device>');
    expect(content.htmlContent).not.toContain('javascript:alert(1)');
    expect(content.htmlContent).not.toContain('href=""');
    // Entity escaping renders correctly in email (unlike \uXXXX escapes).
    expect(content.htmlContent).toContain('&lt;Ada&gt;');
    expect(content.htmlContent).toContain('&lt;Merchant&gt;');
    expect(content.htmlContent).toContain('&lt;Device&gt;');
  });
});
