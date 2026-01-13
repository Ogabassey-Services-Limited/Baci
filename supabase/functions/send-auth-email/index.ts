import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0';

const ZEPTOMAIL_TOKEN = Deno.env.get('ZEPTOMAIL_TOKEN') || '';
const SEND_EMAIL_HOOK_SECRET = Deno.env.get('SEND_EMAIL_HOOK_SECRET') || '';
const LOGO_URL =
  'https://aivqthbxdshhltbwipbr.supabase.co/storage/v1/object/public/media/platform/baci-logo.png';

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

const EMAIL_CONFIG: Record<
  string,
  { subject: string; heading: string; body: string; buttonText: string }
> = {
  signup: {
    subject: 'Confirm your Baci account',
    heading: 'Verify your email address',
    body: 'Thanks for starting your journey with Baci! Please confirm your email address to activate your account.',
    buttonText: 'Confirm Email',
  },
  signup_confirmation: {
    subject: 'Confirm your Baci account',
    heading: 'Verify your email address',
    body: 'Thanks for starting your journey with Baci! Please confirm your email address to activate your account.',
    buttonText: 'Confirm Email',
  },
  invite: {
    subject: "You've been invited to Baci",
    heading: "You've been invited!",
    body: 'You have been invited to join Baci. Click the button below to set up your account and get started.',
    buttonText: 'Accept Invitation',
  },
  magiclink: {
    subject: 'Log in to Baci',
    heading: 'Your Login Link',
    body: 'Click the button below to log in to your Baci account. This link will expire in 24 hours.',
    buttonText: 'Log In Now',
  },
  recovery: {
    subject: 'Reset your Baci password',
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
  config: (typeof EMAIL_CONFIG)[string],
  confirmationUrl: string,
  token?: string
): string {
  const safeHeading = escapeHtml(config.heading);
  const safeBody = escapeHtml(config.body);
  const safeButtonText = escapeHtml(config.buttonText);
  // URL should be encoded, not just HTML escaped, but basic HTML escaping protects the attribute
  const safeUrl = escapeHtml(confirmationUrl);
  const safeLogo = escapeHtml(LOGO_URL);

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
            <td style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 32px; text-align: center;">
              <img src="${safeLogo}" alt="Baci" height="48" style="height: 48px; width: auto;">
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
                    <a href="${safeUrl}" style="display: inline-block; background-color: #fbbf24; color: #1e1e1e; font-weight: 600; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-size: 16px;">${safeButtonText}</a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0; font-size: 14px; color: #64748b;">If you didn't request this, you can safely ignore this email.</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 32px; text-align: center; background-color: #f1f5f9; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">&copy; 2025 Baci Platform. All rights reserved.</p>
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

  // Debug
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

  const { user, email_data } = data;
  const emailType = email_data.email_action_type;
  const config = EMAIL_CONFIG[emailType] || EMAIL_CONFIG.signup;
  const confirmationUrl = `${email_data.site_url}/auth/confirm?token_hash=${email_data.token_hash}&type=${emailType}`;
  const htmlBody = generateEmailHtml(config, confirmationUrl, email_data.token);

  console.log('Sending email to:', user.email, 'Type:', emailType);
  console.log('generated_otp:', email_data.token); // DEBUG: Log token for manual retrieval

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
        from: { address: 'noreply@usebaci.com', name: 'Baci' },
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
    // Don't expose error details to client to prevent information leakage
    return new Response(
      JSON.stringify({ error: 'Email delivery failed. Please try again.' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});
