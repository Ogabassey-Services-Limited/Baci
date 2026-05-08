import { describe, expect, it } from 'vitest';
import { generateReceiptHtml } from './generate-receipt-html';
import { receiptTestFactory } from './receipt-test-factory';

const { createReceiptMerchant, createReceiptOrder } = receiptTestFactory;

describe('generateReceiptHtml social footer', () => {
  it('normalizes social URLs into handles without tracking query text', () => {
    const html = generateReceiptHtml(
      createReceiptOrder(),
      createReceiptMerchant({
        social_media: {
          instagram: 'https://instagram.com/ogabasseyy?igsh=MzRlODBiNWFlZA==',
          facebook: 'https://facebook.com/ogabasseyy?mibextid=ZbWKwL',
          twitter: 'https://x.com/ogabasseyy?s=20',
          tiktok: 'https://www.tiktok.com/@ogabasseyy?_t=8abc123',
        },
      })
    );

    expect(html).toContain('@ogabasseyy');
    expect(html).not.toContain('igsh');
    expect(html).not.toContain('mibextid');
    expect(html).not.toContain('_t=');
    expect(html).not.toContain('@https://');
  });

  it('normalizes mobile social subdomain URLs into handles', () => {
    const html = generateReceiptHtml(
      createReceiptOrder(),
      createReceiptMerchant({
        social_media: {
          facebook: 'm.facebook.com/ogabasseyy?mibextid=ZbWKwL',
          twitter: 'mobile.twitter.com/bacisupport?s=20',
        },
      })
    );

    expect(html).toContain('@ogabasseyy');
    expect(html).toContain('@bacisupport');
    expect(html).not.toContain('@m.facebook.com');
    expect(html).not.toContain('@mobile.twitter.com');
    expect(html).not.toContain('mibextid');
  });

  it('renders Facebook profile.php id URLs as deterministic handles', () => {
    const html = generateReceiptHtml(
      createReceiptOrder(),
      createReceiptMerchant({
        social_media: {
          facebook:
            'https://www.facebook.com/profile.php?id=61551234567890&mibextid=ZbWKwL',
        },
      })
    );

    expect(html).toContain('@61551234567890');
    expect(html).not.toContain('?id=');
    expect(html).not.toContain('profile.php');
    expect(html).not.toContain('mibextid');
  });

  it('renders Facebook pages URLs as page handles', () => {
    const html = generateReceiptHtml(
      createReceiptOrder(),
      createReceiptMerchant({
        social_media: {
          facebook:
            'https://www.facebook.com/pages/Ogabassey-Store/1234567890?mibextid=ZbWKwL',
        },
      })
    );

    expect(html).toContain('@ogabassey-store');
    expect(html).not.toContain('@Ogabassey-Store');
    expect(html).not.toContain('@1234567890');
    expect(html).not.toContain('mibextid');
    expect(html).not.toContain('/pages/');
  });

  it('renders Facebook pg URLs as page handles', () => {
    const html = generateReceiptHtml(
      createReceiptOrder(),
      createReceiptMerchant({
        social_media: {
          facebook: 'https://www.facebook.com/pg/Ogabassey-Store/about/',
        },
      })
    );

    expect(html).toContain('@ogabassey-store');
    expect(html).not.toContain('@pg');
    expect(html).not.toContain('/pg/');
  });

  it('does not treat Facebook pages sub-routes as page handles', () => {
    const html = generateReceiptHtml(
      createReceiptOrder(),
      createReceiptMerchant({
        social_media: {
          facebook: 'https://www.facebook.com/pages/create',
        },
      })
    );

    expect(html).not.toContain('@create');
    expect(html).not.toContain('/pages/create');
  });

  it('does not consume Facebook profile.php ids from nested paths', () => {
    const html = generateReceiptHtml(
      createReceiptOrder(),
      createReceiptMerchant({
        social_media: {
          facebook:
            'https://www.facebook.com/share/profile.php?id=61551234567890',
        },
      })
    );

    expect(html).not.toContain('@61551234567890');
    expect(html).not.toContain('?id=');
  });

  it('does not treat reserved social content route ids as handles', () => {
    const html = generateReceiptHtml(
      createReceiptOrder(),
      createReceiptMerchant({
        social_media: {
          facebook: 'https://facebook.com/groups/12345',
          instagram: 'https://instagram.com/p/ABC123',
          tiktok: 'https://www.tiktok.com/video/987',
          twitter: 'https://x.com/i/status/54321',
        },
      })
    );

    expect(html).not.toContain('@ABC123');
    expect(html).not.toContain('@abc123');
    expect(html).not.toContain('@12345');
    expect(html).not.toContain('@987');
    expect(html).not.toContain('@54321');
    expect(html).not.toContain('<span>@groups</span>');
    expect(html).not.toContain('<span>@p</span>');
    expect(html).not.toContain('<span>@video</span>');
    expect(html).not.toContain('<span>@status</span>');
    expect(html).not.toContain('facebook.com/groups');
    expect(html).not.toContain('instagram.com/p');
    expect(html).not.toContain('tiktok.com/video');
    expect(html).not.toContain('x.com/i/status');
  });
});
