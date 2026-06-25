import { describe, expect, it } from 'vitest';
import {
  hexToRgb,
  type ReceiptEmailTemplateInput,
  renderReceiptCta,
  renderReceiptDeviceRows,
  renderReceiptEmailHtml,
} from '@/lib/import-notifications/import-notification-email-template';

const BRAND = '#d62027';

describe('hexToRgb', () => {
  it('converts 6-digit and 3-digit hex to r,g,b', () => {
    expect(hexToRgb('#d62027')).toBe('214,32,39');
    expect(hexToRgb('#fff')).toBe('255,255,255');
  });

  it.each([
    '#zzzzzz',
    '#12',
    '#12345g',
    'rgba(214,32,39,0.32)',
  ])('returns a safe fallback for malformed hex input %s', (hex) => {
    expect(hexToRgb(hex)).toBe('0,0,0');
  });
});

function baseInput(
  overrides: Partial<ReceiptEmailTemplateInput> = {}
): ReceiptEmailTemplateInput {
  return {
    preheader: 'Your Ogabassey receipt is now in the app.',
    brandWordmark: 'Ogabassey',
    brandColor: BRAND,
    eyebrow: 'Receipt',
    headline: 'Your receipt is now in the app',
    subhead: 'A quicker, more secure way to keep your purchase records.',
    greetingName: 'Ada',
    introHtml: 'Ogabassey has moved your receipt to the mobile app.',
    sectionLabel: 'On this receipt',
    deviceRowsHtml: renderReceiptDeviceRows(['iPhone 16 Pro Max'], BRAND),
    ctaHtml: renderReceiptCta(
      'https://example.com/r',
      'View your receipt',
      BRAND
    ),
    reassurance: 'Nothing about your purchase has changed.',
    supportLineHtml: 'Need a hand? Reach us at support@ogabassey.com.',
    footerNote: 'Ogabassey Never Disappoints!',
    ...overrides,
  };
}

describe('renderReceiptDeviceRows', () => {
  it('renders one numbered, brand-colored row per device', () => {
    const html = renderReceiptDeviceRows(
      ['iPhone 16 Pro Max', '2 x AirPods Pro'],
      BRAND
    );

    expect(html).toContain('iPhone 16 Pro Max');
    expect(html).toContain('2 x AirPods Pro');
    expect(html).toContain('>1</div>');
    expect(html).toContain('>2</div>');
    expect(html).toContain(BRAND);
  });

  it('uses the provided brand color for the index chip', () => {
    const html = renderReceiptDeviceRows(['Pixel 9'], '#2563eb');

    expect(html).toContain('background-color:#2563eb');
  });

  it('omits the divider border on the final row', () => {
    const html = renderReceiptDeviceRows(['Only device'], BRAND);

    expect(html).not.toContain('border-bottom:1px solid #eef1f5;');
  });

  it('returns an empty string when there are no devices', () => {
    expect(renderReceiptDeviceRows([], BRAND)).toBe('');
  });
});

describe('renderReceiptCta', () => {
  it('renders a bulletproof button when the url is valid', () => {
    const html = renderReceiptCta(
      'https://example.com/claim',
      'View your receipt',
      BRAND
    );

    expect(html).toContain('href="https://example.com/claim"');
    expect(html).toContain('View your receipt');
    expect(html).toContain('box-shadow');
    expect(html).toContain(BRAND);
    expect(html).toContain('rgba(15,23,42,0.24)'); // neutral shadow avoids Gmail dark-mode red/orange shifts
    expect(html).not.toContain('rgba(214,32,39,0.32)');
    expect(html).toContain('mso'); // Outlook VML fallback present
  });

  it('renders a safe fallback with no link when the url is empty', () => {
    const html = renderReceiptCta('', 'View your receipt', BRAND);

    expect(html).toContain('Receipt link unavailable');
    expect(html).not.toContain('href=');
  });
});

describe('renderReceiptEmailHtml', () => {
  it('renders a complete, responsive email document with all sections', () => {
    const html = renderReceiptEmailHtml(baseInput());

    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain('@media only screen and (max-width:600px)');
    expect(html).toContain('Your Ogabassey receipt is now in the app.'); // preheader
    expect(html).toContain('Hello Ada,');
    expect(html).toContain('Your receipt is now in the app');
    expect(html).toContain('On this receipt');
    expect(html).toContain('iPhone 16 Pro Max');
    expect(html).toContain('Powered by Baci');
    expect(html).toContain('background-color:#0f0f0f');
    expect(html).toContain('text-transform:uppercase');
  });

  it('renders the eyebrow as a pill in the header', () => {
    const html = renderReceiptEmailHtml(baseInput({ eyebrow: 'Receipt' }));

    // Eyebrow is a rounded, brand-outlined chip — not a separate status banner.
    expect(html).toContain('border-radius:999px');
    expect(html).toContain('background-color:#18181b');
    expect(html).not.toContain('background-color:rgba(214,32,39,0.16)');
    expect(html).toContain('>Receipt</span>');
    expect(html).not.toContain('Receipt moved to app');
  });

  it('drives the accent from the provided brand color', () => {
    const html = renderReceiptEmailHtml(
      baseInput({
        brandColor: '#2563eb',
        deviceRowsHtml: renderReceiptDeviceRows(['Pixel 9'], '#2563eb'),
        ctaHtml: renderReceiptCta(
          'https://example.com/r',
          'View your receipt',
          '#2563eb'
        ),
      })
    );

    expect(html).toContain('#2563eb');
    expect(html).not.toContain('#d62027');
  });

  it('includes dark-mode overrides for supporting clients', () => {
    const html = renderReceiptEmailHtml(baseInput());

    expect(html).toContain('@media (prefers-color-scheme:dark)');
    expect(html).toContain('content="light dark"');
    expect(html).toContain('.r-logo-chip{background:#ffffff!important;');
  });

  it('renders the wordmark when no logo is provided', () => {
    const html = renderReceiptEmailHtml(baseInput());

    expect(html).not.toContain('<img');
    expect(html).toContain('text-transform:uppercase');
  });

  it('renders the logo image on a white chip when a logo url is provided', () => {
    const html = renderReceiptEmailHtml(
      baseInput({ logoUrl: 'https://cdn.example.com/logo.png' })
    );

    expect(html).toContain('<img src="https://cdn.example.com/logo.png"');
    expect(html).toContain('alt="Ogabassey"');
    expect(html).toContain('class="r-logo-chip"');
    expect(html).toContain('bgcolor="#ffffff"');
    expect(html).toContain('background:#ffffff');
    expect(html).toContain('background-color:#ffffff');
    expect(html).toContain('color-scheme:light');
    expect(html).toContain('forced-color-adjust:none');
  });
});
