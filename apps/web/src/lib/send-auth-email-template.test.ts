// @vitest-environment node

import { describe, expect, it } from 'vitest';
import {
  buildAuthEmailConfirmationUrl,
  extractMerchantLookup,
  generateEmailHtml,
  getCustomDomainCandidates,
  getEmailConfig,
} from '../../../../supabase/functions/send-auth-email/auth-email-template';
import {
  buildAuthEmailConfirmationUrl as buildAppLocalAuthEmailConfirmationUrl,
  generateEmailHtml as generateAppLocalEmailHtml,
} from '../../supabase/functions/send-auth-email/auth-email-template';

describe('send-auth-email template helpers', () => {
  const ogabasseyMerchantLogoUrl =
    'https://cdn.ogabassey.com/merchants/ogabassey/uploads/ogabassey-logo-2026-v1.png';
  const ogabasseyOpaqueEmailLogoUrl =
    'https://cdn.ogabassey.com/merchants/ogabassey/uploads/ogabassey-email-logo-2026-v1.png';
  const ogabasseyBranding = {
    businessName: 'Ogabassey',
    customDomain: 'ogabassey.com',
    emailSenderName: 'Ogabassey',
    logoUrl: null,
    primaryColor: '#d62027',
    buttonColor: '#d62027',
    buttonTextColor: '#ffffff',
    slug: 'ogabassey',
    supportEmail: 'support@ogabassey.com',
  };

  it('detects Baci merchant subdomains from auth redirects', () => {
    expect(
      extractMerchantLookup('https://ogabassey.usebaci.com/account/verify')
    ).toEqual({ customDomain: null, slug: 'ogabassey' });
  });

  it('detects custom domains from auth redirects', () => {
    expect(
      extractMerchantLookup('https://ogabassey.com/account/verify')
    ).toEqual({ customDomain: 'ogabassey.com', slug: null });
  });

  it('builds same-merchant custom-domain confirmation links with relative next params', () => {
    const rootUrl = buildAuthEmailConfirmationUrl({
      branding: ogabasseyBranding,
      emailType: 'magiclink',
      redirectTo: 'https://ogabassey.com/account/verify?from=email',
      siteUrl: 'https://usebaci.com',
      tokenHash: 'hash-123',
    });
    const appLocalUrl = buildAppLocalAuthEmailConfirmationUrl({
      branding: ogabasseyBranding,
      emailType: 'magiclink',
      redirectTo: 'https://ogabassey.com/account/verify?from=email',
      siteUrl: 'https://usebaci.com',
      tokenHash: 'hash-123',
    });

    expect(appLocalUrl).toBe(rootUrl);
    const url = new URL(rootUrl ?? '');
    expect(url.origin).toBe('https://ogabassey.com');
    expect(url.pathname).toBe('/auth/confirm');
    expect(url.searchParams.get('token_hash')).toBe('hash-123');
    expect(url.searchParams.get('type')).toBe('magiclink');
    expect(url.searchParams.get('next')).toBe('/account/verify?from=email');
  });

  it('keeps same-merchant subdomain confirmation on the platform host and routes next through the slug', () => {
    for (const build of [
      buildAuthEmailConfirmationUrl,
      buildAppLocalAuthEmailConfirmationUrl,
    ]) {
      const url = build({
        branding: ogabasseyBranding,
        emailType: 'magiclink',
        redirectTo: 'https://ogabassey.usebaci.com/account/verify?from=email',
        siteUrl: 'https://usebaci.com',
        tokenHash: 'hash-123',
      });

      const parsed = new URL(url ?? '');
      expect(parsed.origin).toBe('https://usebaci.com');
      expect(parsed.pathname).toBe('/auth/confirm');
      expect(parsed.searchParams.get('token_hash')).toBe('hash-123');
      expect(parsed.searchParams.get('type')).toBe('magiclink');
      expect(parsed.searchParams.get('next')).toBe(
        '/ogabassey/account/verify?from=email'
      );
    }
  });

  it('drops external confirmation next targets', () => {
    const url = buildAuthEmailConfirmationUrl({
      branding: ogabasseyBranding,
      emailType: 'magiclink',
      redirectTo: 'https://evil.example/account',
      siteUrl: 'https://usebaci.com',
      tokenHash: 'hash-123',
    });

    expect(new URL(url ?? '').searchParams.has('next')).toBe(false);
  });

  it('keeps same-merchant non-HTTPS redirects on the platform host with no next', () => {
    // A token-bearing confirmation must never be moved onto a plain http://
    // origin (the token could leak over the wire), so the link stays on
    // site_url and the untrusted next is dropped.
    for (const build of [
      buildAuthEmailConfirmationUrl,
      buildAppLocalAuthEmailConfirmationUrl,
    ]) {
      const url = build({
        branding: ogabasseyBranding,
        emailType: 'magiclink',
        redirectTo: 'http://ogabassey.com/account/verify',
        siteUrl: 'https://usebaci.com',
        tokenHash: 'hash-123',
      });
      const parsed = new URL(url ?? '');
      expect(parsed.origin).toBe('https://usebaci.com');
      expect(parsed.pathname).toBe('/auth/confirm');
      expect(parsed.searchParams.has('next')).toBe(false);
      expect(parsed.searchParams.get('token_hash')).toBe('hash-123');
    }
  });

  it('builds custom-domain candidates with and without www', () => {
    expect(getCustomDomainCandidates('ogabassey.com')).toEqual([
      'ogabassey.com',
      'www.ogabassey.com',
    ]);
    expect(getCustomDomainCandidates('www.ogabassey.com')).toEqual([
      'www.ogabassey.com',
      'ogabassey.com',
    ]);
  });

  it('uses sign-in-code copy for magiclink auth emails', () => {
    expect(getEmailConfig('magiclink', 'Ogabassey')).toEqual(
      expect.objectContaining({
        buttonText: 'Open Ogabassey',
        heading: 'Your sign-in code',
        subject: 'Your Ogabassey sign-in code',
      })
    );
  });

  it('renders the Ogabassey auth email as a branded OTP email', () => {
    const html = generateEmailHtml(
      getEmailConfig('magiclink', 'Ogabassey'),
      'https://usebaci.com/auth/confirm?token_hash=hash&type=magiclink',
      ogabasseyBranding,
      '123456',
      'https://ogabassey.com/account/verify'
    );

    expect(html).toContain('Secure sign in');
    expect(html).toContain('123456');
    expect(html).toContain('href="https://ogabassey.com/account/verify"');
    expect(html).toContain('support@ogabassey.com');
    expect(html).toContain('Ogabassey Never Disappoints.');
    expect(html).toContain('content="light dark"');
    // Mobile header keeps the badge pinned top-right (logo 60% / badge 40%)
    // rather than stacking — the pill stays in the top-right corner on phones.
    expect(html).toContain('.a-brand-cell{width:60%');
    expect(html).toContain('class="a-brand-cell"');
    expect(html).toContain('class="a-badge-cell"');
    expect(html).toContain('class="a-badge"');
    expect(html).not.toContain('linear-gradient');
  });

  it('renders configured merchant logo images inside a fixed white email-table chip', () => {
    const html = generateEmailHtml(
      getEmailConfig('magiclink', 'Ogabassey'),
      'https://usebaci.com/auth/confirm?token_hash=hash&type=magiclink',
      { ...ogabasseyBranding, logoUrl: ogabasseyMerchantLogoUrl },
      '123456',
      'https://ogabassey.com/account/verify'
    );

    expect(html).toContain(`<img src="${ogabasseyMerchantLogoUrl}"`);
    expect(html).toContain('class="a-logo-chip"');
    expect(html).toContain('bgcolor="#ffffff"');
    expect(html).toContain('background:#ffffff');
    expect(html).toContain('background-color:#ffffff');
    expect(html).toContain('color-scheme:light');
    expect(html).toContain('forced-color-adjust:none');
    expect(html).toContain('mso-table-lspace:0pt');
    expect(html).toContain('mso-table-rspace:0pt');
    expect(html).not.toContain('display:inline-table');
  });

  it('renders configured opaque email logos directly without the white chip', () => {
    const config = getEmailConfig('magiclink', 'Ogabassey');
    const confirmationUrl =
      'https://usebaci.com/auth/confirm?token_hash=hash&type=magiclink';
    const branding = {
      ...ogabasseyBranding,
      emailLogoUrl: ogabasseyOpaqueEmailLogoUrl,
      logoUrl: ogabasseyMerchantLogoUrl,
    };
    const token = '123456';
    const actionUrl = 'https://ogabassey.com/account/verify';

    const rootHtml = generateEmailHtml(
      config,
      confirmationUrl,
      branding,
      token,
      actionUrl
    );
    const appLocalHtml = generateAppLocalEmailHtml(
      config,
      confirmationUrl,
      branding,
      token,
      actionUrl
    );

    expect(appLocalHtml).toBe(rootHtml);
    // Opaque email logo is rendered directly as an image (white plate baked in),
    // with no white CSS chip — Gmail's dark mode cannot invert image pixels.
    expect(rootHtml).toContain(
      `<img class="a-logo-img" src="${ogabasseyOpaqueEmailLogoUrl}"`
    );
    expect(rootHtml).toContain('class="a-logo-img"');
    expect(rootHtml).not.toContain('class="a-logo-chip"');
    expect(rootHtml).not.toContain(`<img src="${ogabasseyMerchantLogoUrl}"`);
  });

  it('centers table-based logos in default auth emails', () => {
    const baciLogoUrl = 'https://usebaci.com/baci-logo.png';

    const html = generateEmailHtml(
      getEmailConfig('magiclink', 'Baci'),
      'https://usebaci.com/auth/confirm?token_hash=hash&type=magiclink',
      {
        businessName: 'Baci',
        customDomain: null,
        emailSenderName: 'Baci',
        logoUrl: baciLogoUrl,
        primaryColor: '#111827',
        buttonColor: '#111827',
        buttonTextColor: '#ffffff',
        slug: null,
        supportEmail: null,
      },
      '123456',
      'https://usebaci.com/auth/confirm'
    );

    expect(html).toContain(`<img src="${baciLogoUrl}"`);
    expect(html).toContain('<table role="presentation" align="center"');
    expect(html).toContain('style="margin:0 auto;max-width:100%');
  });

  it('keeps the app-local auth template copy in sync for logo rendering', () => {
    const config = getEmailConfig('magiclink', 'Ogabassey');
    const confirmationUrl =
      'https://usebaci.com/auth/confirm?token_hash=hash&type=magiclink';
    const branding = {
      ...ogabasseyBranding,
      logoUrl: ogabasseyMerchantLogoUrl,
    };
    const token = '123456';
    const actionUrl = 'https://ogabassey.com/account/verify';

    const rootHtml = generateEmailHtml(
      config,
      confirmationUrl,
      branding,
      token,
      actionUrl
    );
    const appLocalHtml = generateAppLocalEmailHtml(
      config,
      confirmationUrl,
      branding,
      token,
      actionUrl
    );

    expect(appLocalHtml).toBe(rootHtml);
    expect(appLocalHtml).toContain(`<img src="${ogabasseyMerchantLogoUrl}"`);
    expect(appLocalHtml).toContain('class="a-logo-chip"');
  });

  it('keeps configured logos for merchants with similar names', () => {
    const resellerLogoUrl =
      'https://cdn.example.com/media/ogabassey-reseller-logo.png';

    const html = generateEmailHtml(
      getEmailConfig('magiclink', 'Ogabassey Reseller'),
      'https://usebaci.com/auth/confirm?token_hash=hash&type=magiclink',
      {
        businessName: 'Ogabassey Reseller',
        customDomain: 'shop-ogabassey.example.com',
        emailSenderName: 'Ogabassey Reseller',
        logoUrl: resellerLogoUrl,
        primaryColor: '#d62027',
        buttonColor: '#d62027',
        buttonTextColor: '#ffffff',
        slug: 'ogabassey-reseller',
        supportEmail: 'support@example.com',
      },
      '123456',
      'https://shop-ogabassey.example.com/account/verify'
    );

    expect(html).toContain(`<img src="${resellerLogoUrl}"`);
    expect(html).toContain('class="a-logo-chip"');
  });

  it('omits the Ogabassey CTA when the action URL is unsafe', () => {
    const config = getEmailConfig('magiclink', 'Ogabassey');
    const html = generateEmailHtml(
      config,
      'https://usebaci.com/auth/confirm?token_hash=hash&type=magiclink',
      ogabasseyBranding,
      '123456',
      'javascript:alert(1)'
    );

    expect(html).toContain('123456');
    expect(html).not.toContain('javascript:alert');
    expect(html).not.toContain(config.buttonText);
  });
});
