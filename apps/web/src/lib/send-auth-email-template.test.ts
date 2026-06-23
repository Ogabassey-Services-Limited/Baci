// @vitest-environment node

import { describe, expect, it } from 'vitest';
import {
  extractMerchantLookup,
  generateEmailHtml,
  getCustomDomainCandidates,
  getEmailConfig,
} from '../../../../supabase/functions/send-auth-email/auth-email-template';
import { generateEmailHtml as generateAppLocalEmailHtml } from '../../supabase/functions/send-auth-email/auth-email-template';

describe('send-auth-email template helpers', () => {
  const ogabasseyMerchantLogoUrl =
    'https://cdn.ogabassey.com/merchants/ogabassey/uploads/ogabassey-logo-2026-v1.png';
  const ogabasseyEmailLogoUrl =
    'https://ogabassey.com/email/ogabassey-logo-white-chip.png';

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
      {
        businessName: 'Ogabassey',
        customDomain: 'ogabassey.com',
        emailSenderName: 'Ogabassey',
        logoUrl: null,
        primaryColor: '#d62027',
        buttonColor: '#d62027',
        buttonTextColor: '#ffffff',
        slug: 'ogabassey',
        supportEmail: 'support@ogabassey.com',
      },
      '123456',
      'https://ogabassey.com/account/verify'
    );

    expect(html).toContain('Secure sign in');
    expect(html).toContain('123456');
    expect(html).toContain('href="https://ogabassey.com/account/verify"');
    expect(html).toContain('support@ogabassey.com');
    expect(html).toContain('Ogabassey Never Disappoints.');
    expect(html).toContain('content="light dark"');
    expect(html).toContain('.a-brand-cell,.a-badge-cell');
    expect(html).toContain('class="a-brand-cell"');
    expect(html).toContain('class="a-badge-cell"');
    expect(html).toContain('class="a-badge"');
    expect(html).not.toContain('linear-gradient');
  });

  it('renders merchant logo images inside a fixed white email-table chip', () => {
    const html = generateEmailHtml(
      getEmailConfig('magiclink', 'Ogabassey'),
      'https://usebaci.com/auth/confirm?token_hash=hash&type=magiclink',
      {
        businessName: 'Ogabassey',
        customDomain: 'ogabassey.com',
        emailSenderName: 'Ogabassey',
        logoUrl: ogabasseyMerchantLogoUrl,
        primaryColor: '#d62027',
        buttonColor: '#d62027',
        buttonTextColor: '#ffffff',
        slug: 'ogabassey',
        supportEmail: 'support@ogabassey.com',
      },
      '123456',
      'https://ogabassey.com/account/verify'
    );

    expect(html).toContain(`<img src="${ogabasseyEmailLogoUrl}"`);
    expect(html).not.toContain(`<img src="${ogabasseyMerchantLogoUrl}"`);
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
      businessName: 'Ogabassey',
      customDomain: 'ogabassey.com',
      emailSenderName: 'Ogabassey',
      logoUrl: ogabasseyMerchantLogoUrl,
      primaryColor: '#d62027',
      buttonColor: '#d62027',
      buttonTextColor: '#ffffff',
      slug: 'ogabassey',
      supportEmail: 'support@ogabassey.com',
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
    expect(appLocalHtml).toContain(`<img src="${ogabasseyEmailLogoUrl}"`);
    expect(appLocalHtml).not.toContain(
      `<img src="${ogabasseyMerchantLogoUrl}"`
    );
  });

  it('does not use the Ogabassey logo for merchants with similar names', () => {
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
    expect(html).not.toContain(`<img src="${ogabasseyEmailLogoUrl}"`);
  });

  it('omits the Ogabassey CTA when the action URL is unsafe', () => {
    const config = getEmailConfig('magiclink', 'Ogabassey');
    const branding = {
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

    const html = generateEmailHtml(
      config,
      'https://usebaci.com/auth/confirm?token_hash=hash&type=magiclink',
      branding,
      '123456',
      'javascript:alert(1)'
    );

    expect(html).toContain('123456');
    expect(html).not.toContain('javascript:alert');
    expect(html).not.toContain(config.buttonText);
  });
});
