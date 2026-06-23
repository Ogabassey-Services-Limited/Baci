// @vitest-environment node

import { describe, expect, it } from 'vitest';
import {
  extractMerchantLookup,
  generateEmailHtml,
  getCustomDomainCandidates,
  getEmailConfig,
} from '../../../../supabase/functions/send-auth-email/auth-email-template';

describe('send-auth-email template helpers', () => {
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
        logoUrl:
          'https://cdn.ogabassey.com/merchants/ogabassey/uploads/ogabassey-logo-2026-v1.png',
        primaryColor: '#d62027',
        buttonColor: '#d62027',
        buttonTextColor: '#ffffff',
        slug: 'ogabassey',
        supportEmail: 'support@ogabassey.com',
      },
      '123456',
      'https://ogabassey.com/account/verify'
    );

    expect(html).toContain(
      '<img src="https://cdn.ogabassey.com/merchants/ogabassey/uploads/ogabassey-logo-2026-v1.png"'
    );
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
