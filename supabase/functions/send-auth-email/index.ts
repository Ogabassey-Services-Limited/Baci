import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0';

function getRequiredEnv(name: string): string {
  const value = Deno.env.get(name);

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

const ZEPTOMAIL_TOKEN = getRequiredEnv('ZEPTOMAIL_TOKEN');
const SEND_EMAIL_HOOK_SECRET = getRequiredEnv('SEND_EMAIL_HOOK_SECRET');
const SUPABASE_URL = getRequiredEnv('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');

const BACI_LOGO_URL =
  'https://aivqthbxdshhltbwipbr.supabase.co/storage/v1/object/public/media/platform/baci-logo.png';
const BACI_PRIMARY_COLOR = '#1e40af';
const BACI_BUTTON_COLOR = '#fbbf24';
const BACI_BUTTON_TEXT_COLOR = '#1e1e1e';

interface EmailPayload {
  user: {
    id: string;
    email: string;
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: string;
    site_url: string;
  };
}

interface MerchantBranding {
  businessName: string;
  logoUrl: string | null;
  primaryColor: string;
  buttonColor: string;
  buttonTextColor: string;
}

const BACI_BRANDING: MerchantBranding = {
  businessName: 'Baci',
  logoUrl: BACI_LOGO_URL,
  primaryColor: BACI_PRIMARY_COLOR,
  buttonColor: BACI_BUTTON_COLOR,
  buttonTextColor: BACI_BUTTON_TEXT_COLOR,
};

function getEmailConfig(
  emailType: string,
  brandName: string
): { subject: string; heading: string; body: string; buttonText: string } {
  const configs: Record<
    string,
    { subject: string; heading: string; body: string; buttonText: string }
  > = {
    signup: {
      subject: `Confirm your ${brandName} account`,
      heading: 'Verify your email address',
      body: `Thanks for joining ${brandName}! Please confirm your email address to activate your account.`,
      buttonText: 'Confirm Email',
    },
    signup_confirmation: {
      subject: `Confirm your ${brandName} account`,
      heading: 'Verify your email address',
      body: `Thanks for joining ${brandName}! Please confirm your email address to activate your account.`,
      buttonText: 'Confirm Email',
    },
    invite: {
      subject: `You've been invited to ${brandName}`,
      heading: "You've been invited!",
      body: `You have been invited to join ${brandName}. Click the button below to set up your account and get started.`,
      buttonText: 'Accept Invitation',
    },
    magiclink: {
      subject: `Log in to ${brandName}`,
      heading: 'Your Login Link',
      body: `Click the button below to log in to your ${brandName} account. This link will expire in 24 hours.`,
      buttonText: 'Log In Now',
    },
    recovery: {
      subject: `Reset your ${brandName} password`,
      heading: 'Reset Your Password',
      body: 'We received a request to reset your password. Click the button below to choose a new one.',
      buttonText: 'Reset Password',
    },
    email_change: {
      subject: 'Confirm your new email address',
      heading: 'Confirm Email Change',
      body: 'Please confirm the update of your email address by clicking the button below.',
      buttonText: 'Confirm New Email',
    },
    reauthentication: {
      subject: 'Security verification required',
      heading: 'Security Verification',
      body: 'A sensitive action was requested on your account. Please verify your identity to proceed.',
      buttonText: 'Verify Identity',
    },
  };

  return configs[emailType] || configs.signup;
}

/**
 * Extract the merchant slug from a redirect URL.
 * Expected format: https://{slug}.usebaci.com/...
 * Returns null for non-merchant URLs (e.g. usebaci.com/dashboard).
 */
function extractMerchantSlug(redirectTo: string): string | null {
  if (!redirectTo) return null;

  try {
    const url = new URL(redirectTo);
    const hostname = url.hostname;

    // Match {slug}.usebaci.com or {slug}.{env}.usebaci.com
    // Exclude www, app, dashboard as they're not merchant slugs
    const baciDomainMatch = hostname.match(
      /^([a-z0-9][a-z0-9-]+)\.(?:.*\.)?usebaci\.com$/i
    );
    if (
      baciDomainMatch &&
      !['www', 'app', 'dashboard'].includes(baciDomainMatch[1].toLowerCase())
    ) {
      return baciDomainMatch[1].toLowerCase();
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Fetch merchant branding from the database by slug.
 * Returns null if the merchant is not found.
 */
async function fetchMerchantBranding(
  slug: string
): Promise<MerchantBranding | null> {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: merchant, error } = await supabase
      .from('merchants')
      .select('business_name, logo_url, brand_colors')
      .eq('slug', slug)
      .eq('is_published', true)
      .single();

    if (error || !merchant) {
      console.log('Merchant not found for slug:', slug);
      return null;
    }

    const brandColors = merchant.brand_colors as {
      primary?: string;
      accent?: string;
    } | null;

    return {
      businessName: merchant.business_name,
      logoUrl: merchant.logo_url || null,
      primaryColor: brandColors?.primary || BACI_PRIMARY_COLOR,
      buttonColor:
        brandColors?.accent || brandColors?.primary || BACI_BUTTON_COLOR,
      buttonTextColor: '#ffffff',
    };
  } catch (err) {
    console.error('Error fetching merchant branding:', err);
    return null;
  }
}

/**
 * Validates and sanitizes a URL for safe use in href attributes.
 * Only allows http/https protocols to prevent javascript: and other XSS vectors.
 */
function sanitizeUrl(url: string): string {
  if (!url) return '#';

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      console.warn('Invalid URL protocol rejected:', parsed.protocol);
      return '#';
    }
    return parsed.href;
  } catch {
    console.warn('Invalid URL format rejected:', url);
    return '#';
  }
}

function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function generateEmailHtml(
  config: {
    subject: string;
    heading: string;
    body: string;
    buttonText: string;
  },
  confirmationUrl: string,
  branding: MerchantBranding,
  token?: string
): string {
  const safeHeading = escapeHtml(config.heading);
  const safeBody = escapeHtml(config.body);
  const safeButtonText = escapeHtml(config.buttonText);
  const safeUrl = escapeHtml(sanitizeUrl(confirmationUrl));
  const safeBrandName = escapeHtml(branding.businessName);

  // Header: show logo if available, otherwise show brand name as text
  const headerContent = branding.logoUrl
    ? `<img src="${escapeHtml(branding.logoUrl)}" alt="${safeBrandName}" height="48" style="height: 48px; width: auto; max-width: 200px;">`
    : `<span style="font-size: 24px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">${safeBrandName}</span>`;

  const tokenHtml = token
    ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
      <tr>
        <td align="center">
            <div style="background-color: #f1f5f9; padding: 12px 24px; border-radius: 8px; display: inline-block;">
                <span style="font-family: monospace; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #1e40af;">${escapeHtml(token)}</span>
            </div>
            <p style="margin: 12px 0 0; font-size: 14px; color: #64748b;">Or use this code to verify your account</p>
        </td>
      </tr>
    </table>
  `
    : '';

  // Footer: "Powered by Baci" for merchant emails, "Baci Platform" for Baci emails
  const isMerchantBranded = branding.businessName !== 'Baci';
  const footerText = isMerchantBranded
    ? `&copy; ${new Date().getFullYear()} ${safeBrandName}. Powered by <strong>Baci</strong>.`
    : `&copy; ${new Date().getFullYear()} Baci Platform. All rights reserved.`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, ${branding.primaryColor} 0%, ${branding.primaryColor}cc 100%); padding: 32px; text-align: center;">
              ${headerContent}
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 32px; color: #334155;">
              <h1 style="margin: 0 0 16px; font-size: 24px; color: #0f172a;">${safeHeading}</h1>
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6;">${safeBody}</p>

              ${tokenHtml}

              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 16px 0 32px;">
                    <a href="${safeUrl}" style="display: inline-block; background-color: ${branding.buttonColor}; color: ${branding.buttonTextColor}; font-weight: 600; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-size: 16px;">${safeButtonText}</a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0; font-size: 14px; color: #64748b;">If you didn't request this, you can safely ignore this email.</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 32px; text-align: center; background-color: #f1f5f9; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">${footerText}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  console.log(
    'Token length:',
    ZEPTOMAIL_TOKEN.length,
    'Secret length:',
    SEND_EMAIL_HOOK_SECRET.length
  );

  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);

  // Verify webhook signature
  let data: EmailPayload;
  try {
    const wh = new Webhook(SEND_EMAIL_HOOK_SECRET);
    data = wh.verify(payload, headers) as EmailPayload;
  } catch (error) {
    console.error('Webhook verification failed:', error);
    return new Response(JSON.stringify({ error: 'Invalid signature' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { user, email_data: emailData } = data;
  if (
    !emailData ||
    typeof emailData !== 'object' ||
    !emailData.site_url ||
    !emailData.token_hash ||
    !emailData.email_action_type
  ) {
    console.error('Missing auth email redirect inputs', {
      siteUrl: emailData?.site_url,
      hasTokenHash: Boolean(emailData?.token_hash),
      emailType: emailData?.email_action_type,
    });
    return new Response(
      JSON.stringify({ error: 'Invalid email configuration' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
  const emailType = emailData.email_action_type;

  // Resolve merchant branding from redirect URL (customer storefront auth)
  const merchantSlug = extractMerchantSlug(emailData.redirect_to);
  let branding = BACI_BRANDING;

  if (merchantSlug) {
    console.log('Detected merchant slug from redirect_to:', merchantSlug);
    const merchantBranding = await fetchMerchantBranding(merchantSlug);
    if (merchantBranding) {
      branding = merchantBranding;
      console.log('Using merchant branding:', branding.businessName);
    }
  }

  const config = getEmailConfig(emailType, branding.businessName);

  let confirmationUrl: URL;
  try {
    confirmationUrl = new URL('/auth/confirm', emailData.site_url);
  } catch (error) {
    console.error(
      'Invalid site URL for auth email:',
      emailData.site_url,
      error
    );
    return new Response(
      JSON.stringify({ error: 'Invalid email configuration' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  confirmationUrl.searchParams.set('token_hash', emailData.token_hash);
  confirmationUrl.searchParams.set('type', emailType);

  if (emailData.redirect_to) {
    if (/^https?:\/\//i.test(emailData.redirect_to)) {
      try {
        const nextUrl = new URL(emailData.redirect_to);
        const siteUrl = new URL(emailData.site_url);

        if (nextUrl.origin === siteUrl.origin) {
          confirmationUrl.searchParams.set('next', nextUrl.toString());
        }
      } catch (error) {
        console.warn(
          'Ignoring invalid redirect_to URL:',
          emailData.redirect_to,
          error
        );
      }
    } else {
      confirmationUrl.searchParams.set('next', emailData.redirect_to);
    }
  }

  const htmlBody = generateEmailHtml(
    config,
    confirmationUrl.toString(),
    branding,
    emailData.token
  );

  // Sender: use merchant name for merchant emails, "Baci" for platform emails
  const senderName =
    branding.businessName !== 'Baci'
      ? `${branding.businessName} via Baci`
      : 'Baci';

  console.log(
    'Sending email to:',
    user.email,
    'Type:',
    emailType,
    'Brand:',
    branding.businessName
  );
  console.log('generated_otp:', emailData.token);

  // Send via ZeptoMail
  try {
    const response = await fetch('https://api.zeptomail.com/v1.1/email', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Zoho-enczapikey ${ZEPTOMAIL_TOKEN}`,
      },
      body: JSON.stringify({
        from: { address: 'noreply@usebaci.com', name: senderName },
        to: [{ email_address: { address: user.email } }],
        subject: config.subject,
        htmlbody: htmlBody,
      }),
    });

    const responseText = await response.text();
    console.log('ZeptoMail response:', response.status, responseText);

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: 'ZeptoMail failed', details: responseText }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Fetch error:', error);
    return new Response(
      JSON.stringify({ error: 'Email delivery failed. Please try again.' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});
