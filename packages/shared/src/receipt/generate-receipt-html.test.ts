import { describe, expect, it } from 'vitest';
import { generateReceiptHtml } from './generate-receipt-html';
import { DEFAULT_NG_VAT_RATE } from './receipt-money';
import { sanitizeSvg } from './sanitize-svg';
import type { ReceiptMerchant, ReceiptOrder } from './types';

describe('sanitizeSvg', () => {
  it('returns safe SVG unchanged', () => {
    const safeSvg = '<svg><circle r="5"/></svg>';
    expect(sanitizeSvg(safeSvg)).toBe(safeSvg);
  });

  it('removes <script> tags including content', () => {
    const maliciousSvg =
      '<svg><script>alert("XSS")</script><circle r="5"/></svg>';
    const result = sanitizeSvg(maliciousSvg);
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('alert');
    expect(result).toContain('<circle r="5"/>');
  });

  it('removes <script> with whitespace in closing tag', () => {
    const maliciousSvg =
      '<svg><script>alert("XSS")</script ><circle r="5"/></svg>';
    const result = sanitizeSvg(maliciousSvg);
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('alert');
    expect(result).toContain('<circle r="5"/>');
  });

  it('removes self-closing script tags', () => {
    const maliciousSvg = '<svg><script src="evil.js"/><circle r="5"/></svg>';
    const result = sanitizeSvg(maliciousSvg);
    expect(result).not.toContain('<script');
    expect(result).not.toContain('evil.js');
    expect(result).toContain('<circle r="5"/>');
  });

  it('removes <style> tags with content', () => {
    const maliciousSvg =
      '<svg><style>circle { fill: red } @import url("evil.css")</style><circle r="5"/></svg>';
    const result = sanitizeSvg(maliciousSvg);
    expect(result).not.toContain('<style');
    expect(result).not.toContain('@import');
    expect(result).toContain('<circle r="5"/>');
  });

  it('removes <foreignObject> tags', () => {
    const maliciousSvg =
      '<svg><foreignObject><div>Bad HTML</div></foreignObject><circle r="5"/></svg>';
    const result = sanitizeSvg(maliciousSvg);
    expect(result).not.toContain('<foreignObject');
    expect(result).not.toContain('Bad HTML');
    expect(result).toContain('<circle r="5"/>');
  });

  it('removes <iframe> tags', () => {
    const maliciousSvg =
      '<svg><iframe src="https://evil.com"></iframe><circle r="5"/></svg>';
    const result = sanitizeSvg(maliciousSvg);
    expect(result).not.toContain('<iframe');
    expect(result).not.toContain('evil.com');
    expect(result).toContain('<circle r="5"/>');
  });

  it('removes <embed> tags', () => {
    const maliciousSvg = '<svg><embed src="evil.swf"/><circle r="5"/></svg>';
    const result = sanitizeSvg(maliciousSvg);
    expect(result).not.toContain('<embed');
    expect(result).not.toContain('evil.swf');
    expect(result).toContain('<circle r="5"/>');
  });

  it('removes <object> tags', () => {
    const maliciousSvg =
      '<svg><object data="evil.swf"></object><circle r="5"/></svg>';
    const result = sanitizeSvg(maliciousSvg);
    expect(result).not.toContain('<object');
    expect(result).not.toContain('evil.swf');
    expect(result).toContain('<circle r="5"/>');
  });

  it('removes <use> with external href', () => {
    const maliciousSvg =
      '<svg><use href="https://evil.com/icon.svg#bad"/><circle r="5"/></svg>';
    const result = sanitizeSvg(maliciousSvg);
    expect(result).not.toContain('<use');
    expect(result).not.toContain('evil.com');
    expect(result).toContain('<circle r="5"/>');
  });

  it('removes <use> with external xlink:href', () => {
    const maliciousSvg =
      '<svg><use xlink:href="https://evil.com/icon.svg#bad"/><circle r="5"/></svg>';
    const result = sanitizeSvg(maliciousSvg);
    expect(result).not.toContain('<use');
    expect(result).not.toContain('evil.com');
    expect(result).toContain('<circle r="5"/>');
  });

  it('removes <use> with protocol-relative URLs', () => {
    const maliciousSvg =
      '<svg><use href="//evil.com/icon.svg#bad"/><circle r="5"/></svg>';
    const result = sanitizeSvg(maliciousSvg);
    expect(result).not.toContain('<use');
    expect(result).not.toContain('evil.com');
    expect(result).toContain('<circle r="5"/>');
  });

  it('removes onerror event handler but preserves element', () => {
    const maliciousSvg = '<svg><image src="x" onerror="alert(1)"/></svg>';
    const result = sanitizeSvg(maliciousSvg);
    expect(result).not.toContain('onerror');
    expect(result).not.toContain('alert');
    expect(result).toContain('<image');
  });

  it('preserves internal <use> references', () => {
    const svgWithInternalUse =
      '<svg><defs><circle id="s" r="5"/></defs><use href="#s"/></svg>';
    const result = sanitizeSvg(svgWithInternalUse);
    expect(result).toContain('href="#s"');
    expect(result).toContain('<defs>');
  });

  it('removes onclick event handler', () => {
    const maliciousSvg = '<svg><circle r="5" onclick="alert(\'XSS\')"/></svg>';
    const result = sanitizeSvg(maliciousSvg);
    expect(result).not.toContain('onclick');
    expect(result).not.toContain('alert');
    expect(result).toContain('<circle');
  });

  it('removes onload event handler', () => {
    const maliciousSvg = '<svg onload="alert(\'XSS\')"><circle r="5"/></svg>';
    const result = sanitizeSvg(maliciousSvg);
    expect(result).not.toContain('onload');
    expect(result).not.toContain('alert');
    expect(result).toContain('<circle r="5"/>');
  });

  it('removes multiple different event handlers', () => {
    const maliciousSvg =
      '<svg onload="a()" onclick="b()" onmouseover="c()"><circle r="5"/></svg>';
    const result = sanitizeSvg(maliciousSvg);
    expect(result).not.toContain('onload');
    expect(result).not.toContain('onclick');
    expect(result).not.toContain('onmouseover');
    expect(result).toContain('<circle r="5"/>');
  });

  it('replaces javascript: URIs in href with empty href', () => {
    const maliciousSvg =
      '<svg><a href="javascript:alert(\'XSS\')"><circle r="5"/></a></svg>';
    const result = sanitizeSvg(maliciousSvg);
    expect(result).not.toContain('javascript:');
    expect(result).not.toContain('alert');
    expect(result).toContain('href=""');
  });

  it('replaces javascript: URIs in xlink:href with empty xlink:href', () => {
    const maliciousSvg =
      '<svg><a xlink:href="javascript:alert(\'XSS\')"><circle r="5"/></a></svg>';
    const result = sanitizeSvg(maliciousSvg);
    expect(result).not.toContain('javascript:');
    expect(result).not.toContain('alert');
    expect(result).toContain('xlink:href=""');
  });

  it('replaces vbscript: URIs in href with empty href', () => {
    const maliciousSvg =
      '<svg><a href="vbscript:msgbox(\'XSS\')"><circle r="5"/></a></svg>';
    const result = sanitizeSvg(maliciousSvg);
    expect(result).not.toContain('vbscript:');
    expect(result).not.toContain('msgbox');
    expect(result).toContain('href=""');
  });

  it('replaces data: URIs in href with empty href', () => {
    const maliciousSvg =
      '<svg><a href="data:text/html,<script>alert(\'XSS\')</script>"><circle r="5"/></a></svg>';
    const result = sanitizeSvg(maliciousSvg);
    expect(result).not.toContain('data:');
    expect(result).not.toContain('alert');
    expect(result).toContain('href=""');
  });

  it('replaces data: URIs in xlink:href with empty xlink:href', () => {
    const maliciousSvg =
      '<svg><image xlink:href="data:image/svg+xml,<script>alert(\'XSS\')</script>"/></svg>';
    const result = sanitizeSvg(maliciousSvg);
    expect(result).not.toContain('data:');
    expect(result).not.toContain('alert');
    expect(result).toContain('xlink:href=""');
  });

  it('replaces data: URIs in src with empty src', () => {
    const maliciousSvg =
      '<svg><image src="data:image/svg+xml,<script>alert(\'XSS\')</script>"/></svg>';
    const result = sanitizeSvg(maliciousSvg);
    expect(result).not.toContain('data:');
    expect(result).not.toContain('alert');
    expect(result).toContain('src=""');
  });

  it('prevents nested reconstruction via iterative stripping', () => {
    // Attacker tries to bypass by nesting: <scr<script>ipt>
    const maliciousSvg =
      '<svg><scr<script>ipt>alert("XSS")</scr</script>ipt><circle r="5"/></svg>';
    const result = sanitizeSvg(maliciousSvg);
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('alert');
    expect(result).toContain('<circle r="5"/>');
  });

  it('is idempotent - calling twice gives same result', () => {
    const maliciousSvg =
      '<svg><script>alert("XSS")</script><circle r="5" onclick="bad()"/></svg>';
    const firstPass = sanitizeSvg(maliciousSvg);
    const secondPass = sanitizeSvg(firstPass);
    expect(firstPass).toBe(secondPass);
    expect(secondPass).not.toContain('<script>');
    expect(secondPass).not.toContain('onclick');
  });

  it('handles complex real-world attack vectors', () => {
    const complexAttack = `
      <svg xmlns="http://www.w3.org/2000/svg">
        <script>alert('XSS')</script>
        <foreignObject width="100" height="100">
          <div xmlns="http://www.w3.org/1999/xhtml">
            <iframe src="https://evil.com"></iframe>
          </div>
        </foreignObject>
        <use xlink:href="https://evil.com/icon.svg#attack"/>
        <circle r="10" onclick="steal()" onload="hijack()"/>
        <a href="javascript:void(alert('XSS'))">Click me</a>
        <image xlink:href="data:image/svg+xml,<svg onload='alert(1)'/>"/>
        <circle r="5" fill="#00ff00"/>
      </svg>
    `;
    const result = sanitizeSvg(complexAttack);

    // Verify all dangerous elements removed
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('<foreignObject');
    expect(result).not.toContain('<iframe');
    expect(result).not.toContain('<use');
    expect(result).not.toContain('onclick');
    expect(result).not.toContain('onload');
    expect(result).not.toContain('javascript:');
    expect(result).not.toContain('data:');

    // Verify safe content preserved
    expect(result).toContain('<circle r="5" fill="#00ff00"/>');
  });

  it('removes variations of script tags with different case and whitespace', () => {
    const maliciousSvg =
      '<svg><SCRIPT>alert(1)</SCRIPT><Script>alert(2)</Script><circle r="5"/></svg>';
    const result = sanitizeSvg(maliciousSvg);
    expect(result).not.toMatch(/<script/i);
    expect(result).not.toContain('alert');
    expect(result).toContain('<circle r="5"/>');
  });

  it('does not remove tag names that only start with dangerous prefixes', () => {
    const safeSvg =
      '<svg><embedded data-safe="1"></embedded><circle r="5"/></svg>';
    const result = sanitizeSvg(safeSvg);
    expect(result).toContain('<embedded data-safe="1"></embedded>');
    expect(result).toContain('<circle r="5"/>');
  });

  it('handles empty SVG', () => {
    const emptySvg = '<svg></svg>';
    expect(sanitizeSvg(emptySvg)).toBe(emptySvg);
  });

  it('throws when called with null', () => {
    expect(() => sanitizeSvg(null as unknown as string)).toThrow();
  });

  it('throws when called with undefined', () => {
    expect(() => sanitizeSvg(undefined as unknown as string)).toThrow();
  });

  it('returns empty string for empty input', () => {
    expect(sanitizeSvg('')).toBe('');
  });

  it('preserves safe SVG attributes and elements', () => {
    const safeSvg = `
      <svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="40" fill="blue" stroke="black" stroke-width="2"/>
        <rect x="10" y="10" width="30" height="30" fill="red"/>
        <path d="M 10 10 L 90 90" stroke="green"/>
        <text x="50" y="50" font-size="16" text-anchor="middle">Hello</text>
        <g transform="translate(10,10)">
          <circle r="5"/>
        </g>
      </svg>
    `;
    const result = sanitizeSvg(safeSvg);

    // Should preserve all safe elements
    expect(result).toContain('<circle');
    expect(result).toContain('<rect');
    expect(result).toContain('<path');
    expect(result).toContain('<text');
    expect(result).toContain('<g');
    expect(result).toContain('viewBox');
    expect(result).toContain('fill="blue"');
    expect(result).toContain('stroke="black"');
  });
});

describe('generateReceiptHtml', () => {
  function createReceiptOrder(
    overrides: Partial<ReceiptOrder> = {}
  ): ReceiptOrder {
    return {
      order_number: 'ORD-123',
      created_at: '2026-04-08T18:02:55.974Z',
      currency: 'NGN',
      total: 500000,
      subtotal: 500000,
      shipping_fee: 0,
      tax_amount: 0,
      discount_amount: 0,
      amount_paid: 500000,
      balance: 0,
      payment_status: 'paid',
      payment_method: 'card',
      customer_name: 'Akinola Ogunniran',
      customer_email: 'akin@example.com',
      customer_phone: null,
      items: [
        {
          product_name: 'Samsung Galaxy S22 Ultra',
          variant_name: 'Black / 256GB',
          quantity: 1,
          price: 500000,
        },
      ],
      ...overrides,
    };
  }

  function createReceiptMerchant(
    overrides: Partial<ReceiptMerchant> = {}
  ): ReceiptMerchant {
    return {
      business_name: 'Ogabassey',
      logo_url: null,
      email: 'hello@example.com',
      phone: null,
      support_email: null,
      support_phone: null,
      business_address: null,
      cac_rc_number: null,
      tax_identification_number: null,
      legal_entity_name: null,
      vat_registration_status: null,
      vat_rate: null,
      bank_code: null,
      bank_account_number: null,
      ...overrides,
    };
  }

  it('includes the variant label in receipt item rows', () => {
    const html = generateReceiptHtml(
      createReceiptOrder(),
      createReceiptMerchant()
    );

    expect(html).toContain('Samsung Galaxy S22 Ultra (Black / 256GB)');
  });

  it('includes saved IMEI and serial number details on the receipt', () => {
    const html = generateReceiptHtml(
      createReceiptOrder({
        fulfillment_details: {
          imei: '353456789012345',
          serialNumber: 'SN-123',
        },
      }),
      createReceiptMerchant()
    );

    expect(html).toContain('Fulfillment Details');
    expect(html).toContain('IMEI');
    expect(html).toContain('353456789012345');
    expect(html).toContain('S/N');
    expect(html).toContain('SN-123');
  });

  it('falls back to legacy serial_number when serialNumber is blank', () => {
    const html = generateReceiptHtml(
      createReceiptOrder({
        fulfillment_details: {
          serialNumber: ' ',
          serial_number: 'SN-LEGACY-123',
        },
      }),
      createReceiptMerchant()
    );

    expect(html).toContain('S/N');
    expect(html).toContain('SN-LEGACY-123');
    expect(html.match(/S\/N/g) ?? []).toHaveLength(1);
  });

  it('does not show stale VAT when the order total excludes the tax amount', () => {
    const html = generateReceiptHtml(
      createReceiptOrder({
        subtotal: 935000,
        tax_amount: 70125,
        total: 935000,
      }),
      createReceiptMerchant({
        vat_registration_status: 'registered',
        vat_rate: 7.5,
      })
    );

    expect(html).not.toContain('VAT (7.5%)');
    expect(html).not.toContain('70125');
  });

  it('shows VAT when the order total includes the tax amount', () => {
    const html = generateReceiptHtml(
      createReceiptOrder({
        subtotal: 935000,
        tax_amount: 70125,
        total: 1005125,
      }),
      createReceiptMerchant({
        vat_registration_status: 'registered',
        vat_rate: 7.5,
      })
    );

    expect(html).toContain('VAT (7.5%)');
    expect(html).toContain('₦935,000.00');
    expect(html).toContain('₦70,125.00');
    expect(html).toContain('₦1,005,125.00');
  });

  it('shows VAT when subtotal was backfilled from a tax-inclusive total', () => {
    const html = generateReceiptHtml(
      createReceiptOrder({
        subtotal: 1005125,
        tax_amount: 70125,
        total: 1005125,
      }),
      createReceiptMerchant({
        vat_registration_status: 'registered',
        vat_rate: 7.5,
      })
    );

    expect(html).toContain(`VAT (${DEFAULT_NG_VAT_RATE}%)`);
    expect(html).toContain('₦935,000.00');
    expect(html).toContain('₦70,125.00');
    expect(html).toContain('₦1,005,125.00');
  });

  it('does not use the Nigerian VAT fallback for non-NGN backfilled totals', () => {
    const html = generateReceiptHtml(
      createReceiptOrder({
        currency: 'USD',
        subtotal: 1005125,
        tax_amount: 70125,
        total: 1005125,
      }),
      createReceiptMerchant({
        vat_registration_status: 'registered',
        vat_rate: null,
      })
    );

    expect(html).not.toContain(`VAT (${DEFAULT_NG_VAT_RATE}%)`);
    expect(html).not.toContain('$70,125.00');
    expect(html).toContain('$1,005,125.00');
  });

  it('shows VAT for tax-inclusive backfilled totals when the merchant VAT rate is missing', () => {
    const html = generateReceiptHtml(
      createReceiptOrder({
        subtotal: 1005125,
        tax_amount: 70125,
        total: 1005125,
      }),
      createReceiptMerchant({
        vat_registration_status: 'registered',
        vat_rate: null,
      })
    );

    expect(html).toContain('VAT (7.5%)');
    expect(html).toContain('₦935,000.00');
    expect(html).toContain('₦70,125.00');
    expect(html).toContain('₦1,005,125.00');
  });

  it('does not emit unsafe brand colors into receipt styles', () => {
    const html = generateReceiptHtml(
      createReceiptOrder(),
      createReceiptMerchant({
        brand_colors: {
          accent: 'rgb(12, 34, 56);}</style><script>alert(2)</script><style>',
          background: '#ffffff',
          primary: '#111827;}</style><script>alert(1)</script><style>',
        },
      })
    );

    expect(html).not.toContain('</style><script>');
    expect(html).not.toContain('alert(1)');
    expect(html).not.toContain('alert(2)');
  });

  it('escapes QR image data URIs before rendering', () => {
    const html = generateReceiptHtml(
      createReceiptOrder(),
      createReceiptMerchant(),
      {
        qrCodeDataUri: 'data:image/png;base64,abc" onerror="alert(1)',
      }
    );

    expect(html).not.toContain(
      'src="data:image/png;base64,abc" onerror="alert(1)"'
    );
    expect(html).toContain(
      'src="data:image/png;base64,abc&quot; onerror=&quot;alert(1)"'
    );
  });

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
